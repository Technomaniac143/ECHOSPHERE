"""
Build verification: Test that all EchoSphere backend services import correctly.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

errors = []
successes = []

def check_import(module_path, import_name):
    """Try to import a module and report result."""
    try:
        __import__(import_name)
        successes.append(f"✓ {module_path}")
        return True
    except Exception as e:
        errors.append(f"✗ {module_path}: {type(e).__name__}: {e}")
        return False

# Agora service
check_import("agora/types.py", "app.services.agora.types")
check_import("agora/token_service.py", "app.services.agora.token_service")
check_import("agora/conversation_service.py", "app.services.agora.conversation_service")
check_import("agora/recording_service.py", "app.services.agora.recording_service")
check_import("agora/__init__.py", "app.services.agora")

# Gemini service
check_import("gemini/client.py", "app.services.gemini.client")
check_import("gemini/setup_agent.py", "app.services.gemini.setup_agent")
check_import("gemini/integrity_checks.py", "app.services.gemini.integrity_checks")
check_import("gemini/vagueness_detection.py", "app.services.gemini.vagueness_detection")
check_import("gemini/contradiction_detection.py", "app.services.gemini.contradiction_detection")
check_import("gemini/__init__.py", "app.services.gemini")

# Interview service
check_import("interview/manager.py", "app.services.interview.manager")
check_import("interview/question_generator.py", "app.services.interview.question_generator")
check_import("interview/__init__.py", "app.services.interview")

# Integrity service
check_import("integrity/service.py", "app.services.integrity.service")
check_import("integrity/__init__.py", "app.services.integrity")

# Reporting service
check_import("reporting/generator.py", "app.services.reporting.generator")
check_import("reporting/scoring.py", "app.services.reporting.scoring")
check_import("reporting/__init__.py", "app.services.reporting")

# Email service
check_import("email/service.py", "app.services.email.service")
check_import("email/__init__.py", "app.services.email")

# Print results
print("=" * 60)
print("ECHO SPHERE BACKEND SERVICES — IMPORT VERIFICATION")
print("=" * 60)

print("\n--- SUCCESSES ---")
for s in successes:
    print(s)

if errors:
    print("\n--- FAILURES ---")
    for e in errors:
        print(e)

print(f"\n{'='*60}")
print(f"Total: {len(successes)} OK, {len(errors)} FAILED")
print(f"{'='*60}")

if errors:
    sys.exit(1)
else:
    print("\n✓ All services imported successfully!")
    sys.exit(0)
