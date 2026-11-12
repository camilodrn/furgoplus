"""Versioned commercial entitlements, separate from shipped functionality.

This supplements role/ownership/domain authorization; it never replaces it.
"""

from dataclasses import dataclass
from types import MappingProxyType

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from accounts.models import DriverProfile, User
from drivers.models import DriverSubscription

CATALOG_VERSION = "2026-10-19.3"


@dataclass(frozen=True)
class Capability:
    plans: frozenset[str]
    implemented: bool = False
    requires_subscription: bool = True


@dataclass(frozen=True)
class CommercialPlan:
    label: str
    monthly_price_clp: int
    support_priority: str


PLANS = MappingProxyType(
    {
        "basic": CommercialPlan("Básico", 19990, "standard"),
        "pro": CommercialPlan("Pro", 39990, "preferred"),
        "elite": CommercialPlan("Elite", 69990, "priority"),
    }
)
ALL_PLANS = frozenset(PLANS)
CAPABILITIES = MappingProxyType(
    {
        "operations.core": Capability(ALL_PLANS, True, False),
        "dashboard.basic": Capability(ALL_PLANS, True, False),
        "reports.monthly.read": Capability(frozenset({"pro", "elite"}), True),
        "reports.detail.read": Capability(frozenset({"elite"}), True),
        "reports.xlsx.export": Capability(frozenset({"elite"}), True),
        "analytics.period_comparison": Capability(frozenset({"elite"}), True),
        "help.center": Capability(ALL_PLANS, True, requires_subscription=False),
        "support.requests": Capability(ALL_PLANS, True, requires_subscription=False),
        "assistant.faq": Capability(frozenset({"pro", "elite"}), True),
        "assistant.contextual": Capability(frozenset({"elite"}), True),
    }
)


def subscription_blockers(subscription, now):
    """Fail closed for missing, malformed or unknown assignments."""
    if subscription is None:
        return ["subscription_missing"]
    blockers = []
    if subscription.plan.code not in PLANS:
        blockers.append("plan_unknown")
    if subscription.status != "active":
        blockers.append(
            "subscription_suspended"
            if subscription.status == "suspended"
            else "subscription_inactive"
        )
    start, end = subscription.starts_at, subscription.ends_at
    if start is None or end is None or end <= start:
        blockers.append("subscription_invalid_window")
    else:
        if now < start:
            blockers.append("subscription_not_started")
        if now >= end:
            blockers.append("subscription_expired")
    return blockers


def driver_capabilities(user, *, now=None):
    """Resolve only the authenticated user's profile; no caller-supplied owner ID."""
    if not user.is_authenticated or not user.is_active or user.role != User.Role.DRIVER:
        raise PermissionDenied()
    driver = get_object_or_404(DriverProfile, user=user)
    now = now or timezone.now()
    subscription = (
        DriverSubscription.objects.select_related("plan").filter(driver=driver).first()
    )
    blockers = subscription_blockers(subscription, now)
    profile_blockers = [] if driver.status == "active" else ["driver_unavailable"]
    plan_code = subscription.plan.code if subscription else None
    plan = PLANS.get(plan_code)
    capabilities = {}
    for code, definition in CAPABILITIES.items():
        included = plan_code in definition.plans
        reasons = []
        if definition.requires_subscription:
            reasons.extend(profile_blockers + blockers)
            if not included:
                reasons.append("plan_not_included")
        if not definition.implemented:
            reasons.append("not_implemented")
        capabilities[code] = {
            "included_in_plan": included,
            "implemented": definition.implemented,
            "enabled": not reasons,
            "blockers": reasons,
        }
    return {
        "catalog_version": CATALOG_VERSION,
        "evaluated_at": now.isoformat(),
        "plan": {
            "code": plan_code,
            "label": plan.label,
            "monthly_price_clp": plan.monthly_price_clp,
            "currency": "CLP",
            "billing_period": "month",
            "commercial_proposal": True,
            "automatic_billing": False,
            "support_priority": plan.support_priority,
        }
        if plan
        else None,
        "subscription": {
            "status": subscription.status,
            "starts_at": subscription.starts_at.isoformat()
            if subscription.starts_at
            else None,
            "ends_at": subscription.ends_at.isoformat()
            if subscription.ends_at
            else None,
            "effective": not blockers,
        }
        if subscription
        else None,
        "blockers": profile_blockers + blockers,
        "capabilities": capabilities,
    }


def require_capability(user, code):
    """Reusable server gate for future endpoints, in addition to object checks."""
    capabilities = driver_capabilities(user)["capabilities"]
    if code not in capabilities or not capabilities[code]["enabled"]:
        raise PermissionDenied(
            "Capacidad no disponible.", code="capability_unavailable"
        )
