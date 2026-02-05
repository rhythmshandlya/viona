#!/usr/bin/env python3
"""
NPM Package Search Tool

Searches npm registry and validates packages before allowing installation.
Used by the visual generator agent to discover specialized animation packages.
"""

import aiohttp
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

NPM_SEARCH_URL = "https://registry.npmjs.org/-/v1/search"
NPM_DOWNLOADS_URL = "https://api.npmjs.org/downloads/point/last-week"

MIN_WEEKLY_DOWNLOADS = 1000
MAX_STALE_DAYS = 365

# Known malicious or problematic packages
BLOCKLIST = {
    "node-ipc",
    "colors",
    "faker",
    "event-stream",
    "flatmap-stream",
    "rc",
    "ua-parser-js",  # Had malicious version
    "coa",  # Had malicious version
}


@dataclass
class NpmPackageInfo:
    """Information about an npm package."""
    name: str
    version: str
    description: str
    weekly_downloads: int
    last_publish: str
    install_command: str
    passed_validation: bool
    rejection_reason: Optional[str] = None


async def search_npm_packages(
    query: str,
    limit: int = 5,
) -> list[NpmPackageInfo]:
    """
    Search npm for packages matching query, with validation.

    Args:
        query: Search terms (e.g., "3d dice physics")
        limit: Maximum validated packages to return

    Returns:
        List of NpmPackageInfo, validated packages first
    """
    async with aiohttp.ClientSession() as session:
        # Search npm registry
        params = {"text": query, "size": limit * 3}
        try:
            async with session.get(NPM_SEARCH_URL, params=params, timeout=10) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
        except Exception as e:
            print(f"[npm_search] Search error: {e}")
            return []

        results = []
        valid_count = 0

        for obj in data.get("objects", []):
            pkg = obj.get("package", {})

            info = await _validate_package(session, pkg)
            results.append(info)

            if info.passed_validation:
                valid_count += 1
                if valid_count >= limit:
                    break

        # Sort: validated first, then by downloads
        return sorted(
            results,
            key=lambda x: (not x.passed_validation, -x.weekly_downloads)
        )


async def _validate_package(
    session: aiohttp.ClientSession,
    pkg: dict,
) -> NpmPackageInfo:
    """Validate a single package against criteria."""

    name = pkg.get("name", "")
    version = pkg.get("version", "")
    description = (pkg.get("description") or "")[:200]
    last_publish = (pkg.get("date") or "")[:10]

    # Fetch download counts
    weekly_downloads = 0
    try:
        url = f"{NPM_DOWNLOADS_URL}/{name}"
        async with session.get(url, timeout=5) as resp:
            if resp.status == 200:
                dl_data = await resp.json()
                weekly_downloads = dl_data.get("downloads", 0)
    except Exception:
        pass

    # Run validation checks
    rejection = None

    if name in BLOCKLIST:
        rejection = "Package is blocklisted (known malicious)"
    elif weekly_downloads < MIN_WEEKLY_DOWNLOADS:
        rejection = f"Too few downloads ({weekly_downloads:,}/week, need {MIN_WEEKLY_DOWNLOADS:,}+)"
    elif last_publish:
        try:
            pub_date = datetime.fromisoformat(last_publish)
            days_old = (datetime.now() - pub_date).days
            if days_old > MAX_STALE_DAYS:
                rejection = f"Stale package (last updated {last_publish})"
        except ValueError:
            pass

    return NpmPackageInfo(
        name=name,
        version=version,
        description=description,
        weekly_downloads=weekly_downloads,
        last_publish=last_publish,
        install_command=f"npm install {name}",
        passed_validation=rejection is None,
        rejection_reason=rejection,
    )


def format_search_results(results: list[NpmPackageInfo]) -> str:
    """Format search results for display to the agent."""
    if not results:
        return "No packages found matching query."

    output = []
    for pkg in results:
        status = "VALID" if pkg.passed_validation else "REJECTED"
        marker = "+" if pkg.passed_validation else "x"

        lines = [
            f"[{marker}] {pkg.name}@{pkg.version} [{status}]",
            f"    {pkg.description}",
            f"    Downloads: {pkg.weekly_downloads:,}/week | Updated: {pkg.last_publish}",
        ]

        if pkg.passed_validation:
            lines.append(f"    Install: {pkg.install_command}")
        else:
            lines.append(f"    Reason: {pkg.rejection_reason}")

        output.append("\n".join(lines))

    return "\n\n".join(output)


# CLI for testing
if __name__ == "__main__":
    import asyncio
    import sys

    async def main():
        query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "react three fiber"
        print(f"Searching for: {query}\n")
        results = await search_npm_packages(query)
        print(format_search_results(results))

    asyncio.run(main())
