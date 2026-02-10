"""Tests for src/cross_reference.py — name matching, filtering, verdicts.

All tests are pure logic: no Supabase, no API calls, no mocks needed.
The module-level `supabase = create_client(url, key)` call is bypassed by
importing only the functions we need after patching the environment.
"""

import os
import sys
import pytest

# Patch env vars BEFORE importing cross_reference (it calls create_client at module level)
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "fake-key")

from cross_reference import (
    split_names,
    _filter_names,
    _word_boundary_search,
    _search_single_name,
    search_black_book,
    generate_name_variations,
    assess_combined_verdict,
    detect_false_positive_indicators,
    SKIP_NAMES,
    MIN_NAME_LENGTH,
    COMMON_LAST_NAMES,
)


# ── split_names() ──────────────────────────────────────────────────


class TestSplitNames:
    def test_simple_name(self):
        assert split_names("John Smith") == ["John Smith"]

    def test_ampersand_compound(self):
        result = split_names("Jane & Max Gottschalk")
        assert "Jane Gottschalk" in result
        assert "Max Gottschalk" in result
        assert len(result) == 2

    def test_and_compound(self):
        result = split_names("Kevin and Nicole Systrom")
        assert "Kevin Systrom" in result
        assert "Nicole Systrom" in result
        assert len(result) == 2

    def test_strip_et_al(self):
        result = split_names("Tom Kundig, et al")
        assert result == ["Tom Kundig"]

    def test_strip_et_al_dot(self):
        result = split_names("Tom Kundig, et al.")
        assert result == ["Tom Kundig"]

    def test_strip_and_others(self):
        result = split_names("John Smith and others")
        assert result == ["John Smith"]

    def test_leading_the(self):
        # "The Smiths" → "Smiths" → single word → filtered out by MIN_NAME_LENGTH
        result = split_names("The Smiths")
        assert result == []

    def test_last_first_not_split(self):
        # "Smith, John" matches the Last, First regex and should NOT be comma-split
        result = split_names("Smith, John")
        assert result == ["Smith, John"]

    def test_comma_separated_names(self):
        result = split_names("Tom Kundig, Jamie Bush")
        assert "Tom Kundig" in result
        assert "Jamie Bush" in result
        assert len(result) == 2

    def test_empty_string(self):
        assert split_names("") == []

    def test_only_skip_words(self):
        # "Brothers" is a single word (< MIN_NAME_LENGTH) → filtered
        assert split_names("Brothers") == []

    def test_ampersand_no_last_name(self):
        # "Kevin & Nicole" — both single words → filtered by MIN_NAME_LENGTH
        result = split_names("Kevin & Nicole")
        assert result == []

    def test_ampersand_both_have_last_names(self):
        result = split_names("John Smith & Jane Doe")
        assert "John Smith" in result
        assert "Jane Doe" in result


# ── _filter_names() ────────────────────────────────────────────────


class TestFilterNames:
    def test_valid_name_passes(self):
        assert _filter_names(["John Smith"]) == ["John Smith"]

    def test_skip_word_filtered(self):
        assert _filter_names(["studio something"]) == []

    def test_skip_word_in_name(self):
        # "brothers" is a skip word
        assert _filter_names(["John Brothers Smith"]) == []

    def test_too_short(self):
        # Single word < MIN_NAME_LENGTH words
        assert _filter_names(["Jo"]) == []

    def test_case_insensitive_skip(self):
        assert _filter_names(["UNKNOWN person"]) == []

    def test_mixed(self):
        result = _filter_names(["John Smith", "studio", "Jane Doe"])
        assert result == ["John Smith", "Jane Doe"]

    def test_empty_list(self):
        assert _filter_names([]) == []

    def test_anonymous_filtered(self):
        assert _filter_names(["anonymous"]) == []

    def test_na_filtered(self):
        assert _filter_names(["n/a"]) == []


# ── _word_boundary_search() ────────────────────────────────────────


class TestWordBoundarySearch:
    def test_exact_match(self):
        assert _word_boundary_search("Bush", "George Bush was president")

    def test_substring_blocked_bushnell(self):
        assert _word_boundary_search("Bush", "Bushnell wrote novels") is None

    def test_substring_blocked_sultanate(self):
        assert _word_boundary_search("Sultana", "The Sultanate of Oman") is None

    def test_case_insensitive(self):
        assert _word_boundary_search("bush", "George Bush was president")

    def test_special_chars_escaped(self):
        assert _word_boundary_search("O'Brien", "Mary O'Brien lives here")

    def test_word_at_start(self):
        assert _word_boundary_search("Bush", "Bush walked in")

    def test_word_at_end(self):
        assert _word_boundary_search("Bush", "I met Bush")

    def test_multiword(self):
        assert _word_boundary_search("John Smith", "Meet John Smith here")

    def test_no_match(self):
        assert _word_boundary_search("Xyz", "abc def ghi") is None


