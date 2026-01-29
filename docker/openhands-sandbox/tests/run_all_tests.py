#!/usr/bin/env python3
"""
Master test runner for all OpenHands tools and workflows.

This script runs all tests in the correct order:
1. Unit tests (no API required)
2. Root generator tests (no API required)
3. SDK import tests (no API required, but requires OpenHands SDK)
4. Integration tests (API key optional, some tests skipped without)

Run with:
  python tests/run_all_tests.py

Or with pytest:
  pytest tests/ -v
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def print_header(title: str):
    """Print a section header."""
    print("\n" + "=" * 70)
    print(f" {title}")
    print("=" * 70 + "\n")


def run_test_module(module_name: str, run_func_name: str = "run_all_tests") -> tuple[bool, int, int, int]:
    """Run tests from a module.

    Returns: (success, passed, failed, skipped)
    """
    try:
        module = __import__(module_name)
        run_func = getattr(module, run_func_name)
        success = run_func()
        return success, 0, 0, 0  # Counts are printed by the modules
    except Exception as e:
        print(f"Error running {module_name}: {e}")
        return False, 0, 1, 0


def main():
    """Run all tests."""
    print_header("OpenHands Tools & Workflow Test Suite")

    # Check for API keys
    api_key = (
        os.environ.get("GEMINI_API_KEY") or
        os.environ.get("ANTHROPIC_API_KEY") or
        os.environ.get("OPENAI_API_KEY") or
        os.environ.get("LLM_API_KEY")
    )

    print("Environment:")
    print(f"  Python: {sys.version.split()[0]}")
    print(f"  Working dir: {os.getcwd()}")
    print(f"  API key: {'Found' if api_key else 'Not found (some tests will be skipped)'}")

    # Try to check if OpenHands SDK is available
    sdk_available = False
    try:
        import openhands.sdk
        sdk_available = True
        print(f"  OpenHands SDK: Available")
    except ImportError:
        print(f"  OpenHands SDK: Not installed (SDK tests will be skipped)")

    results = []

    # Test 1: Unit tests for tools (no API required)
    print_header("1. Tool Unit Tests (No API Required)")
    try:
        from test_tools_unit import run_all_tests as run_tool_tests
        success = run_tool_tests()
        results.append(("Tool Unit Tests", success))
    except Exception as e:
        print(f"Error: {e}")
        results.append(("Tool Unit Tests", False))

    # Test 2: Root generator tests (no API required)
    print_header("2. Root Generator Tests (No API Required)")
    try:
        from test_root_generator import run_all_tests as run_root_tests
        success = run_root_tests()
        results.append(("Root Generator Tests", success))
    except Exception as e:
        print(f"Error: {e}")
        results.append(("Root Generator Tests", False))

    # Test 3: SDK import tests (requires OpenHands SDK)
    if sdk_available:
        print_header("3. SDK Import Tests (Requires OpenHands SDK)")
        try:
            from test_sdk_imports import run_all_tests as run_sdk_tests
            success = run_sdk_tests()
            results.append(("SDK Import Tests", success))
        except Exception as e:
            print(f"Error: {e}")
            results.append(("SDK Import Tests", False))
    else:
        print_header("3. SDK Import Tests (SKIPPED - SDK not installed)")
        results.append(("SDK Import Tests", None))

    # Test 4: Integration tests (API key optional)
    print_header("4. Integration Tests (API Key Optional)")
    try:
        from test_integration import run_all_tests as run_integration_tests
        success = run_integration_tests()
        results.append(("Integration Tests", success))
    except Exception as e:
        print(f"Error: {e}")
        results.append(("Integration Tests", False))

    # Final summary
    print_header("Final Summary")

    all_passed = True
    for name, success in results:
        if success is None:
            status = "⊘ SKIPPED"
        elif success:
            status = "✓ PASSED"
        else:
            status = "✗ FAILED"
            all_passed = False
        print(f"  {status}: {name}")

    print()
    if all_passed:
        print("All tests passed! ✓")
    else:
        print("Some tests failed. ✗")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
