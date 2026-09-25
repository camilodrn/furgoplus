# Task 07 — Driver mobile daily route operation

This contract follows `docs/PRODUCT_SCOPE.md`, `docs/DATA_MODEL.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, ADRs 0002–0004, and Task 06. Issue #15 was unavailable from the sandbox; the supplied issue requirements are the Task 07 acceptance source. Preserve Task 00–06 behavior.

## Deliverable

- Derive the service date on the server in America/Santiago. Owner-driver `today` projects active routes scheduled for that date with schedule, dated seats, private destination, and only active minimal passenger details. It also lists unfinished earlier runs. GET never creates RouteRun.
- Persist RouteRun uniquely by route and service date. Start today only; lock the route, materialize once, snapshot schedule/capacity, set server timestamp, and return an existing in-progress run on repeats. Completed starts and planned ends conflict. End in-progress runs, including earlier unfinished runs, with a server timestamp; repeated end returns the completed run. Never auto-complete.
- While today's run is in progress, reject route status/schedule/capacity/destination edits and assignment create/edit/end changes that affect today's active roster. Permit future-only assignment changes under Task 06 interval capacity checks. No immutable historical roster snapshot.
- Use the same Flutter app and session API for a driver home with server date, route cards, roster, destination, explicit start/complete, loading/empty/retry states, and external destination launch. Launcher errors leave server state unchanged. Keep role-specific private UI data scoped to a session.
- Add migrations, OpenAPI and focused backend/Flutter regression coverage. Keep parent discovery/contact/admin-general allowlists and no-store private responses.

## Boundaries

No passenger daily statuses, attendance, absence reasons, stop progression, historical roster history, GPS or location permission, tracking, optimization, internal navigation, chat, push, offline sync, or mobile administration. Leave changes uncommitted; do not push, merge, deploy or rewrite history.