# ── _search_single_name() ─────────────────────────────────────────


class TestSearchSingleName:
    def test_full_name_match(self):
        # Use text that actually contains the full name in "First Last" order
        text = "Among the guests was Miranda Brooks at the party."
        result = _search_single_name("Miranda Brooks", text)
        assert result is not None
        types = [m["match_type"] for m in result]
        assert "full_name" in types

    def test_last_first_match(self, sample_bb_text):
        result = _search_single_name("Miranda Brooks", sample_bb_text)
        assert result is not None
        types = [m["match_type"] for m in result]
        assert "last_first" in types

    def test_last_name_only_long(self, sample_bb_text):
        # "Hoffmann" is 8 chars ≥ 5
        result = _search_single_name("Peter Hoffmann", sample_bb_text)
        assert result is not None
        types = [m["match_type"] for m in result]
        assert "last_first" in types or "last_name_only" in types

    def test_short_last_name_skipped(self, sample_bb_text):
        # "Lee" is 3 chars < 5, so last_name_only should NOT match unless full/last_first
        result = _search_single_name("Brandon Lee", sample_bb_text)
        # There is no "Brandon Lee" or "Lee, Brandon" in the text,
        # and "Lee" is too short for last_name_only
        assert result is None

    def test_single_word_skipped(self, sample_bb_text):
        result = _search_single_name("John", sample_bb_text)
        assert result is None

    def test_no_match(self, sample_bb_text):
        result = _search_single_name("Elon Musk", sample_bb_text)
        assert result is None

    def test_case_insensitive(self, sample_bb_text):
        result = _search_single_name("miranda brooks", sample_bb_text)
        assert result is not None

    def test_context_extraction(self, sample_bb_text):
        result = _search_single_name("Miranda Brooks", sample_bb_text)
        assert result is not None
        # At least one match should have context
        assert any(m.get("context") for m in result)

    def test_obrien_special_chars(self, sample_bb_text):
        result = _search_single_name("Mary O'Brien", sample_bb_text)
        assert result is not None

    def test_last_name_only_not_triggered_when_better_exists(self, sample_bb_text):
        # "John Smith" → full_name and last_first both match
        # last_name_only should NOT appear (only used as fallback)
        result = _search_single_name("John Smith", sample_bb_text)
        assert result is not None
        types = [m["match_type"] for m in result]
        # Should have full_name and/or last_first but NOT last_name_only
        assert "full_name" in types or "last_first" in types
        assert "last_name_only" not in types


# ── search_black_book() ───────────────────────────────────────────


class TestSearchBlackBook:
    def test_compound_name_search(self, sample_bb_text):
        result = search_black_book("Jane & Max Gottschalk", sample_bb_text)
        assert result is not None
        assert len(result) >= 1

    def test_none_input(self, sample_bb_text):
        assert search_black_book(None, sample_bb_text) is None

    def test_empty_input(self, sample_bb_text):
        assert search_black_book("", sample_bb_text) is None

    def test_skip_name_input(self, sample_bb_text):
        assert search_black_book("anonymous", sample_bb_text) is None

    def test_no_match_returns_none(self, sample_bb_text):
        assert search_black_book("Elon Musk", sample_bb_text) is None

    def test_empty_book(self):
        assert search_black_book("John Smith", "") is None


# ── generate_name_variations() ─────────────────────────────────────


class TestGenerateNameVariations:
    def test_full_name(self):
        result = generate_name_variations("John Smith")
        assert "John Smith" in result
        assert "Smith, John" in result
        assert "Smith" in result  # 5 chars

    def test_with_middle(self):
        result = generate_name_variations("John Q Smith")
        assert "John Q Smith" in result
        assert "Smith, John" in result
        assert "John Smith" in result  # first+last only

    def test_with_honorific_jr(self):
        result = generate_name_variations("John Smith Jr.")
        assert "Smith, John" in result
        assert "John Smith" in result

    def test_single_word(self):
        result = generate_name_variations("John")
        assert result == ["John"]

    def test_empty(self):
        assert generate_name_variations("") == []

    def test_none(self):
        assert generate_name_variations(None) == []

    def test_no_duplicates(self):
        result = generate_name_variations("John Smith")
        assert len(result) == len(set(result))

    def test_short_last_name_excluded(self):
        result = generate_name_variations("John Lee")
        # "Lee" is 3 chars < 5, should NOT be in variations as standalone
        assert "Lee" not in result


