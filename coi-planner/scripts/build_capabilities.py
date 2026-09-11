#!/usr/bin/env python3
"""Generate auditable product route and source capabilities from normalized data."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
OVERRIDES = ROOT / "scripts" / "capability-overrides.json"


def load(path: Path):
    return json.loads(path.read_text())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail if generated capability artifacts are not up to date",
    )
    args = parser.parse_args()
    products = load(DATA / "products.json")
    recipes = load(DATA / "recipes.json")
    machines = load(DATA / "machines.json")
    progression = load(DATA / "recipe-progression.json")
    overrides = load(OVERRIDES)
    machine_disposition = overrides["machineDisposition"]
    storage_transport = overrides["storageTransport"]
    extraction_machines = set(overrides["extractionMachines"])
    importable_products = set(overrides["importableProducts"])

    result = {}
    distribution = Counter()
    for product_id, product in products.items():
        routes = {
            "storage": [],
            "further-processing": [],
            "export": [],
            "dump": [],
            "flare": [],
            "wastewater": [],
        }
        storage_facilities = []
        transport_types = set()
        for recipe_id in product.get("recipes", {}).get("input", []):
            recipe = recipes.get(recipe_id)
            if not recipe:
                continue
            machine = machines.get(recipe["machine"], {})
            kind = machine_disposition.get(recipe["machine"])
            if not kind:
                if machine.get("isStorage") or machine.get("category_id") in {"storage", "storages"}:
                    kind = "storage"
                elif machine.get("category_id") == "cargo_docks":
                    kind = "export"
                else:
                    kind = "further-processing"
            routes[kind].append(recipe_id)
            if kind == "storage":
                transport = storage_transport.get(recipe["machine"])
                if transport:
                    transport_types.add(transport)
                storage_facilities.append(
                    {
                        "machineId": recipe["machine"],
                        "recipeId": recipe_id,
                        "capacity": machine.get("storage_capacity", 0),
                        "transport": transport,
                    }
                )

        extractable = False
        unknown_capacity = False
        research_tiers = set()
        for recipe_id in product.get("recipes", {}).get("output", []):
            recipe = recipes.get(recipe_id)
            if not recipe:
                continue
            machine = machines.get(recipe["machine"], {})
            tier = progression.get(recipe_id, {}).get("researchTier")
            if tier is not None:
                research_tiers.add(tier)
            output = next((item for item in recipe.get("outputs", []) if item["id"] == product_id), None)
            if output and output.get("quantity") == 0:
                unknown_capacity = True
            if machine.get("isMine") or recipe["machine"] in extraction_machines:
                extractable = True

        cargo_compatible = bool(transport_types.intersection({"fluid", "loose", "unit"}))
        record = {
            "extractable": extractable,
            "importable": product_id in importable_products,
            "tradeable": product_id in importable_products,
            "cargoCompatible": cargo_compatible,
            "unknownCapacity": unknown_capacity,
            "transportTypes": sorted(transport_types),
            "storageFacilities": sorted(storage_facilities, key=lambda item: item["recipeId"]),
            "researchTiers": sorted(research_tiers),
            "routes": {key: sorted(value) for key, value in routes.items()},
        }
        result[product_id] = record
        for kind, values in routes.items():
            if values:
                distribution[kind] += 1
        if extractable:
            distribution["extractable"] += 1
        if record["importable"]:
            distribution["importable"] += 1
        if record["cargoCompatible"]:
            distribution["cargo-compatible"] += 1
        if record["unknownCapacity"]:
            distribution["unknown-capacity"] += 1

    output = {
        "version": 2,
        "source": "normalized machine metadata plus reviewed capability-overrides.json",
        "products": {key: result[key] for key in sorted(result)},
    }
    output_text = json.dumps(output, indent=2, ensure_ascii=False) + "\n"

    lines = [
        "# Product capability audit",
        "",
        "Generated from normalized recipe/machine metadata and explicit reviewed overrides.",
        "",
        f"- Products: **{len(result)}**",
        *[f"- {key}: **{value}** products" for key, value in sorted(distribution.items())],
        "",
        "## Known source limitation",
        "",
        "The normalized cargo-dock machines contain no recipes or product compatibility records. "
        "Therefore this index deliberately asserts no export routes instead of guessing cargo compatibility.",
        "",
        "## Products without route or source capability",
        "",
    ]
    for product_id, record in result.items():
        if not record["extractable"] and not record["importable"] and not any(record["routes"].values()):
            lines.append(f"- `{product_id}` — {products[product_id]['name']}")
    audit_text = "\n".join(lines) + "\n"
    generated = {
        DATA / "product-capabilities.json": output_text,
        ROOT / "docs" / "PRODUCT-CAPABILITIES-AUDIT.md": audit_text,
    }
    if args.check:
        stale = [path for path, text in generated.items() if not path.exists() or path.read_text() != text]
        if stale:
            parser.error("stale generated artifacts: " + ", ".join(str(path.relative_to(ROOT)) for path in stale))
    else:
        for path, text in generated.items():
            path.write_text(text)
    print("capabilities", len(result), dict(sorted(distribution.items())))


if __name__ == "__main__":
    main()
