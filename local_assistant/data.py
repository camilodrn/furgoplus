"""Explicit read contracts. Replace the synthetic provider only after review."""

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Protocol


class DataUnavailable(Exception):
    """No authorized, current snapshot is available. Never expose internal errors."""


@dataclass(frozen=True)
class Principal:
    subject: str
    role: str = "driver"
    active: bool = True


@dataclass(frozen=True)
class Plan:
    label: str
    status: str  # authoritative effective state, not inferred by the model
    expires_at: datetime | None


@dataclass(frozen=True)
class Capacity:
    service_date: date
    available: int


@dataclass(frozen=True)
class Publication:
    validation: str
    visible: bool  # authoritative publication decision; not just requested


@dataclass(frozen=True)
class Route:
    weekdays: tuple[int, ...]
    start: str
    end: str
    # Deliberately no free-text label, destination, passenger or contact fields.


class AuthorizedQueries(Protocol):
    def plan(self, actor: Principal) -> Plan | None: ...

    def capacity(self, actor: Principal, route_id: str, day: date) -> Capacity: ...

    def publication(self, actor: Principal) -> Publication: ...

    def route(self, actor: Principal, route_id: str) -> Route: ...


DEMO_DAY = date(2026, 10, 26)


class SyntheticQueries:
    """Two synthetic tenants. IDs come from trusted CLI context, never model text.

    This is a permission simulator, NOT authentication for a deployed service.
    Each method checks authorization, including account-only reads.
    """

    @staticmethod
    def _authorize(actor: Principal, route_id: str | None = None) -> None:
        if (
            not actor.active
            or actor.role != "driver"
            or actor.subject not in {"demo-a", "demo-b"}
            or (route_id is not None and route_id != actor.subject + "-route")
        ):
            raise DataUnavailable

    def plan(self, actor: Principal) -> Plan | None:
        self._authorize(actor)
        if actor.subject == "demo-b":
            return None
        return Plan("Pro", "active", datetime(2026, 11, 1, 3, tzinfo=timezone.utc))

    def capacity(self, actor: Principal, route_id: str, day: date) -> Capacity:
        self._authorize(actor, route_id)
        # Never extrapolate a dated fixture to another date.
        if day != DEMO_DAY:
            raise DataUnavailable
        return Capacity(day, 3 if actor.subject == "demo-a" else 0)

    def publication(self, actor: Principal) -> Publication:
        self._authorize(actor)
        if actor.subject == "demo-b":
            return Publication("pending", False)
        return Publication("approved", True)

    def route(self, actor: Principal, route_id: str) -> Route:
        self._authorize(actor, route_id)
        return Route((0, 1, 2, 3, 4), "07:30", "08:15")
