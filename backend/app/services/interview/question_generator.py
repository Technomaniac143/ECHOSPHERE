"""Dynamic question generation service."""
import logging
from datetime import datetime, timezone
from typing import Any

from app.models.whiteboard import WhiteboardState, WhiteboardEventType
from app.schemas.interview import QuestionResponse, QuestionGenerationRequest


logger = logging.getLogger("question-generator")


# Seed questions by competency and difficulty
SEED_QUESTIONS: dict[str, dict[str, list[str]]] = {
    "Technical": {
        "beginner": [
            "What is the difference between a list and a tuple in Python?",
            "Explain what a REST API is in simple terms.",
            "What is a database index and why is it useful?",
        ],
        "easy": [
            "How would you find the first duplicate in an array?",
            "Explain the difference between SQL and NoSQL databases.",
            "What is the purpose of a load balancer?",
        ],
        "medium": [
            "Design a rate limiter for an API. What data structures would you use?",
            "How would you design a URL shortening service like bit.ly?",
            "Explain how Redis can be used to improve database performance.",
        ],
        "hard": [
            "Design a distributed cache invalidation system. How do you ensure consistency?",
            "How would you build a real-time notification system for millions of users?",
            "Design a system that handles 100k requests per second with 99.99% availability.",
        ],
        "expert": [
            "How would you design a globally distributed database with strong consistency?",
            "Explain the trade-offs between eventual consistency and strong consistency in a distributed system.",
            "Design a system that can survive region-level failures without data loss.",
        ],
    },
    "Problem Solving": {
        "beginner": [
            "A user reports a bug but can't reproduce it consistently. How would you approach debugging?",
            "You have two solutions to a problem — one simple and one complex. How do you choose?",
        ],
        "easy": [
            "How do you approach understanding a large, unfamiliar codebase?",
            "Describe a time you had to make a technical decision with incomplete information.",
        ],
        "medium": [
            "You discover a critical bug in production on a Friday evening. Walk me through your approach.",
            "How do you balance technical debt against feature development?",
        ],
        "hard": [
            "Your team disagrees strongly on a technical approach. How do you facilitate resolution?",
            "You need to migrate a monolithic system to microservices with zero downtime. How do you plan it?",
        ],
        "expert": [
            "A critical system has been running for 5 years with no documentation and the original team is gone. What's your approach?",
            "How do you identify and prioritize systemic vs. one-off problems in a large engineering organization?",
        ],
    },
    "Communication": {
        "beginner": [
            "Explain a technical concept from your domain to someone without a technical background.",
            "How do you ensure your team understands your technical decisions?",
        ],
        "easy": [
            "Describe a time you had to explain a complex technical issue to a non-technical stakeholder.",
            "How do you document your work for future reference?",
        ],
        "medium": [
            "Tell me about a time your communication prevented a major issue.",
            "How do you handle code reviews — both giving and receiving feedback?",
        ],
        "hard": [
            "You need to convince leadership to invest in refactoring instead of new features. How do you make your case?",
            "Describe a time you had to deliver bad news to your team or stakeholders.",
        ],
        "expert": [
            "How do you build a culture of clear technical communication across a large organization?",
            "You're leading a project with engineers from 3 different teams who speak different technical languages. How do you align everyone?",
        ],
    },
    "Product Thinking": {
        "beginner": [
            "Who do you think is the user of the product you're building?",
            "What makes a feature 'valuable' to a user?",
        ],
        "easy": [
            "How would you prioritize features if you could only ship one this quarter?",
            "What metrics would you track for a new feature launch?",
        ],
        "medium": [
            "You have data showing users drop off at a specific step in your funnel. What's your investigation approach?",
            "How do you balance what users say they want vs. what they actually need?",
        ],
        "hard": [
            "Design a pricing model for a B2B SaaS product. What factors do you consider?",
            "Your product has high engagement but low retention. What hypotheses would you investigate?",
        ],
        "expert": [
            "How would you decide whether to build or buy a critical piece of infrastructure?",
            "You're given a goal to increase user engagement by 30% in 6 months. What's your product strategy?",
        ],
    },
    "Leadership": {
        "beginner": [
            "Describe a time you took ownership of a problem that wasn't technically your responsibility.",
            "What does 'ownership' mean to you in a software engineering context?",
        ],
        "easy": [
            "Tell me about a time you had to make a decision without complete consensus.",
            "How do you help a teammate who's struggling with a technical concept?",
        ],
        "medium": [
            "Describe a time you had to lead a project where the outcome was uncertain.",
            "How do you handle a situation where a team member consistently misses deadlines?",
        ],
        "hard": [
            "You're asked to lead a project that's behind schedule and over budget. How do you approach it?",
            "A key team member wants to leave. How do you handle the situation while maintaining team morale?",
        ],
        "expert": [
            "How do you build and maintain engineering culture across a growing team?",
            "You need to make a strategic hiring decision that conflicts with what your team wants. How do you handle it?",
        ],
    },
    "Behavioral": {
        "beginner": [
            "Tell me about a time you failed at something and what you learned.",
            "Describe a situation where you had to work with someone you disagreed with.",
        ],
        "easy": [
            "Tell me about a time you had to learn a new technology quickly.",
            "Describe a time you went above and beyond for a project.",
        ],
        "medium": [
            "Tell me about a time you received difficult feedback. How did you respond?",
            "Describe a time when a project didn't go as planned. What happened?",
        ],
        "hard": [
            "Tell me about a time you had to make an ethical decision at work.",
            "Describe a situation where you had to work with a difficult stakeholder.",
        ],
        "expert": [
            "Tell me about a time you had to change your approach mid-project. What triggered the change?",
            "Describe your most challenging professional relationship and how you managed it.",
        ],
    },
    "Adaptability": {
        "beginner": [
            "Tell me about a time requirements changed significantly during a project.",
            "How do you handle working on tasks outside your comfort zone?",
        ],
        "easy": [
            "Describe a time you had to quickly adapt to a new tool or process.",
            "Tell me about a time you had to pivot your approach based on new information.",
        ],
        "medium": [
            "You're assigned to a project in a domain you know nothing about. How do you get up to speed?",
            "Describe a time you had to abandon a solution you'd invested significant effort in.",
        ],
        "hard": [
            "Your team's technology stack is being deprecated. How do you handle the transition?",
            "Describe a time you had to deliver results in a highly ambiguous environment.",
        ],
        "expert": [
            "How do you stay current with evolving technology while delivering on your core responsibilities?",
            "Describe a time organizational change significantly impacted your work. How did you adapt?",
        ],
    },
}

