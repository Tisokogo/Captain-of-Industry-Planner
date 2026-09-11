#!/usr/bin/env python3
"""Build or verify the reproducible runtime-data manifest."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
FILES = [
    "categories.json",
    "machines.json",
    "products.json",
    "recipes.json",
    "recipe-progression.json",
    "product-capabilities.json",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    manifest = {
        "schemaVersion": 1,
        "gameData": {
            "version": "v0.8.2c",
            "release": "Update 4",
            "compatibilityClaim": "v0.8.x",
            "compatibilityVerifiedThrough": "v0.8.2c",
            "latestKnownGameVersion": "v0.8.7b",
            "latestKnownVersionDate": "2026-08-22",
            "currentVersionExportAvailable": False,
        },
        "source": {
            "project": "David-Melo/captains-calculator",
            "url": "https://github.com/David-Melo/captains-calculator",
            "commit": None,
            "exportedAt": None,
        },
        "progressionReference": {
            "release": "Update 3",
            "path": "scripts/reference-update3.json",
            "sha256": sha256(ROOT / "scripts" / "reference-update3.json"),
            "role": "fallback mapping reference; direct and signature matches are recorded per recipe",
        },
        "transformVersion": 1,
        "licenseStatus": "Source repository and game-asset licenses require release review",
        "files": {
            name: {"sha256": sha256(DATA / name), "bytes": (DATA / name).stat().st_size}
            for name in FILES
        },
    }
    text = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    target = DATA / "data-manifest.json"
    if args.check:
        if not target.exists() or target.read_text() != text:
            parser.error("src/data/data-manifest.json is stale; run npm run build:data-manifest")
    else:
        target.write_text(text)
        print(f"Wrote {target.relative_to(ROOT)} with {len(FILES)} file hashes")


if __name__ == "__main__":
    main()
