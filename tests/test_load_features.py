"""Tests for src/load_features.py — FEATURE_FIELDS completeness, row building logic.

Only tests pure data structures and logic. No Supabase calls.
"""

import os
import sys
import pytest

# Patch env vars BEFORE importing (module creates Supabase client at top level)
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "fake-key")

from load_features import FEATURE_FIELDS, INTEGER_FIELDS, _sanitize_integer


# ── FEATURE_FIELDS ─────────────────────────────────────────────────


class TestFeatureFields:
    def test_contains_article_author(self):
        assert "article_author" in FEATURE_FIELDS

    def test_contains_all_expected_fields(self):
        expected = [
            "article_title", "article_author", "homeowner_name",
            "designer_name", "architecture_firm", "year_built",
            "square_footage", "cost", "location_city", "location_state",
            "location_country", "design_style", "page_number", "notes",
        ]
        assert len(FEATURE_FIELDS) == len(expected)
        for field in expected:
            assert field in FEATURE_FIELDS

    def test_article_author_after_article_title(self):
        title_idx = FEATURE_FIELDS.index("article_title")
        author_idx = FEATURE_FIELDS.index("article_author")
        assert author_idx == title_idx + 1


# ── Row building logic ─────────────────────────────────────────────
# Replicate the row-building loop from load_extraction() for isolated testing.


def _build_feature_row(feature: dict, issue_id: int) -> dict:
    """Replicate the row-building logic from load_features.load_extraction."""
    row = {"issue_id": issue_id}
    for field in FEATURE_FIELDS:
        value = feature.get(field)
        if value is not None:
            if field in INTEGER_FIELDS:
                value = _sanitize_integer(value)
                if value is None:
                    continue
            row[field] = value
    return row


class TestBuildFeatureRow:
    def test_all_fields_present(self):
        feature = {
            "article_title": "Test Title",
            "article_author": "Test Author",
            "homeowner_name": "John Smith",
            "designer_name": "Jane Doe",
            "architecture_firm": "Firm ABC",
            "year_built": 2000,
            "square_footage": 5000,
            "cost": "$2M",
            "location_city": "New York",
            "location_state": "NY",
            "location_country": "USA",
            "design_style": "Modern",
            "page_number": 42,
            "notes": "Some notes",
        }
        row = _build_feature_row(feature, issue_id=99)
        assert row["issue_id"] == 99
        assert row["homeowner_name"] == "John Smith"
        assert row["article_author"] == "Test Author"
        assert len(row) == 15  # 14 fields + issue_id

    def test_some_none_fields_skipped(self):
        feature = {
            "article_title": "Test Title",
            "homeowner_name": "John Smith",
            "designer_name": None,
            "page_number": 42,
        }
        row = _build_feature_row(feature, issue_id=1)
        assert "designer_name" not in row
        assert row["homeowner_name"] == "John Smith"
        assert row["page_number"] == 42

    def test_extra_fields_ignored(self):
        feature = {
            "homeowner_name": "John Smith",
            "page_number": 42,
            "extra_field_xyz": "should not appear",
            "magazine_page": 100,
        }
        row = _build_feature_row(feature, issue_id=1)
        assert "extra_field_xyz" not in row
        assert "magazine_page" not in row

    def test_empty_feature(self):
        row = _build_feature_row({}, issue_id=5)
        assert row == {"issue_id": 5}

    def test_string_null_not_cleaned(self):
        # The row builder does NOT clean "null" strings — that's extraction's job
        feature = {"homeowner_name": "null", "page_number": 10}
        row = _build_feature_row(feature, issue_id=1)
        assert row["homeowner_name"] == "null"

    def test_comma_in_integer_field_sanitized(self):
        feature = {"homeowner_name": "Test", "square_footage": "35,000", "page_number": 42}
        row = _build_feature_row(feature, issue_id=1)
        assert row["square_footage"] == 35000
        assert isinstance(row["square_footage"], int)

    def test_string_integer_field_sanitized(self):
        feature = {"homeowner_name": "Test", "year_built": "2005", "page_number": 42}
        row = _build_feature_row(feature, issue_id=1)
        assert row["year_built"] == 2005

    def test_unparseable_integer_dropped(self):
        feature = {"homeowner_name": "Test", "square_footage": "unknown", "page_number": 42}
        row = _build_feature_row(feature, issue_id=1)
        assert "square_footage" not in row


# ── _sanitize_integer() ───────────────────────────────────────────


class TestSanitizeInteger:
    def test_int_passthrough(self):
        assert _sanitize_integer(5000) == 5000

    def test_float_to_int(self):
        assert _sanitize_integer(5000.0) == 5000

    def test_string_with_commas(self):
        assert _sanitize_integer("35,000") == 35000

    def test_string_with_suffix(self):
        assert _sanitize_integer("3500 sq ft") == 3500

    def test_plain_string_number(self):
        assert _sanitize_integer("2005") == 2005

    def test_non_numeric_returns_none(self):
        assert _sanitize_integer("unknown") is None

    def test_none_returns_none(self):
        assert _sanitize_integer(None) is None

    def test_empty_string_returns_none(self):
        assert _sanitize_integer("") is None
