"""Turn Arbiter — LangGraph state machine for interviewer persona selection."""
import logging
from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

logger = logging.getLogger("turn-arbiter")

# LangGraph state machine states
class TurnState(str, Enum):
    IDLE = "idle"
    CANDIDATE_SPEAKING = "candidate_speaking"
    EVALUATING = "evaluating"
    PERSONA_SELECTED = "persona_selected"
    HANDOFF_ISSUED = "handoff_issued"
    AGENT_SPEAKING = "agent_speaking"
    FINALIZING = "finalizing"


class TurnArbiterState(BaseModel):
    """State for the LangGraph turn arbiter."""
    session_id: str
    current_state: TurnState = TurnState.IDLE
    current_persona: str = "technical"
    previous_persona: str | None = None
    candidate_speech_active: bool = False
    agent_speech_active: bool = False
    turn_count: int = 0
    last_candidate_answer: str | None = None
    last_candidate_answer_id: str | None = None
    whiteboard_state: dict[str, Any] = Field(default_factory=dict)
    pending_handoff: str | None = None  # persona being handed off to
    handoff_reason: str | None = None
    interrupt_requested: bool = False
    interrupt_type: str | None = None  # "speech", "keyword"
    interrupt_command: str | None = None  # "repeat", "pause", "restart"
    session_started_at: str | None = None
    questioning_completed: bool = False


class TurnArbiterNodeResult(BaseModel):
    """Result from a turn arbiter node execution."""
    next_state: TurnState
    actions: list[dict[str, Any]] = Field(default_factory=list)
    message: str | None = None


