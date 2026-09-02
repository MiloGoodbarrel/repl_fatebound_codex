#!/usr/bin/env python3
"""Extract structured Grim Hollow Monster Grimoire actions from the source PDF."""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import pymupdf


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "attached_assets" / "Grim Hollow the Monster Grimoire.pdf"
MONSTERS_PATH = ROOT / "server" / "data" / "bestiary" / "monsters.csv"
OUTPUT_PATH = ROOT / "server" / "data" / "bestiary" / "grim_hollow_actions.csv"
LORE_OUTPUT_PATH = ROOT / "server" / "data" / "bestiary" / "grim_hollow_lore.json"
IMAGE_DIR = ROOT / "client" / "public" / "bestiary" / "grim-hollow"
SOURCE_PREFIX = "dnd_5e2014_ghmg_"
PDF_PAGE_OFFSET = 4

FIELDNAMES = [
    "action_id", "monster_id", "action_order", "action_category", "action_name",
    "action_description", "activation_condition", "action_cost", "is_attack",
    "attack_type", "attack_ability", "attack_bonus", "reach_ft",
    "range_normal_ft", "range_long_ft", "target_text", "target_count",
    "save_ability", "save_dc", "save_on_success", "uses_max", "uses_period",
    "recharge_min", "recharge_max", "linked_action_ids", "notes",
]

CATEGORY_HEADINGS = {
    "actions": "action",
    "bonus actions": "bonus_action",
    "reactions": "reaction",
    "legendary actions": "legendary_action",
    "lair actions": "lair_action",
    "mythic actions": "mythic_action",
    "villain actions": "villain_action",
}

STOP_HEADINGS = {
    "traits", "salvage", "lore", "regional effects", "regional effect",
}

NO_ACTION_CREATURES = {
    "Eye Crawler",
    "Spythronar Sac",
}


def normalized(value: str) -> str:
    value = value.replace("’", "'").replace("–", "-").replace("—", "-")
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", normalized(value)).strip("_") or "unnamed"


