"""Shared fixtures for the AD-Epstein-Index test suite."""

import os
import sys
import json
import pytest

# Add src/ to the Python path so tests can import project modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


@pytest.fixture
def sample_bb_text():
    """Realistic multi-line Black Book excerpt for testing name searches."""
    return """Adams, Cindy
    212-555-0101
    NY, NY

Brooks, Miranda
    44-20-555-0199
    London, UK

Gottschalk, Max
    312-555-0177
    Chicago, IL

Gottschalk, Jane
    312-555-0178
    Chicago, IL

Smith, John
    212-555-0202
    NY, NY

Sullivan, Robert
    305-555-0303
    Palm Beach, FL

Hoffmann, Peter
    49-30-555-0404
    Berlin, Germany

O'Brien, Mary
    353-1-555-0505
    Dublin, Ireland

Bushnell, Candace
    212-555-0606
    NY, NY

Sultanate Holdings LLC
    971-4-555-0707
    Dubai, UAE

Lee, Bruce
    852-555-0808
    Hong Kong
"""


@pytest.fixture
def tmp_data_dir(tmp_path):
    """Temporary data directory with subdirs for researcher file I/O tests."""
    dirs = [
        "cross_references",
        "dossiers",
        "extractions",
    ]
    for d in dirs:
        (tmp_path / d).mkdir()
    return tmp_path
