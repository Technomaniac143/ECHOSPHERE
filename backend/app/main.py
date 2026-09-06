"""EchoSphere — FastAPI Application Entry Point."""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.database import init_db, close_db, get_db_context
from app.api import auth, candidates, organizations, interviews, reports, sessions, analytics
from app.schemas.candidate_schemas import SetupParseRequest
from app.mcp.whiteboard_server import serve as mcp_serve



@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — startup and shutdown."""
    # Startup
    print("=" * 60)
    print("  ECHOSPHERE — Adaptive Multi-Agent AI Voice Interview Platform")
    print("=" * 60)
    
    # Initialize database
    try:
        await init_db()
        print("[OK] Database initialized")
    except Exception as e:
        print(f"[WARN] Database init failed: {e}")
        print("      Set DATABASE_URL to a valid PostgreSQL connection string.")
    
    # Start MCP whiteboard server in background
    import asyncio
    mcp_task = asyncio.create_task(_start_mcp_server())
    
    yield
    
    # Shutdown
    print("\nShutting down EchoSphere...")
    await close_db()
    mcp_task.cancel()
    try:
        await mcp_task
    except asyncio.CancelledError:
        pass
    print("Goodbye.\n")


async def _start_mcp_server():
    """Start the MCP whiteboard server as a background task."""
    try:
        print("[MCP] Whiteboard MCP server starting on port 8001...")
        # The MCP server would be started here
        # For now, it's available as a library
        print("[MCP] Whiteboard MCP server ready (library mode)")
    except Exception as e:
        print(f"[MCP] Failed to start: {e}")


# ── Exception Handlers ──

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors."""
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error.get("loc", []))
        errors.append({
            "field": field or "unknown",
            "message": error.get("msg", "Validation error"),
            "type": error.get("type", "validation_error"),
        })
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation error",
            "errors": errors,
        },
    )


async def global_exception_handler(request: Request, exc: Exception):
    """Handle unhandled exceptions."""
    import logging
    logging.exception(f"Unhandled exception: {exc}")
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": str(exc) if settings.debug else "Something went wrong",
        },
    )


# ── Application ──

app = FastAPI(
    title="EchoSphere API",
    description="Adaptive Multi-Agent AI Voice Interview Platform — Backend API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "https://echosphere.app",
        "https://*.echosphere.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ── Exception handlers ──
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

# ── Routers — all mounted under /api ──
app.include_router(auth.router, prefix="/api")
app.include_router(candidates.router, prefix="/api")
app.include_router(organizations.router, prefix="/api")
app.include_router(interviews.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")

# Direct alias for frontend /api/setup/parse
@app.post("/api/setup/parse", tags=["candidate"])
async def parse_setup_alias(request: SetupParseRequest):
    """Alias for setup parsing endpoint directly at /api/setup/parse."""
    return await candidates.parse_setup(request)

# ── Health check ──

@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "echosphere-api",
        "version": "1.0.0",
    }


@app.get("/ready", tags=["health"])
async def readiness_check():
    """Readiness check — verifies database connectivity."""
    try:
        async with get_db_context() as db:
            from sqlalchemy import text
            await db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "error": str(e)},
        )


# ── Root ──
@app.get("/", tags=["root"])
async def root():
    """API root — redirects to docs."""
    return {
        "name": "EchoSphere API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug,
    )
