# ADR 0004 — Manual plans and derived publication eligibility

Status: accepted for the October MVP. Date: 23 September 2026.

## Context and decision

Approval, plan state and driver publication intent must not become contradictory client-maintained booleans. The brief leaves the exact plan gate open; choose an explicit manually activated plan requirement. Basic, Pro and Elite are seeded plan codes with **identical MVP capabilities**. Pricing, paid ranking and differentiated entitlements remain unresolved product policy, not implicit functionality.

A driver's profile is eligible for parent discovery if and only if all of the following hold:

```text
user.is_active
AND driver.status == active
AND driver.publication_requested
AND driver.validation_state == approved
AND approved_revision == current_validation_revision
AND required documents are present and not expired
AND subscription.status == active
AND subscription.starts_at <= now < subscription.ends_at
AND required public profile fields and private service-contact email are complete
AND at least one active route exists
```

Required public fields: display name, service summary and coverage derived from active routes. An active route must have standardized coverage, valid days/time window, destination and positive seat capacity. Full routes remain visible with zero availability; visibility is not a seat reservation guarantee. Document expiration dates remain valid through the end of that date in America/Santiago. Subscription instants use the half-open UTC interval shown above.

Implement one backend eligibility policy reused by list, search, comparison, detail, ratings retrieval and new contact creation/acceptance. Recheck on every request, including direct IDs; hidden drivers return 404 to discovery callers. Return publication blockers privately to the owning driver/admin. Do not store a separate authoritative `is_public` field or depend on a periodic job to hide expired plans/documents. Avoid discovery response caching in the MVP.

Only administrators activate/change/suspend subscriptions. No plan is active at signup. An absent subscription, inactive status or elapsed validity window fails closed. Approval and plan activation are independent and individually audited. Transport PaymentRecord entries never activate plans.

Suspension/deactivation hides discovery but is separate from account disabling. Existing request participants can still inspect their minimal private history, but cannot start a new request or accept a pending one for an ineligible driver. Suspension is not proof that retained operational data should be deleted. Only disabling the account blocks all its authenticated use.

## Alternatives and consequences

- Approval-only publication would leave plan concepts unrelated to publication and require a later behavior change; rejected for this MVP baseline.
- An automatically active free Basic plan is plausible but invents commercial policy; deferred pending product confirmation.
- Independent visibility switches in multiple clients can expose unapproved/expired profiles; rejected.

Admin work is required before a new driver becomes discoverable. Test every gate alone and in combination: neither an active plan nor driver intent overrides rejected/pending validation, expired documents, suspension or account disabling. Changing plan benefits or allowing a free plan requires an explicit update to this decision and the affected tests.
