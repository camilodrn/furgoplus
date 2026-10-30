"""Versioned public knowledge, loaded once. Never reads conversational data.

GUIDES and faq_answer preserve the original FAQ interface. Sources and scope
are review metadata, never an assertion of deployed/commercial availability.
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType

from .text import canonical


@dataclass(frozen=True)
class Guide:
    question: str
    sentences: tuple[str, ...]
    source: str
    id: str
    area: str
    reviewed_on: str
    status: str
    commercial_available: bool
    scope: str
    aliases: tuple[str, ...]
    patterns: tuple[str, ...]


def load_knowledge(path: Path):
    from datetime import date

    document = json.loads(path.read_text(encoding="utf-8"))
    if document["schema_version"] != 1 or not document["version"]:
        raise ValueError("Versión de conocimiento inválida")
    guides = {}
    for item in document["entries"]:
        guide = Guide(**{**item, "sentences": tuple(item["sentences"]),
                         "aliases": tuple(item["aliases"]), "patterns": tuple(item["patterns"])})
        if (not re.fullmatch(r"[a-z][a-z_]+", guide.id) or guide.id in guides
                or not 1 <= len(guide.sentences) <= 3
                or any(not isinstance(s, str) or not s.strip() for s in guide.sentences)
                or not all(isinstance(s, str) and s.strip() for s in (
                    guide.source, guide.scope, guide.area, guide.question))
                or guide.status not in {"implemented_demo", "experimental", "commercial_unavailable"}
                or guide.commercial_available is not False):
            raise ValueError("Conocimiento sin procedencia, alcance o identificador válido")
        date.fromisoformat(guide.reviewed_on)
        for alias in guide.aliases:
            if not canonical(alias):
                raise ValueError("Alias vacío")
        for pattern in guide.patterns:
            re.compile(pattern)
        guides[guide.id] = guide
    if not guides:
        raise ValueError("Catálogo vacío")
    return document["version"], MappingProxyType(guides)


KNOWLEDGE_VERSION, GUIDES = load_knowledge(Path(__file__).with_name("knowledge.json"))


def faq_answer(topic: str, detailed: bool = False) -> str:
    return " ".join(GUIDES[topic].sentences[:3 if detailed else 1])
