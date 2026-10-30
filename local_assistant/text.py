"""Shared text normalization; no history, logging or query memoization."""

import re
import unicodedata


def normalize(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", text.casefold())
                   if not unicodedata.combining(c))


def canonical(text: str) -> str:
    text = normalize(text)
    text = re.sub(r"\b(?:por favor|porfa|porfis|en detalle|con detalle|mas informacion)\b", " ", text)
    return " ".join(re.findall(r"[a-z0-9]+", text))
