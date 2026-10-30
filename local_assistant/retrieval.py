"""Small public index: exact normalized aliases and bounded full-match rules.

There is no similarity threshold that can turn a shared noun into a fact.
Only reviewed complete equivalents are high confidence. Conflicts abstain.
No original query, answer or account result is cached.
"""

import re
from dataclasses import dataclass
from types import MappingProxyType

from .guides import GUIDES
from .text import canonical, normalize


def _index():
    aliases = {}
    patterns = []
    for key, guide in GUIDES.items():
        for question in (guide.question, *guide.aliases):
            aliases.setdefault(canonical(question), set()).add(key)
        patterns.extend((key, re.compile(pattern)) for pattern in guide.patterns)
    return MappingProxyType({k: frozenset(v) for k, v in aliases.items()}), tuple(patterns)


ALIASES, PATTERNS = _index()


@dataclass(frozen=True)
class Retrieval:
    topic: str | None = None
    confidence: str = "abstain"
    reason: str = "no_evidence"


def public_question(text: str) -> str:
    # Ignore only a trailing DECLARATIVE personal annotation after a complete
    # explicit question. Account/privacy guards inspect the entire input first.
    # This preserves safe FAQ answers when someone appends personal details;
    # no substring from that annotation becomes a search/model input.
    parts = re.split(r"[?.]", normalize(text), maxsplit=1)
    if len(parts) == 2:
        first, tail = parts
        if (re.match(r"\s*mi hij[oa]\b", tail)
                and not re.search(r"[?¿]|\b(cuando|cuanto|como|donde|dime|dame)\b", tail)):
            return first
    return text


def retrieve(text: str) -> Retrieval:
    query = canonical(public_question(text))
    hits = set(ALIASES.get(query, ()))
    rule_hits = {key for key, pattern in PATTERNS if pattern.fullmatch(query)}
    hits.update(rule_hits)
    if len(hits) > 1:
        return Retrieval(reason="conflicting_evidence")
    if hits:
        topic = next(iter(hits))
        return Retrieval(topic, "high", "alias" if topic in ALIASES.get(query, ()) else "reviewed_rule")
    return Retrieval()
