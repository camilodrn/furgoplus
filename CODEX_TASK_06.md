# Task 06 — Driver roster, interval capacity, manual payments

This contract follows `docs/PRODUCT_SCOPE.md`, `docs/DATA_MODEL.md`, `docs/ROADMAP.md`, ADRs 0001–0006, and the accepted Task 04 publication and Task 05 contact/privacy behavior. Preserve existing route ownership, revision, coverage, destination privacy, publication eligibility, and session/CSRF rules. Task 07 owns RouteRun and driver-mobile operation.

## Deliverable

- Complete owner-driver React route editing and show each route's next America/Santiago service date, used seats, and available seats.
- Add private one-route PassengerAssignment with minimum display name, pickup, guardian, and inclusive `starts_on`/nullable `ends_on` fields. Owner-driver can list, create, safely edit, and end; route changes use a new record. No hard delete or automatic assignment from contact acceptance. Q6 is unresolved, so acceptance data is fictional and the field/consent policy is not production approved.
- For MVP/demo roster entry, guardian phone accepts exactly nine local Chilean digits. This validation uses fictional data and does not settle Q6 or the production child/guardian intake policy.
- Derive `used_seats(route,d)` from assignments active on d; `available_seats = seat_capacity - used_seats`. Validate only scheduled weekdays, across every intersecting interval without a horizon. Route and assignment writes lock the route row in PostgreSQL transactions before validation. Exact final seat succeeds; overbooking fails. No editable counter.
- Parent discovery, eligible driver detail, and comparison reuse Task 04 eligibility and one public serializer. Every public route returns `next_service_date`, `used_seats`, and `available_seats` for that exact date, without private roster, destination, contact, or payment fields. Do not sum across routes.
- Add owner-only PaymentRecord tied to an assignment of the same driver: period, positive integer CLP amount, due date, pending/paid/void, server-owned `paid_at`, timestamps. Allow pending→paid, pending→void, paid→void (retaining paid_at); void is terminal. No hard delete or driver subscription effect.
- Add a concise driver summary of validation, plan, publication, routes/dated capacity, active assignments, and payment counts. Add React routes, roster, payments, and summary screens in the existing Spanish design language.

## Boundaries and gates

- Cross-driver guessed IDs and FKs fail closed. Parent, admin, and anonymous roles cannot use owner roster/payment APIs. Private responses use no-store. Do not log child, guardian, pickup, payment, private contact, cookie, or CSRF data.
- No parent booking/payment, automatic reservation, gateway/Webpay, card/bank details, billing, attendance, GPS, RouteRun, Flutter roster, production child intake, deployment, or new plan-tier behavior.
- Update migrations, API registry/OpenAPI, generated React types, backend and web regression tests. Include PostgreSQL `TransactionTestCase` final-seat concurrency and all stated Task 06 gates. Keep Tasks 00–05 green.
- Run backend formatting, lint, checks, migrations, targeted/full tests, OpenAPI check; web format, contract, lint, typecheck, tests, build, audit; `git diff --check`. If PostgreSQL/Docker is inaccessible, record exact unrun commands and do not claim concurrency verification.
- Do not reset, revert, discard, commit, push, merge, deploy, or change Git history.