# Role-specific question emphasis
ROLE_EMPHASIS: dict[str, list[str]] = {
    "Backend Engineer": ["Technical", "Problem Solving"],
    "Frontend Developer": ["Technical", "Communication"],
    "Full Stack Developer": ["Technical", "Problem Solving", "Communication"],
    "Data Scientist": ["Problem Solving", "Technical"],
    "DevOps Engineer": ["Technical", "Adaptability", "Problem Solving"],
    "Product Manager": ["Product Thinking", "Communication", "Leadership"],
    "Software Engineer": ["Technical", "Problem Solving", "Communication"],
    "default": ["Technical", "Problem Solving", "Communication", "Product Thinking", "Leadership", "Behavioral"],
}


class QuestionGenerator:
    """Generates dynamic interview questions based on whiteboard state."""

    def __init__(self):
        self._session_question_history: dict[str, set[str]] = {}
        self._session_last_persona: dict[str, str] = {}

    def generate_question(
        self,
        request: QuestionGenerationRequest,
    ) -> QuestionResponse:
        """Generate a question based on the current state."""
        session_id = request.session_id
        current_persona = request.current_persona
        whiteboard = request.whiteboard_state
        difficulty_state = request.difficulty_state
        previous_questions = request.previous_questions or []
        candidate_context = request.candidate_context

        # Determine which competency to focus on
        competency = self._select_competency(
            current_persona,
            difficulty_state,
            whiteboard,
            candidate_context,
        )

        # Determine difficulty level
        difficulty = self._select_difficulty(
            competency,
            difficulty_state,
            whiteboard,
        )

        # Get candidate's target role for emphasis
        target_role = candidate_context.get("target_role", "default") if candidate_context else "default"

        # Select a question
        question = self._select_question(
            competency,
            difficulty,
            previous_questions,
            session_id,
            target_role,
        )

        # Generate follow-up prompt based on context
        follow_up = self._generate_follow_up(
            competency,
            difficulty,
            whiteboard,
            current_persona,
        )

        # Build reasoning for the candidate
        reasoning = self._build_reasoning(
            competency,
            difficulty,
            current_persona,
            whiteboard,
        )

        # Track the question
        if session_id not in self._session_question_history:
            self._session_question_history[session_id] = set()
        self._session_question_history[session_id].add(question)

        self._session_last_persona[session_id] = current_persona

        return QuestionResponse(
            question=question,
            competency=competency,
            difficulty=difficulty,
            follow_up_prompt=follow_up,
            persona=current_persona,
            reasoning=reasoning,
        )

    def _select_competency(
        self,
        current_persona: str,
        difficulty_state: dict[str, Any],
        whiteboard: dict[str, Any],
        candidate_context: dict[str, Any],
    ) -> str:
        """Select which competency to assess next."""
        # Map persona to primary competency
        persona_competency_map = {
            "technical": "Technical",
            "product": "Product Thinking",
            "hiring_manager": "Leadership",
            "behavioral": "Behavioral",
            "customer": "Product Thinking",
        }

        primary = persona_competency_map.get(current_persona, "Technical")

        # Check for open threads that suggest another competency
        open_threads = whiteboard.get("open_threads", [])
        if open_threads:
            for thread in open_threads:
                hint = thread.get("assigned_persona_hint", "")
                if hint and hint != current_persona:
                    # Thread is assigned to another persona — they'll handle it
                    pass

        # Check difficulty state for underutilized competencies
        competencies = list(difficulty_state.keys())
        if competencies:
            # Find competency with lowest difficulty that hasn't been assessed much
            scored_competencies = whiteboard.get("competency_ledger", {})
            for comp in competencies:
                if comp not in scored_competencies or scored_competencies[comp].get("score", 0) < 50:
                    if comp != primary:
                        return comp

        return primary

    def _select_difficulty(
        self,
        competency: str,
        difficulty_state: dict[str, Any],
        whiteboard: dict[str, Any],
    ) -> str:
        """Select difficulty level for a competency."""
        # Get current difficulty for this competency
        current = difficulty_state.get(competency, "medium")

        # Check competency ledger for performance
        ledger = whiteboard.get("competency_ledger", {})
        comp_data = ledger.get(competency, {})

        if isinstance(comp_data, dict):
            score = comp_data.get("score", 50)
            # If score is high, increase difficulty; if low, decrease
            if score >= 80:
                difficulties = ["beginner", "easy", "medium", "hard", "expert"]
                idx = difficulties.index(current) if current in difficulties else 2
                if idx < len(difficulties) - 1:
                    return difficulties[idx + 1]
            elif score < 40:
                difficulties = ["beginner", "easy", "medium", "hard", "expert"]
                idx = difficulties.index(current) if current in difficulties else 2
                if idx > 0:
                    return difficulties[idx - 1]

        return current

    def _select_question(
        self,
        competency: str,
        difficulty: str,
        previous_questions: list[str],
        session_id: str,
        target_role: str,
    ) -> str:
        """Select a specific question."""
        # Get questions for this competency and difficulty
        questions = SEED_QUESTIONS.get(competency, {}).get(difficulty, [])
        
        if not questions:
            # Fallback to medium difficulty
            questions = SEED_QUESTIONS.get(competency, {}).get("medium", [])
        
        if not questions:
            # Ultimate fallback
            questions = [
                f"Tell me about your experience with {competency.lower()}.",
            ]

        # Filter out previously asked questions
        available = [q for q in questions if q not in previous_questions]

        if not available:
            # All questions asked — generate a variation
            base = questions[0] if questions else f"Tell me about {competency.lower()}."
            variation = self._vary_question(base, competency)
            return variation

        # Prefer role-relevant questions
        role_questions = self._get_role_relevant_questions(target_role, competency, difficulty)
        if role_questions:
            role_available = [q for q in role_questions if q not in previous_questions]
            if role_available:
                return role_available[0]

        # Random selection from available
        import random
        return random.choice(available)

    def _vary_question(self, base: str, competency: str) -> str:
        """Create a variation of a question."""
        variations = [
            f"Can you elaborate on {base.lower().rstrip('?')}?",
            f"How would you approach {base.lower().lstrip('tell me about ').lstrip('explain ').rstrip('?')}?",
            f"What's your perspective on {base.lower().rstrip('?')}?",
        ]
        import random
        return random.choice(variations)

    def _get_role_relevant_questions(
        self,
        target_role: str,
        competency: str,
        difficulty: str,
    ) -> list[str]:
        """Get questions relevant to a specific role."""
        emphasis = ROLE_EMPHASIS.get(target_role, ROLE_EMPHASIS["default"])
        
        if competency not in emphasis:
            return []
        
        return SEED_QUESTIONS.get(competency, {}).get(difficulty, [])

    def _generate_follow_up(
        self,
        competency: str,
        difficulty: str,
        whiteboard: dict[str, Any],
        current_persona: str,
    ) -> str | None:
        """Generate a follow-up prompt based on context."""
        open_threads = whiteboard.get("open_threads", [])
        
        if open_threads:
            for thread in open_threads:
                hint = thread.get("assigned_persona_hint", "")
                if hint == current_persona:
                    return f"Also, there's an outstanding thread: {thread.get('description', '')}. Feel free to address it."
        
        # Check for contradictions
        contradictions = whiteboard.get("contradiction_flags", [])
        if contradictions:
            return "I noticed some inconsistencies in earlier answers. Be sure to clarify any contradictions."

        return None

    def _build_reasoning(
        self,
        competency: str,
        difficulty: str,
        current_persona: str,
        whiteboard: dict[str, Any],
    ) -> str:
        """Build reasoning for why this question was selected."""
        ledger = whiteboard.get("competency_ledger", {})
        comp_data = ledger.get(competency, {})
        
        score = comp_data.get("score", 50) if isinstance(comp_data, dict) else 50
        
        persona_names = {
            "technical": "Technical Interviewer",
            "product": "Product Manager",
            "hiring_manager": "Hiring Manager",
            "behavioral": "Behavioral Interviewer",
            "customer": "Customer Representative",
        }
        
        persona_name = persona_names.get(current_persona, "Interviewer")
        
        if score >= 70:
            reason = f"{persona_name} sees strong performance in {competency.lower()} and wants to explore it at a deeper level."
        elif score < 40:
            reason = f"{persona_name} noticed some gaps in {competency.lower()} and wants to start with foundational concepts before building up."
        else:
            reason = f"{persona_name} is assessing your {competency.lower()} at the current level."
        
        return reason


# Singleton instance
_question_generator = QuestionGenerator()


def get_question_generator() -> QuestionGenerator:
    """Get the question generator singleton."""
    return _question_generator