def clean_text(parts: list[str]) -> str:
    text = " ".join(part.strip() for part in parts if part.strip())
    text = re.sub(r"(\w)-\s+([a-z])", r"\1\2", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.split(r"\bDC\s+\d+\s+Intelligence\s+\([^)]+\):", text, maxsplit=1)[0]
    text = re.split(r"\b\d+\s+Grim Hollow Monster Grimoire\b", text, maxsplit=1)[0]
    text = re.split(r"\s+[“\"]", text, maxsplit=1)[0]
    return text.strip()


def clean_lore(parts: list[str]) -> str:
    text = " ".join(part.strip() for part in parts if part.strip())
    text = re.sub(r"(\w)-\s+([a-z])", r"\1\2", text)
    text = re.sub(r"\s+", " ", text).strip()
    return re.split(r"\b\d+\s+Grim Hollow Monster Grimoire\b", text, maxsplit=1)[0].strip()


def line_record(page_number: int, line: dict) -> dict:
    spans = [span for span in line["spans"] if span["text"].strip()]
    return {
        "page": page_number,
        "text": "".join(span["text"] for span in line["spans"]).strip(),
        "spans": spans,
        "x0": line["bbox"][0],
    }


def load_lines(document: pymupdf.Document) -> tuple[list[dict], dict[int, tuple[int, int]]]:
    lines: list[dict] = []
    page_ranges: dict[int, tuple[int, int]] = {}
    for page_index, page in enumerate(document):
        start = len(lines)
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                record = line_record(page_index + 1, line)
                if record["text"]:
                    lines.append(record)
        page_ranges[page_index + 1] = (start, len(lines))
    return lines, page_ranges


def is_statblock_title(lines: list[dict], index: int) -> bool:
    nearby = [normalized(line["text"]) for line in lines[index + 1:index + 6]]
    return any(text.startswith("armor class") for text in nearby)


def find_monster_start(
    monster: dict[str, str],
    lines: list[dict],
    page_ranges: dict[int, tuple[int, int]],
) -> int | None:
    expected_pdf_page = int(monster["source_page"]) + PDF_PAGE_OFFSET
    wanted = normalized(monster["name"])
    for page_number in (expected_pdf_page, expected_pdf_page + 1, expected_pdf_page - 1):
        page_range = page_ranges.get(page_number)
        if not page_range:
            continue
        start, end = page_range
        for index in range(start, end):
            if normalized(lines[index]["text"]) == wanted and is_statblock_title(lines, index):
                return index
    return None


def action_title(line: dict) -> tuple[str, str] | None:
    spans = line["spans"]
    if not spans:
        return None
    first = spans[0]
    if "BookmanOldStyle-Bold" not in first.get("font", ""):
        return None
    bold_spans: list[str] = []
    for span in spans:
        if "BookmanOldStyle-Bold" not in span.get("font", ""):
            break
        bold_spans.append(span["text"])
    title_fragment = "".join(bold_spans).strip()
    full_text = line["text"]
    remainder = full_text[len(title_fragment):].lstrip()
    if "." in title_fragment:
        title, trailing_title_text = title_fragment.split(".", 1)
        description = f"{trailing_title_text.strip()} {remainder}".strip()
        return title.strip(), description
    if remainder.startswith("."):
        return title_fragment, remainder[1:].strip()
    return None


def bold_title_fragment(line: dict) -> str:
    fragments: list[str] = []
    for span in line["spans"]:
        if "BookmanOldStyle-Bold" not in span.get("font", ""):
            break
        fragments.append(span["text"])
    return "".join(fragments).strip()


def parse_metadata(name: str, description: str) -> dict[str, str]:
    combined = f"{name}. {description}"
    attack = re.search(r"(Melee|Ranged|Melee or Ranged) (Weapon|Spell) Attack:\s*([+-]\d+) to hit", combined, re.I)
    reach = re.search(r"reach\s+(\d+)\s*ft", combined, re.I)
    attack_range = re.search(r"range\s+(\d+)(?:/(\d+))?\s*ft", combined, re.I)
    save = re.search(r"DC\s+(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)", combined, re.I)
    recharge = re.search(r"Recharge\s+(\d)(?:\s*[-–]\s*(\d))?", name, re.I)
    uses = re.search(r"\((\d+)\s*/\s*(Day|Short Rest|Long Rest)\)", name, re.I)
    cost = re.search(r"Costs?\s+(\d+)\s+Actions?", name, re.I)
    attack_type = ""
    if attack:
        attack_type = "_".join(part.lower().replace(" or ", "_or_") for part in attack.groups()[:2])
    return {
        "activation_condition": "",
        "action_cost": cost.group(1) if cost else "",
        "is_attack": "TRUE" if attack else "FALSE",
        "attack_type": attack_type,
        "attack_ability": "",
        "attack_bonus": attack.group(3).lstrip("+") if attack else "",
        "reach_ft": reach.group(1) if reach else "",
        "range_normal_ft": attack_range.group(1) if attack_range else "",
        "range_long_ft": attack_range.group(2) if attack_range and attack_range.group(2) else "",
        "target_text": "",
        "target_count": "",
        "save_ability": save.group(2)[:3].upper() if save else "",
        "save_dc": save.group(1) if save else "",
        "save_on_success": "",
        "uses_max": uses.group(1) if uses else "",
        "uses_period": f"per_{uses.group(2).lower().replace(' ', '_')}" if uses else "",
        "recharge_min": recharge.group(1) if recharge else "",
        "recharge_max": (recharge.group(2) or recharge.group(1)) if recharge else "",
        "linked_action_ids": "",
        "notes": "Extracted from Grim Hollow: The Monster Grimoire PDF.",
    }


def extract_actions(monster: dict[str, str], block: list[dict]) -> list[dict[str, str]]:
    actions: list[dict[str, str]] = []
    category: str | None = None
    current: dict[str, str] | None = None
    current_x0: float | None = None
    pending_title = ""
    description_parts: list[str] = []

    def finish_current() -> None:
        nonlocal current, current_x0, description_parts
        if current is None:
            return
        current["action_description"] = clean_text(description_parts)
        current.update(parse_metadata(current["action_name"], current["action_description"]))
        actions.append(current)
        current = None
        current_x0 = None
        description_parts = []

    for line in block:
        heading = normalized(line["text"])
        if heading in CATEGORY_HEADINGS:
            finish_current()
            pending_title = ""
            category = CATEGORY_HEADINGS[heading]
            continue
        if category is not None and any(
            "BauerBodoni" in span.get("font", "") and span.get("size", 0) > 10
            for span in line["spans"]
        ):
            finish_current()
            pending_title = ""
            category = None
            continue
        if heading in STOP_HEADINGS:
            finish_current()
            pending_title = ""
            category = None
            continue
        if category is None:
            continue

        title = action_title(line)
        if title:
            finish_current()
            action_name, initial_description = title
            if pending_title:
                action_name = f"{pending_title} {action_name}".strip()
                pending_title = ""
            current = {
                "action_id": "",
                "monster_id": monster["monster_id"],
                "action_order": "",
                "action_category": category,
                "action_name": action_name,
                "action_description": "",
            }
            current_x0 = line["x0"]
            if initial_description:
                description_parts.append(initial_description)
        elif category is not None and (fragment := bold_title_fragment(line)):
            finish_current()
            pending_title = f"{pending_title} {fragment}".strip()
        elif current is not None and current_x0 is not None and abs(line["x0"] - current_x0) < 80:
            description_parts.append(line["text"])
        elif current is not None:
            finish_current()
            pending_title = ""
            category = None

    finish_current()
    for order, action in enumerate(actions, start=1):
        action["action_order"] = str(order)
        action["action_id"] = (
            f"{monster['monster_id']}_action_{action['action_category']}_"
            f"{slug(action['action_name'])}_{order}"
        )
    return actions


def extract_lore(monster: dict[str, str], start: int, lines: list[dict]) -> str:
    wanted = normalized(monster["name"])
    title_start = next(
        (
            index for index in range(start - 180, start)
            if index >= 0 and normalized(lines[index]["text"]) == wanted
        ),
        None,
    )
    if title_start is None:
        return ""

    parts: list[str] = []
    for line in lines[title_start + 1:start]:
        heading = normalized(line["text"])
        if heading in {"salvage", "lore"}:
            break
        if re.match(r"^\d+\s+grim hollow monster grimoire\b", heading):
            continue
        parts.append(line["text"])
    return clean_lore(parts)


def main() -> int:
    if not PDF_PATH.exists():
        print(f"Missing source PDF: {PDF_PATH}", file=sys.stderr)
        return 1

    with MONSTERS_PATH.open(newline="", encoding="utf-8-sig") as handle:
        monsters = [
            row for row in csv.DictReader(handle)
            if row["monster_id"].startswith(SOURCE_PREFIX)
        ]

    document = pymupdf.open(PDF_PATH)
    lines, page_ranges = load_lines(document)
    starts: dict[str, int] = {}
    missing_statblocks: list[str] = []
    for monster in monsters:
        start = find_monster_start(monster, lines, page_ranges)
        if start is None:
            missing_statblocks.append(monster["name"])
        else:
            starts[monster["monster_id"]] = start

    ordered = sorted(
        (start, monster) for monster in monsters
        if (start := starts.get(monster["monster_id"])) is not None
    )
    all_actions: list[dict[str, str]] = []
    lore_by_id: dict[str, dict[str, str | int]] = {}
    missing_actions: list[str] = []
    counts_by_category: defaultdict[str, int] = defaultdict(int)
    for position, (start, monster) in enumerate(ordered):
        end = ordered[position + 1][0] if position + 1 < len(ordered) else len(lines)
        if position + 1 < len(ordered):
            next_monster = ordered[position + 1][1]
            next_name = normalized(next_monster["name"])
            narrative_start = next(
                (
                    index for index in range(start + 1, end)
                    if normalized(lines[index]["text"]) == next_name
                ),
                None,
            )
            if narrative_start is not None:
                end = narrative_start
        actions = extract_actions(monster, lines[start:end])
        lore_by_id[monster["monster_id"]] = {
            "description": extract_lore(monster, start, lines),
            "sourcePage": int(monster["source_page"]),
            "imageUrl": f"/bestiary/grim-hollow/page-{int(monster['source_page']) + PDF_PAGE_OFFSET}.jpg",
        }
        if not actions and monster["name"] not in NO_ACTION_CREATURES:
            missing_actions.append(monster["name"])
        for action in actions:
            counts_by_category[action["action_category"]] += 1
        all_actions.extend(actions)

    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(all_actions)
    with LORE_OUTPUT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(lore_by_id, handle, ensure_ascii=False, indent=2)

    print(
        f"monsters={len(monsters)} matched={len(starts)} actions={len(all_actions)} "
        f"missing_statblocks={len(missing_statblocks)} missing_actions={len(missing_actions)} "
        f"source_no_actions={len(NO_ACTION_CREATURES)}"
    )
    print("categories=" + ", ".join(f"{key}:{value}" for key, value in sorted(counts_by_category.items())))
    if missing_statblocks:
        print("missing statblocks: " + " | ".join(missing_statblocks))
    if missing_actions:
        print("missing actions: " + " | ".join(missing_actions))
    return 0 if not missing_statblocks and not missing_actions else 2


if __name__ == "__main__":
    raise SystemExit(main())