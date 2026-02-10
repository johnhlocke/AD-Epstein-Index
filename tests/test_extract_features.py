"""Tests for src/extract_features.py — JSON parsing, prompt building, page offset math.

Only tests pure logic functions. No API calls, no PDF conversion, no mocks.
The module-level Anthropic client init is bypassed by patching env vars.
"""

import json
import os
import sys
import pytest

# Patch env vars BEFORE importing (module creates Anthropic client at top level)
os.environ.setdefault("ANTHROPIC_API_KEY", "fake-key")
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "fake-key")

from extract_features import parse_json_response, _build_extraction_prompt, EXTRACT_PROMPT


# ── parse_json_response() ─────────────────────────────────────────


class TestParseJsonResponse:
    def test_plain_json(self):
        result = parse_json_response('{"key": "val"}')
        assert result == {"key": "val"}

    def test_markdown_wrapped(self):
        text = '```json\n{"key": "val"}\n```'
        result = parse_json_response(text)
        assert result == {"key": "val"}

    def test_language_tag_variant(self):
        text = '```python\n{"key": "val"}\n```'
        result = parse_json_response(text)
        assert result == {"key": "val"}

    def test_whitespace(self):
        text = '  \n  {"key": "val"}  \n  '
        result = parse_json_response(text)
        assert result == {"key": "val"}

    def test_invalid_json(self):
        with pytest.raises(json.JSONDecodeError):
            parse_json_response("not json at all")

    def test_empty_string(self):
        with pytest.raises((json.JSONDecodeError, ValueError)):
            parse_json_response("")

    def test_nested_json(self):
        text = '{"outer": {"inner": [1, 2, 3]}}'
        result = parse_json_response(text)
        assert result["outer"]["inner"] == [1, 2, 3]

    def test_array_response(self):
        text = '[{"a": 1}, {"b": 2}]'
        result = parse_json_response(text)
        assert len(result) == 2
        assert result[0]["a"] == 1

    def test_markdown_with_extra_whitespace(self):
        text = '```json\n  {"key": "val"}  \n```'
        result = parse_json_response(text)
        assert result == {"key": "val"}


# ── String "null" cleanup ──────────────────────────────────────────
# The cleanup logic lives inside _call_extraction(), so we test it as
# an isolated pattern here.


def _clean_null_strings(data: dict) -> dict:
    """Replicate the null-string cleanup from _call_extraction."""
    for key in data:
        if data[key] == "null" or data[key] == "None":
            data[key] = None
    return data


class TestNullStringCleanup:
    def test_string_null(self):
        assert _clean_null_strings({"a": "null"}) == {"a": None}

    def test_string_none(self):
        assert _clean_null_strings({"a": "None"}) == {"a": None}

    def test_uppercase_null_stays(self):
        # The code uses exact string match, not case-insensitive
        result = _clean_null_strings({"a": "NULL"})
        assert result["a"] == "NULL"

    def test_actual_none_stays(self):
        result = _clean_null_strings({"a": None})
        assert result["a"] is None

    def test_non_null_string_stays(self):
        result = _clean_null_strings({"a": "hello"})
        assert result["a"] == "hello"


# ── _build_extraction_prompt() ─────────────────────────────────────


class TestBuildExtractionPrompt:
    def test_no_hint(self):
        result = _build_extraction_prompt(None)
        assert result == EXTRACT_PROMPT

    def test_with_hint_title_only(self):
        hint = {"article_title": "High Spirits"}
        result = _build_extraction_prompt(hint)
        assert "High Spirits" in result
        assert result.startswith(EXTRACT_PROMPT)

    def test_with_hint_title_and_homeowner(self):
        hint = {"article_title": "High Spirits", "homeowner_hint": "A designer's villa"}
        result = _build_extraction_prompt(hint)
        assert "High Spirits" in result
        assert "A designer's villa" in result

    def test_hint_with_missing_title(self):
        hint = {"homeowner_hint": "A designer's villa"}
        result = _build_extraction_prompt(hint)
        assert "Unknown" in result  # Falls back to 'Unknown'


# ── Page offset math ──────────────────────────────────────────────
# The offset formula: pdf_page = magazine_page + page_offset
# page_offset = toc_pdf_page - toc_printed_page


class TestPageOffsetMath:
    def test_negative_offset(self):
        # TOC printed page 8 appeared as PDF page 6 → offset = 6 - 8 = -2
        page_offset = 6 - 8  # = -2
        magazine_page = 116
        pdf_page = magazine_page + page_offset
        assert pdf_page == 114

    def test_zero_offset(self):
        page_offset = 10 - 10  # = 0
        magazine_page = 50
        pdf_page = magazine_page + page_offset
        assert pdf_page == 50

    def test_positive_offset(self):
        # TOC printed page 5 appeared as PDF page 10 → offset = 10 - 5 = +5
        page_offset = 10 - 5  # = +5
        magazine_page = 50
        pdf_page = magazine_page + page_offset
        assert pdf_page == 55
