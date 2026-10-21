"""Character error rate for Thai transcripts (no word boundaries in Thai, so CER not WER)."""
from __future__ import annotations

import re
import unicodedata

_PUNCT = re.compile(r"[\s\.\,\!\?\:\;\-\–\—\"'“”‘’\(\)\[\]…ฯๆ]+")


def normalize(text: str) -> str:
    """NFC, lower-case latin, drop spaces/punctuation so only spoken characters remain."""
    t = unicodedata.normalize("NFC", text).lower()
    return _PUNCT.sub("", t)


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer(reference: str, hypothesis: str) -> float:
    """Edits / reference length, on normalized text. Empty reference -> 0.0 if hypothesis empty else 1.0."""
    r = normalize(reference)
    h = normalize(hypothesis)
    if not r:
        return 0.0 if not h else 1.0
    return levenshtein(r, h) / len(r)