class TurnArbiter:
    """
    LangGraph-based Turn Arbiter for EchoSphere.
    
    Manages the flow of an interview session:
    - Decides which persona speaks next
    - Handles candidate interruptions
    - Manages persona handoffs based on open threads
    - Tracks turn-taking state
    """

    # Decision hierarchy (from spec §7.2):
    # 1. Any open thread older than N turns and unassigned to current persona? → hand off
    # 2. Current persona has unexplored seed topics? → continue
    # 3. Otherwise → next persona in panel order

    PERSONA_ORDER = ["technical", "product", "hiring_manager", "behavioral", "customer"]

    def __init__(self):
        self._session_states: dict[str, TurnArbiterState] = {}

    def get_or_create_state(self, session_id: str, initial_persona: str = "technical") -> TurnArbiterState:
        """Get or create the turn arbiter state for a session."""
        if session_id not in self._session_states:
            state = TurnArbiterState(
                session_id=session_id,
                current_persona=initial_persona,
                session_started_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            )
            self._session_states[session_id] = state
        return self._session_states[session_id]

    def reset_state(self, session_id: str) -> None:
        """Reset the state for a session (called when session ends)."""
        if session_id in self._session_states:
            del self._session_states[session_id]

    # --- State transition methods ---

    async def on_candidate_speaking_start(
        self, session_id: str, whiteboard: dict[str, Any]
    ) -> TurnArbiterNodeResult:
        """Called when candidate starts speaking (after agent finishes or on barge-in)."""
        state = self.get_or_create_state(session_id)
        state.current_state = TurnState.CANDIDATE_SPEAKING
        state.candidate_speech_active = True
        state.agent_speech_active = False
        state.interrupt_requested = False
        
        logger.debug(f"[{session_id}] Candidate speaking started, persona: {state.current_persona}")
        
        return TurnArbiterNodeResult(
            next_state=TurnState.CANDIDATE_SPEAKING,
            actions=[{"type": "start_listening"}],
        )

    async def on_candidate_speech_end(
        self, session_id: str, answer_text: str, answer_id: str, whiteboard: dict[str, Any]
    ) -> TurnArbiterNodeResult:
        """Called when candidate finishes speaking."""
        state = self.get_or_create_state(session_id)
        state.candidate_speech_active = False
        state.last_candidate_answer = answer_text
        state.last_candidate_answer_id = answer_id
        state.turn_count += 1
        
        logger.debug(f"[{session_id}] Candidate speech ended, turn #{state.turn_count}")
        
        # Move to evaluating state
        return TurnArbiterNodeResult(
            next_state=TurnState.EVALUATING,
            actions=[
                {"type": "save_transcript", "answer_text": answer_text, "answer_id": answer_id},
                {"type": "analyze_answer", "session_id": session_id},
            ],
        )

    async def on_evaluate(
        self, session_id: str, whiteboard: dict[str, Any]
    ) -> TurnArbiterNodeResult:
        """Evaluate the candidate's answer and decide next persona."""
        state = self.get_or_create_state(session_id)
        state.current_state = TurnState.EVALUATING
        
        open_threads = whiteboard.get("open_threads", [])
        current_persona = state.current_persona
        turn_count = state.turn_count
        
        # Rule 1: Check for open threads that need another persona
        for thread in open_threads:
            if thread.get("status") == "open":
                assigned_persona = thread.get("assigned_persona_hint", "")
                # If thread is unassigned or assigned to a different persona, hand off
                if not assigned_persona or assigned_persona != current_persona:
                    state.pending_handoff = assigned_persona or self._next_persona(current_persona)
                    state.handoff_reason = f"Open thread: {thread.get('description', 'Unspecified')}"
                    state.current_state = TurnState.PERSONA_SELECTED
                    
                    logger.info(f"[{session_id}] Handoff to {state.pending_handoff} due to open thread")
                    
                    return TurnArbiterNodeResult(
                        next_state=TurnState.PERSONA_SELECTED,
                        actions=[
                            {"type": "prepare_handoff", "target_persona": state.pending_handoff},
                            {"type": "log_handoff_reason", "reason": state.handoff_reason},
                        ],
                        message=f"Handoff to {state.pending_handoff}: {thread.get('description', '')[:100]}",
                    )
        
        # Rule 2: Current persona has unexplored topics?
        # Check if the current persona has been speaking too long without handoff
        # Simple heuristic: if we've had 3+ turns with same persona, consider handoff
        same_persona_turns = self._count_consecutive_same_persona(session_id)
        if same_persona_turns >= 3:
            next_p = self._next_persona(current_persona)
            if next_p:
                state.pending_handoff = next_p
                state.handoff_reason = f"Multiple turns with {current_persona} — rotating panel"
                state.current_state = TurnState.PERSONA_SELECTED
                
                logger.info(f"[{session_id}] Rotating from {current_persona} to {next_p} after {same_persona_turns} turns")
                
                return TurnArbiterNodeResult(
                    next_state=TurnState.PERSONA_SELECTED,
                    actions=[
                        {"type": "prepare_handoff", "target_persona": next_p},
                        {"type": "log_handoff_reason", "reason": state.handoff_reason},
                    ],
                    message=f"Rotating panel: {current_persona} → {next_p}",
                )
        
        # Rule 3: Continue with current persona
        state.pending_handoff = current_persona
        state.handoff_reason = "Continuing with current interviewer"
        state.current_state = TurnState.PERSONA_SELECTED
        
        logger.debug(f"[{session_id}] Continuing with {current_persona}")
        
        return TurnArbiterNodeResult(
            next_state=TurnState.PERSONA_SELECTED,
            actions=[{"type": "continue_current_persona"}],
            message=f"{current_persona} continues the interview",
        )

    async def on_persona_selected(
        self, session_id: str, whiteboard: dict[str, Any]
    ) -> TurnArbiterNodeResult:
        """Persona has been selected, execute handoff if needed."""
        state = self.get_or_create_state(session_id)
        
        target_persona = state.pending_handoff or state.current_persona
        needs_handoff = target_persona != state.current_persona
        state.current_state = TurnState.PERSONA_SELECTED
        
        if needs_handoff:
            state.previous_persona = state.current_persona
            state.current_persona = target_persona
            state.current_state = TurnState.HANDOFF_ISSUED
            
            logger.info(f"[{session_id}] Handoff: {state.previous_persona} → {target_persona}")
            
            return TurnArbiterNodeResult(
                next_state=TurnState.HANDOFF_ISSUED,
                actions=[
                    {"type": "issue_handoff", "from_persona": state.previous_persona, "to_persona": target_persona},
                    {"type": "update_whiteboard_current_persona", "persona": target_persona},
                    {"type": "record_handoff_event", "from_persona": state.previous_persona, "to_persona": target_persona},
                ],
                message=f"Handoff issued: {state.previous_persona} → {target_persona}",
            )
        else:
            # No handoff needed, just continue
            return TurnArbiterNodeResult(
                next_state=TurnState.AGENT_SPEAKING,
                actions=[{"type": "generate_question", "persona": target_persona}],
            )

    async def on_handoff_issued(
        self, session_id: str, whiteboard: dict[str, Any]
    ) -> TurnArbiterNodeResult:
        """Execute the handoff — update system prompt, etc."""
        state = self.get_or_create_state(session_id)
        state.current_state = TurnState.HANDOFF_ISSUED
        
        # In a real implementation, this would call the Agora ConvoAI interrupt-message API
        # to inject the new persona's system prompt
        
        logger.info(f"[{session_id}] Handoff executed: {state.current_persona} takes the floor")
        
        return TurnArbiterNodeResult(
            next_state=TurnState.AGENT_SPEAKING,
            actions=[
                {"type": "agent_start_speaking", "persona": state.current_persona},
                {"type": "deliver_transition_line", "persona": state.current_persona, "from_persona": state.previous_persona},
            ],
        )

    async def on_agent_speaking_start(
        self, session_id: str, whiteboard: dict[str, Any]
    ) -> TurnArbiterNodeResult:
        """Agent starts speaking."""
        state = self.get_or_create_state(session_id)
        state.agent_speech_active = True
        state.current_state = TurnState.AGENT_SPEAKING
        
        logger.debug(f"[{session_id}] Agent ({state.current_persona}) speaking started")
        
        return TurnArbiterNodeResult(
            next_state=TurnState.AGENT_SPEAKING,
            actions=[{"type": "start_agent_audio"}],
        )

    async def on_agent_speech_end(
        self, session_id: str, whiteboard: dict[str, Any]
    ) -> TurnArbiterNodeResult:
        """Agent finishes speaking — hand control back to candidate."""
        state = self.get_or_create_state(session_id)
        state.agent_speech_active = False
        state.current_state = TurnState.IDLE
        
        logger.debug(f"[{session_id}] Agent speech ended, waiting for candidate")
        
        return TurnArbiterNodeResult(
            next_state=TurnState.IDLE,
            actions=[{"type": "wait_for_candidate", "timeout": 30}],
        )

    async def on_interrupt(
        self, session_id: str, interrupt_type: str, command: str | None = None
    ) -> TurnArbiterNodeResult:
        """Handle candidate interruption (barge-in or keyword)."""
        state = self.get_or_create_state(session_id)
        state.interrupt_requested = True
        state.interrupt_type = interrupt_type
        state.interrupt_command = command
        state.current_state = TurnState.IDLE
        
        if interrupt_type == "speech":
            # Barge-in: stop agent TTS immediately
            logger.info(f"[{session_id}] Speech interrupt detected — stopping agent audio")
            return TurnArbiterNodeResult(
                next_state=TurnState.CANDIDATE_SPEAKING,
                actions=[
                    {"type": "stop_agent_audio", "immediate": True},
                    {"type": "start_listening"},
                ],
                message="Candidate interrupted — listening",
            )
        elif interrupt_type == "keyword":
            # Keyword interrupt: "Hey Panel"
            if command == "repeat":
                return TurnArbiterNodeResult(
                    next_state=TurnState.AGENT_SPEAKING,
                    actions=[{"type": "repeat_last_question"}],
                    message="Repeating last question",
                )
            elif command == "pause":
                return TurnArbiterNodeResult(
                    next_state=TurnState.IDLE,
                    actions=[{"type": "pause_session"}],
                    message="Session paused",
                )
            elif command == "restart":
                return TurnArbiterNodeResult(
                    next_state=TurnState.CANDIDATE_SPEAKING,
                    actions=[{"type": "restart_current_answer"}],
                    message="Restarting answer",
                )
        
        return TurnArbiterNodeResult(
            next_state=TurnState.CANDIDATE_SPEAKING,
            actions=[{"type": "start_listening"}],
        )

    async def on_finalize(
        self, session_id: str, whiteboard: dict[str, Any]
    ) -> TurnArbiterNodeResult:
        """Finalize the interview session."""
        state = self.get_or_create_state(session_id)
        state.current_state = TurnState.FINALIZING
        state.questioning_completed = True
        
        logger.info(f"[{session_id}] Interview finalized — generating report")
        
        return TurnArbiterNodeResult(
            next_state=TurnState.FINALIZING,
            actions=[
                {"type": "end_session", "reason": "completed"},
                {"type": "generate_report", "session_id": session_id},
            ],
        )

    # --- Helper methods ---

    def _next_persona(self, current: str) -> str | None:
        """Get the next persona in the rotation order."""
        try:
            idx = self.PERSONA_ORDER.index(current)
            next_idx = (idx + 1) % len(self.PERSONA_ORDER)
            return self.PERSONA_ORDER[next_idx]
        except ValueError:
            return self.PERSONA_ORDER[0]

    def _count_consecutive_same_persona(self, session_id: str) -> int:
        """Count consecutive turns with the same persona."""
        # This would be tracked in a more sophisticated implementation
        # For now, use turn_count as a proxy
        state = self._session_states.get(session_id)
        if not state:
            return 0
        return state.turn_count

    def get_current_persona(self, session_id: str) -> str:
        """Get the current active persona for a session."""
        state = self._session_states.get(session_id)
        if not state:
            return "technical"
        return state.current_persona

    def is_agent_speaking(self, session_id: str) -> bool:
        """Check if the agent is currently speaking."""
        state = self._session_states.get(session_id)
        if not state:
            return False
        return state.agent_speech_active

    def is_candidate_speaking(self, session_id: str) -> bool:
        """Check if the candidate is currently speaking."""
        state = self._session_states.get(session_id)
        if not state:
            return False
        return state.candidate_speech_active

    def should_accept_interruption(self, session_id: str) -> bool:
        """Check if the system should accept an interruption right now."""
        state = self._session_states.get(session_id)
        if not state:
            return True
        # Accept interruptions when agent is speaking
        return state.agent_speech_active


# Global singleton
_turn_arbiter: TurnArbiter | None = None


def get_turn_arbiter() -> TurnArbiter:
    """Get the turn arbiter singleton."""
    global _turn_arbiter
    if _turn_arbiter is None:
        _turn_arbiter = TurnArbiter()
    return _turn_arbiter
