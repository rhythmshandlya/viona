#!/usr/bin/env python3
"""
Tests for OpenHands SDK integration.

Run these tests inside the Docker container:
  docker run --rm --entrypoint python clipify-openhands-sandbox:latest -m pytest /opt/openhands/tests/ -v

Or run individual tests:
  docker run --rm --entrypoint python clipify-openhands-sandbox:latest /opt/openhands/tests/test_sdk_imports.py
"""

import sys
from pathlib import Path


def test_sdk_core_imports():
    """Test that core SDK imports work."""
    from openhands.sdk import (
        Agent,
        AgentContext,
        Conversation,
        LLM,
        Tool,
        Action,
        Observation,
        TextContent,
        ImageContent,
        ToolDefinition,
        register_tool,
    )
    print("✓ Core SDK imports successful")


def test_skill_import():
    """Test that Skill can be imported from correct module."""
    from openhands.sdk.context.skills.skill import Skill

    # Test creating a skill
    skill = Skill(name="test-skill", content="Test content")
    assert skill.name == "test-skill"
    assert skill.content == "Test content"
    print("✓ Skill import and creation successful")


def test_tool_imports():
    """Test that built-in tools can be imported."""
    from openhands.tools.file_editor import FileEditorTool
    from openhands.tools.task_tracker import TaskTrackerTool
    from openhands.tools.terminal import TerminalTool, TerminalExecutor

    assert hasattr(FileEditorTool, 'name')
    assert hasattr(TaskTrackerTool, 'name')
    assert hasattr(TerminalTool, 'name')
    print("✓ Built-in tool imports successful")


def test_custom_tools_imports():
    """Test that custom tools can be imported."""
    # Add the tools directory to path
    tools_dir = Path(__file__).parent.parent / "tools"
    if str(tools_dir) not in sys.path:
        sys.path.insert(0, str(tools_dir.parent))

    from tools.typescript_validator import (
        TypeScriptValidatorTool,
        TypeScriptValidatorAction,
        TypeScriptValidatorObservation,
    )
    from tools.remotion_bundle import (
        RemotionBundleTool,
        RemotionBundleAction,
        RemotionBundleObservation,
    )
    from tools.remotion_render_still import (
        RemotionRenderStillTool,
        RemotionRenderStillAction,
        RemotionRenderStillObservation,
    )
    from tools.write_file import (
        WriteFileTool,
        WriteFileAction,
        WriteFileObservation,
    )
    from tools.diff_patch import (
        DiffPatchTool,
        DiffPatchAction,
        DiffPatchObservation,
    )
    from tools.root_generator import (
        scan_compositions,
        generate_root_tsx,
        generate_and_write_root,
        CompositionInfo,
    )

    assert TypeScriptValidatorTool.name == "TypeScriptValidatorTool"
    assert RemotionBundleTool.name == "RemotionBundleTool"
    assert RemotionRenderStillTool.name == "RemotionRenderStillTool"
    assert WriteFileTool.name == "WriteFileTool"
    assert DiffPatchTool.name == "DiffPatchTool"
    assert callable(scan_compositions)
    assert callable(generate_root_tsx)
    print("✓ Custom tool imports successful")


def test_visual_generator_imports():
    """Test that visual_generator.py can be imported without errors."""
    # Add the parent directory to path
    generator_dir = Path(__file__).parent.parent
    if str(generator_dir) not in sys.path:
        sys.path.insert(0, str(generator_dir))

    # Import just the functions, not run main
    import visual_generator

    assert hasattr(visual_generator, 'emit_event')
    assert hasattr(visual_generator, 'load_skill')
    assert hasattr(visual_generator, 'create_generator_agent')
    assert hasattr(visual_generator, 'create_visual_evaluator_agent')
    assert hasattr(visual_generator, 'run_generator_with_self_healing')
    assert hasattr(visual_generator, 'run_visual_evaluation')
    assert hasattr(visual_generator, 'run_typescript_check')
    assert hasattr(visual_generator, 'auto_generate_root_tsx')
    print("✓ visual_generator.py import successful")


def test_skill_loading():
    """Test that skills can be loaded from disk."""
    from openhands.sdk import load_skills_from_dir

    skills_dir = Path(__file__).parent.parent / "skills"
    if skills_dir.exists():
        repo_skills, knowledge_skills, agent_skills = load_skills_from_dir(skills_dir)
        print(f"  Loaded {len(repo_skills)} repo skills, {len(knowledge_skills)} knowledge skills, {len(agent_skills)} agent skills")
    print("✓ Skill loading successful")


def test_agent_context_with_skills():
    """Test creating AgentContext with skills."""
    from openhands.sdk import AgentContext
    from openhands.sdk.context.skills.skill import Skill

    skills = [
        Skill(name="test-skill-1", content="Content 1"),
        Skill(name="test-skill-2", content="Content 2"),
    ]

    context = AgentContext(skills=skills)
    assert len(context.skills) == 2
    print("✓ AgentContext with skills successful")


def test_tool_registration():
    """Test registering custom tools."""
    from openhands.sdk import register_tool, list_registered_tools

    def dummy_tool_factory(conv_state):
        return []

    register_tool("DummyTestTool", dummy_tool_factory)

    # Verify it's registered
    registered = list_registered_tools()
    assert "DummyTestTool" in registered
    print("✓ Tool registration successful")


def test_submit_score_module():
    """Test the submit score module for storing scores."""
    # Add path
    generator_dir = Path(__file__).parent.parent
    if str(generator_dir) not in sys.path:
        sys.path.insert(0, str(generator_dir))

    from tools.submit_score import get_last_score, clear_last_score, set_last_score

    # Test clear and get
    clear_last_score()
    assert get_last_score() is None

    # Test set and get
    test_score = {
        "score": 85,
        "visual_quality": 60,
        "correctness": 10,
        "completeness": 10,
        "code_quality": 5,
        "issues": ["test issue"],
        "suggestion": "fix it"
    }
    set_last_score(test_score)
    result = get_last_score()
    assert result["score"] == 85
    assert result["visual_quality"] == 60

    # Clean up
    clear_last_score()
    print("✓ Submit score module successful")


def run_all_tests():
    """Run all tests and report results."""
    tests = [
        test_sdk_core_imports,
        test_skill_import,
        test_tool_imports,
        test_custom_tools_imports,
        test_visual_generator_imports,
        test_skill_loading,
        test_agent_context_with_skills,
        test_tool_registration,
        test_submit_score_module,
    ]

    passed = 0
    failed = 0

    print("\n" + "=" * 60)
    print("OpenHands SDK Integration Tests")
    print("=" * 60 + "\n")

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"✗ {test.__name__} FAILED: {e}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
