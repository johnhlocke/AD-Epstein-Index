"""Tests for src/agents/researcher.py — failure tracking, run log, lead sorting, constants.

Tests the pure logic in ResearcherAgent without Supabase, Anthropic API, or async.
Uses tmp_data_dir fixture for file I/O. Patches module-level paths to use temp dirs.
"""

import json
import os
import sys
import pytest

# Add src/ to path (conftest does this too, but be explicit for the agents subpackage)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from agents.researcher import (
    LEAD_VERDICTS,
    VERDICT_PRIORITY,
    MAX_INVESTIGATION_FAILURES,
    ResearcherAgent,
)


# ── Constants ──────────────────────────────────────────────────────


class TestConstants:
    def test_max_investigation_failures(self):
        assert MAX_INVESTIGATION_FAILURES == 3

    def test_lead_verdicts_contents(self):
        expected = {"confirmed_match", "likely_match", "possible_match", "needs_review"}
        assert LEAD_VERDICTS == expected

    def test_verdict_priority_ordering(self):
        assert VERDICT_PRIORITY["confirmed_match"] == 0
        assert VERDICT_PRIORITY["likely_match"] == 1
        assert VERDICT_PRIORITY["possible_match"] == 2
        assert VERDICT_PRIORITY["needs_review"] == 3


# ── Lead Finding with Failure Tracking ─────────────────────────────
# We test _find_uninvestigated_leads by writing test data to temp files
# and monkeypatching the module paths.


class TestFindUninvestigatedLeads:
    @pytest.fixture(autouse=True)
    def setup_agent(self, tmp_data_dir, monkeypatch):
        """Set up a ResearcherAgent with paths pointing to tmp_data_dir."""
        import agents.researcher as mod

        self.xref_dir = tmp_data_dir / "cross_references"
        self.dossiers_dir = tmp_data_dir / "dossiers"
        self.log_path = tmp_data_dir / "researcher_log.json"
        self.results_path = self.xref_dir / "results.json"

        monkeypatch.setattr(mod, "XREF_DIR", str(self.xref_dir))
        monkeypatch.setattr(mod, "DOSSIERS_DIR", str(self.dossiers_dir))
        monkeypatch.setattr(mod, "LOG_PATH", str(self.log_path))
        monkeypatch.setattr(mod, "RESULTS_PATH", str(self.results_path))

        self.agent = ResearcherAgent()

    def _write_results(self, results):
        with open(self.results_path, "w") as f:
            json.dump(results, f)

    def _write_investigated(self, ids):
        path = self.dossiers_dir / "investigated_ids.json"
        with open(path, "w") as f:
            json.dump(list(ids), f)

    def _write_log(self, log):
        with open(self.log_path, "w") as f:
            json.dump(log, f)

    def test_normal_lead_included(self):
        self._write_results([
            {"feature_id": "f1", "homeowner_name": "John Smith",
             "combined_verdict": "likely_match", "black_book_status": "match"},
        ])
        leads = self.agent._find_uninvestigated_leads()
        assert len(leads) == 1
        assert leads[0]["homeowner_name"] == "John Smith"

    def test_already_investigated_skipped(self):
        self._write_results([
            {"feature_id": "f1", "homeowner_name": "John Smith",
             "combined_verdict": "likely_match", "black_book_status": "match"},
        ])
        self._write_investigated(["f1"])
        leads = self.agent._find_uninvestigated_leads()
        assert len(leads) == 0

    def test_failed_3_times_skipped(self):
        self._write_results([
            {"feature_id": "f1", "homeowner_name": "Bad Name",
             "combined_verdict": "likely_match", "black_book_status": "match"},
        ])
        self._write_log({
            "cycle_count": 5, "investigation_failures": {"Bad Name": 3}
        })
        leads = self.agent._find_uninvestigated_leads()
        assert len(leads) == 0

    def test_failed_2_times_included(self):
        self._write_results([
            {"feature_id": "f1", "homeowner_name": "Flaky Name",
             "combined_verdict": "possible_match", "black_book_status": "no_match"},
        ])
        self._write_log({
            "cycle_count": 5, "investigation_failures": {"Flaky Name": 2}
        })
        leads = self.agent._find_uninvestigated_leads()
        assert len(leads) == 1

    def test_bb_match_without_verdict_included(self):
        self._write_results([
            {"feature_id": "f1", "homeowner_name": "Legacy Name",
             "black_book_status": "match"},
        ])
        leads = self.agent._find_uninvestigated_leads()
        assert len(leads) == 1

    def test_no_match_verdict_excluded(self):
        self._write_results([
            {"feature_id": "f1", "homeowner_name": "Nobody",
             "combined_verdict": "no_match", "black_book_status": "no_match"},
        ])
        leads = self.agent._find_uninvestigated_leads()
        assert len(leads) == 0

    def test_priority_sorting(self):
        self._write_results([
            {"feature_id": "f1", "homeowner_name": "Review",
             "combined_verdict": "needs_review", "black_book_status": "match"},
            {"feature_id": "f2", "homeowner_name": "Confirmed",
             "combined_verdict": "confirmed_match", "black_book_status": "match"},
            {"feature_id": "f3", "homeowner_name": "Possible",
             "combined_verdict": "possible_match", "black_book_status": "match"},
            {"feature_id": "f4", "homeowner_name": "Likely",
             "combined_verdict": "likely_match", "black_book_status": "match"},
        ])
        leads = self.agent._find_uninvestigated_leads()
        names = [l["homeowner_name"] for l in leads]
        assert names == ["Confirmed", "Likely", "Possible", "Review"]

    def test_empty_results(self):
        self._write_results([])
        leads = self.agent._find_uninvestigated_leads()
        assert leads == []


# ── Run Log Updates ────────────────────────────────────────────────


class TestRunLogUpdates:
    @pytest.fixture(autouse=True)
    def setup_paths(self, tmp_data_dir, monkeypatch):
        import agents.researcher as mod
        self.log_path = tmp_data_dir / "researcher_log.json"
        monkeypatch.setattr(mod, "LOG_PATH", str(self.log_path))
        self.agent = ResearcherAgent()

    def _read_log(self):
        with open(self.log_path) as f:
            return json.load(f)

    def test_success_increments_counters(self):
        self.agent._update_run_log(success=True)
        log = self._read_log()
        assert log["dossiers_built"] == 1
        assert log["investigated"] == 1
        assert log["cycle_count"] == 1

    def test_failure_increments_name_count(self):
        self.agent._update_run_log(success=False, failed_name="Bad Name")
        log = self._read_log()
        assert log["investigation_failures"]["Bad Name"] == 1

    def test_new_failure_name_gets_count_1(self):
        # Pre-populate log with an existing failure
        with open(self.log_path, "w") as f:
            json.dump({"cycle_count": 1, "investigation_failures": {"Old Name": 2}}, f)
        self.agent._update_run_log(success=False, failed_name="New Name")
        log = self._read_log()
        assert log["investigation_failures"]["New Name"] == 1
        assert log["investigation_failures"]["Old Name"] == 2

    def test_repeated_failure_increments(self):
        self.agent._update_run_log(success=False, failed_name="Flaky")
        self.agent._update_run_log(success=False, failed_name="Flaky")
        log = self._read_log()
        assert log["investigation_failures"]["Flaky"] == 2
