#!/usr/bin/env python3
"""Tests for npm_search module."""

import pytest
from npm_search import (
    search_npm_packages,
    format_search_results,
    NpmPackageInfo,
    MIN_WEEKLY_DOWNLOADS,
    BLOCKLIST,
)


@pytest.mark.asyncio
async def test_search_popular_package():
    """Search for a known popular package returns results."""
    results = await search_npm_packages("three.js 3d", limit=3)

    assert len(results) > 0
    assert any(r.passed_validation for r in results)


@pytest.mark.asyncio
async def test_search_react_three():
    """Search for React Three Fiber ecosystem packages."""
    results = await search_npm_packages("react three fiber drei", limit=5)

    valid = [r for r in results if r.passed_validation]
    assert len(valid) > 0

    # Should find drei or fiber
    names = [r.name for r in valid]
    assert any("drei" in n or "fiber" in n for n in names)


@pytest.mark.asyncio
async def test_blocklist_rejection():
    """Blocklisted packages should be rejected."""
    # Pick a blocklisted package
    blocklisted = list(BLOCKLIST)[0]
    results = await search_npm_packages(blocklisted, limit=5)

    for r in results:
        if r.name == blocklisted:
            assert not r.passed_validation
            assert "blocklist" in r.rejection_reason.lower()


@pytest.mark.asyncio
async def test_download_threshold():
    """Packages below download threshold should be rejected."""
    # Search for something very specific/obscure
    results = await search_npm_packages("xyzzy-test-pkg-unlikely-12345", limit=3)

    for r in results:
        if r.weekly_downloads < MIN_WEEKLY_DOWNLOADS:
            assert not r.passed_validation
            assert "download" in r.rejection_reason.lower()


def test_format_results_empty():
    """Empty results should return appropriate message."""
    output = format_search_results([])
    assert "No packages found" in output


def test_format_results_valid():
    """Valid packages should show install command."""
    pkg = NpmPackageInfo(
        name="test-pkg",
        version="1.0.0",
        description="A test package",
        weekly_downloads=5000,
        last_publish="2026-01-01",
        install_command="npm install test-pkg",
        passed_validation=True,
    )

    output = format_search_results([pkg])

    assert "[+]" in output
    assert "test-pkg" in output
    assert "npm install" in output
    assert "VALID" in output


def test_format_results_rejected():
    """Rejected packages should show reason."""
    pkg = NpmPackageInfo(
        name="bad-pkg",
        version="0.0.1",
        description="A bad package",
        weekly_downloads=50,
        last_publish="2020-01-01",
        install_command="npm install bad-pkg",
        passed_validation=False,
        rejection_reason="Too few downloads",
    )

    output = format_search_results([pkg])

    assert "[x]" in output
    assert "REJECTED" in output
    assert "Too few downloads" in output
