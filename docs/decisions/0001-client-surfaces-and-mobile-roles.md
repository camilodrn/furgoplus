# ADR 0001 — Client surfaces and mobile roles

Status: accepted. Date: 23 September 2026.

## Context and decision

Parents primarily discover transport on mobile; drivers need daily operation away from a computer and fuller management on web. Administrators need document review and control. The deadline cannot support separate mobile products.

Use **one Flutter/Dart application** for parents and drivers. After login, fetch the server's current user/role and expose the appropriate navigation tree. Parent navigation covers discovery/comparison/contact; driver navigation covers today's services, route details, passenger information and start/end actions. Restore sessions before selecting a home screen; clear private state on logout/account change. An administrator mobile login receives an unsupported-surface message and logout option, never driver privileges.

Use **one React web application** with protected driver-management and administrator sections. A parent web login receives a mobile-use message and logout option. Driver registration is on web; parent registration is on mobile. Public signup cannot assign the administrator role. One account has one immutable product role in the MVP.

All surfaces consume the Django/DRF REST API; PostgreSQL is accessed only by the backend. Server permission and ownership checks remain mandatory for direct requests regardless of which client exposes an action.

## Alternatives and consequences

- Separate parent/driver Flutter apps duplicate releases, authentication and UI infrastructure; rejected by the locked product decision.
- A browser-only driver experience misses daily mobile operation; rejected.
- Putting every management/admin screen on mobile increases scope without supporting the minimum journey; deferred.

Share Flutter networking/authentication and reusable widgets, but keep role-specific navigation/features separate. React management and Flutter operation may have different screens backed by the same domain services. New roles or multi-role accounts require a later decision. See [scope](../PRODUCT_SCOPE.md) for the precise feature allocation.
