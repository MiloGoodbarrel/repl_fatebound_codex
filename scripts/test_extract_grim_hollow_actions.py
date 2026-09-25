"""Regression tests for safe Grimoire extraction output."""

import contextlib
import csv
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).with_name("extract-grim-hollow-actions.py")
spec = importlib.util.spec_from_file_location("grim_hollow_extractor", SCRIPT)
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)


class ExtractorOutputTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        self.pdf = root / "source.pdf"
        self.pdf.touch()
        self.monsters = root / "monsters.csv"
        self.actions = root / "actions.csv"
        self.lore = root / "lore.json"
        self.actions.write_bytes(b"prior actions\n")
        self.lore.write_bytes(b"prior lore\n")
        self.paths = mock.patch.multiple(
            extractor, PDF_PATH=self.pdf, MONSTERS_PATH=self.monsters,
            OUTPUT_PATH=self.actions, LORE_OUTPUT_PATH=self.lore,
        )
        self.paths.start()
        self.addCleanup(self.paths.stop)

    def assert_prior_outputs(self):
        self.assertEqual(self.actions.read_bytes(), b"prior actions\n")
        self.assertEqual(self.lore.read_bytes(), b"prior lore\n")
        self.assertEqual(
            sorted(path.name for path in self.actions.parent.iterdir()),
            sorted(["actions.csv", "lore.json", "source.pdf"] + (
                ["monsters.csv"] if self.monsters.exists() else []
            )),
        )

    def test_staging_failure_leaves_both_outputs_untouched(self):
        with mock.patch.object(extractor.json, "dump", side_effect=OSError("disk full")):
            with self.assertRaisesRegex(OSError, "disk full"):
                extractor.write_outputs([], {})
        self.assert_prior_outputs()

    def test_second_replace_failure_restores_first_output(self):
        original_replace = extractor.os.replace
        attempts = 0

        def fail_second(source, destination):
            nonlocal attempts
            attempts += 1
            if attempts == 2:
                raise OSError("replace failed")
            return original_replace(source, destination)

        with mock.patch.object(extractor.os, "replace", side_effect=fail_second):
            with self.assertRaisesRegex(OSError, "replace failed"):
                extractor.write_outputs([], {})
        self.assert_prior_outputs()

    def run_extraction(self, rows, starts, action_ids):
        with self.monsters.open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["monster_id", "name", "source_page"])
            writer.writeheader()
            writer.writerows(rows)

        def actions_for(monster, block):
            return [
                {
                    **{field: "" for field in extractor.FIELDNAMES},
                    "action_id": action_id,
                    "monster_id": monster["monster_id"],
                    "action_category": "action",
                }
                for action_id in action_ids.get(monster["name"], [])
            ]

        with (
            mock.patch.object(extractor.pymupdf, "open"),
            mock.patch.object(extractor, "load_lines", return_value=([{"text": ""}] * 10, {})),
            mock.patch.object(extractor, "find_monster_start",
                              side_effect=lambda monster, *_: starts.get(monster["name"])),
            mock.patch.object(extractor, "extract_actions", side_effect=actions_for),
            mock.patch.object(extractor, "extract_lore", return_value="lore"),
            contextlib.redirect_stdout(io.StringIO()),
            contextlib.redirect_stderr(io.StringIO()),
        ):
            return extractor.main()

    def test_invalid_extractions_preserve_outputs(self):
        first = {"monster_id": extractor.SOURCE_PREFIX + "one", "name": "One", "source_page": "1"}
        second = {"monster_id": extractor.SOURCE_PREFIX + "two", "name": "Two", "source_page": "2"}
        cases = [
            ("duplicate source ID", [first, first], {"One": 0}, {"One": ["a"]}),
            ("missing statblock", [first, second], {"One": 0}, {"One": ["a"]}),
            ("duplicate statblock", [first, second], {"One": 0, "Two": 0},
             {"One": ["a"], "Two": ["b"]}),
            ("missing actions", [first], {"One": 0}, {}),
            ("duplicate action ID", [first, second], {"One": 0, "Two": 5},
             {"One": ["same"], "Two": ["same"]}),
        ]
        for label, rows, starts, actions in cases:
            with self.subTest(label=label):
                self.assertEqual(self.run_extraction(rows, starts, actions), 2)
                self.assert_prior_outputs()

    def test_valid_extraction_updates_both_outputs(self):
        row = {"monster_id": extractor.SOURCE_PREFIX + "one", "name": "One", "source_page": "1"}
        self.assertEqual(self.run_extraction([row], {"One": 0}, {"One": ["one_action"]}), 0)
        with self.actions.open(newline="") as handle:
            self.assertEqual(list(csv.DictReader(handle))[0]["action_id"], "one_action")
        self.assertEqual(json.loads(self.lore.read_text())[row["monster_id"]]["description"], "lore")


if __name__ == "__main__":
    unittest.main()