# ── assess_combined_verdict() ──────────────────────────────────────


class TestAssessCombinedVerdict:
    def test_bb_last_first_plus_doj_high(self):
        bb = [{"match_type": "last_first"}]
        doj = {"search_successful": True, "confidence": "high", "total_results": 5}
        result = assess_combined_verdict("John Smith", bb, doj)
        assert result["verdict"] == "confirmed_match"
        assert result["confidence_score"] >= 0.9

    def test_bb_last_first_no_doj(self):
        bb = [{"match_type": "last_first"}]
        result = assess_combined_verdict("John Hoffmann", bb, None)
        assert result["verdict"] == "likely_match"
        assert result["confidence_score"] >= 0.6

    def test_bb_last_name_only(self):
        bb = [{"match_type": "last_name_only"}]
        result = assess_combined_verdict("John Hoffmann", bb, None)
        assert result["verdict"] in ("possible_match", "needs_review")
        assert result["confidence_score"] >= 0.2

    def test_no_matches(self):
        result = assess_combined_verdict("John Smith", None, None)
        assert result["verdict"] == "no_match"
        assert result["confidence_score"] == 0.0

    def test_verdict_has_expected_keys(self):
        result = assess_combined_verdict("John Smith", None, None)
        assert "verdict" in result
        assert "confidence_score" in result
        assert "rationale" in result
        assert "false_positive_indicators" in result
        assert "evidence_summary" in result

    def test_doj_high_no_bb(self):
        doj = {"search_successful": True, "confidence": "high", "total_results": 3}
        result = assess_combined_verdict("John Smith", None, doj)
        assert result["verdict"] == "likely_match"

    def test_bb_full_name_doj_medium(self):
        bb = [{"match_type": "full_name"}]
        doj = {"search_successful": True, "confidence": "medium", "total_results": 2}
        result = assess_combined_verdict("John Smith", bb, doj)
        assert result["verdict"] == "likely_match"

    def test_bb_full_name_no_doj(self):
        bb = [{"match_type": "full_name"}]
        # No false positive indicators (use a rare name)
        result = assess_combined_verdict("Zephyr Xyloborg", bb, None)
        assert result["verdict"] == "possible_match"
        assert result["confidence_score"] >= 0.4

    def test_score_ranges_confirmed(self):
        bb = [{"match_type": "last_first"}]
        doj = {"search_successful": True, "confidence": "high", "total_results": 5}
        result = assess_combined_verdict("John Hoffmann", bb, doj)
        assert result["confidence_score"] >= 0.9

    def test_score_ranges_no_match(self):
        result = assess_combined_verdict("Nobody Here", None, None)
        assert result["confidence_score"] == 0.0


# ── detect_false_positive_indicators() ─────────────────────────────


class TestDetectFalsePositiveIndicators:
    def test_common_last_name(self):
        indicators = detect_false_positive_indicators("John Smith", None, None)
        assert any("common last name" in i.lower() for i in indicators)

    def test_rare_name(self):
        indicators = detect_false_positive_indicators("John Xyloborg", None, None)
        assert len(indicators) == 0

    def test_short_name_last_name_only(self):
        bb = [{"match_type": "last_name_only"}]
        indicators = detect_false_positive_indicators("John Lee", bb, None)
        assert any("short last name" in i.lower() for i in indicators)

    def test_high_doj_count(self):
        doj = {"search_successful": True, "confidence": "low", "total_results": 60}
        indicators = detect_false_positive_indicators("John Xyloborg", None, doj)
        assert any("60 results" in i for i in indicators)

    def test_multiple_indicators_accumulate(self):
        bb = [{"match_type": "last_name_only"}]
        doj = {"search_successful": True, "confidence": "low", "total_results": 100}
        indicators = detect_false_positive_indicators("John Smith", bb, doj)
        # Should have common name + last_name_only on common name + DOJ count indicators
        assert len(indicators) >= 2

    def test_empty_name(self):
        indicators = detect_false_positive_indicators("", None, None)
        assert indicators == []
