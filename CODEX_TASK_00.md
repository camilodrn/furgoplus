# Task 00 — Product and architecture freeze

Prepare FurgoPlus for implementation by turning the validated academic project into a small, explicit, buildable MVP architecture for the 14 October 2026 delivery.

This task is documentation and architecture only. Do **not** implement application code yet.

## Product context

FurgoPlus connects parents/guardians with school-transport drivers in Greater Concepción. The validated project requires a multi-user, multi-platform solution with three actors:

- **Parent/guardian (apoderado):** primarily uses the mobile app.
- **Driver (conductor):** uses both the mobile app for daily operation and the web app for administration.
- **Administrator:** uses the web app for validation and control.

The technical direction already selected for the project is:

- Flutter + Dart for the mobile app;
- React for the web app;
- Python + Django + Django REST Framework for the backend/API;
- PostgreSQL as the database;
- REST/JSON over HTTPS;
- one repository containing backend, web and mobile clients;
- Docker Compose for reproducible local backend/web/database development where practical;
- GitHub Actions for CI.

## Locked product decision: one mobile app, role-aware UX

There must be **one Flutter application**, not separate parent and driver applications.

After authentication, the mobile experience must expose features according to the authenticated role.

### Parent mobile experience

The MVP must support, at minimum:

- account registration and login;
- profile basics;
- search for active/visible drivers by commune/coverage area;
- driver profile detail;
- visible verified/validation state without exposing private documents;
- reviews/ratings display;
- comparison between selected drivers;
- controlled contact/request to a driver.

### Driver mobile experience

The driver needs a mobile operational surface because they may be using FurgoPlus during daily work away from a computer.

The MVP mobile scope should support, at minimum:

- login and role-aware home/dashboard;
- today's or current routes/services;
- route details, schedule and available/used capacity information;
- basic passenger/student/service information required for the day's operation, subject to privacy rules;
- start/end or otherwise mark the operational state of a route if this can be implemented without introducing unnecessary complexity;
- **open navigation/map externally** using a destination or route-related location where useful.

For the first release, opening Google Maps / Apple Maps / another installed navigation provider via a normal deep link or platform URL is acceptable. Do not build custom turn-by-turn navigation.

### Driver web experience

The driver web app is the management surface and should include the MVP capabilities needed for:

- profile/service information;
- document upload and validation status;
- routes, schedules, coverage and capacity management;
- basic payment records/statuses;
- basic operational dashboard;
- plan/subscription state and profile-publication status.

### Administrator web experience

The web app must include a protected administrative surface for:

- administrator login;
- list/search/filter of drivers requiring validation;
- review of uploaded driver documents;
- approve/reject driver profile;
- validation observations/history;
- plan activation/change/suspension where required for the MVP;
- suspend/deactivate driver profiles;
- minimum audit/tracing of relevant administrative actions.

## Locked MVP boundary

The October 14 delivery must demonstrate a coherent end-to-end product rather than many half-built features.

The following are **not on the critical path and must remain deferred unless the core MVP is already complete and stable**:

- live GPS tracking of the van for parents;
- continuous/background location streaming;
- real-time map movement;
- route optimization;
- internal real-time chat;
- advanced push notification system;
- automatic absence notifications/workflows;
- payment gateway / Webpay integration;
- automated billing;
- App Store / Play Store production publication;
- microservices, message brokers or other distributed infrastructure.

Architecture must leave a reasonable extension point for future live location without implementing it now.

## Core business rules to preserve

Document these rules clearly and use them as future implementation constraints:

1. A driver may register before being approved.
2. Driver documents are private and must not be exposed to parents.
3. An administrator reviews driver documentation and records a validation result.
4. A driver profile must not become publicly searchable unless the required validation state is approved.
5. The project includes Basic / Pro / Elite plan concepts. For the MVP, plan state may be administered manually; no payment gateway is required.
6. Publication/visibility must respect both validation and active-plan rules when the selected MVP plan model requires them.
7. Parents may only see drivers that are eligible to be visible.
8. Search/comparison must use standardized fields so alternatives can be compared meaningfully.
9. Contact actions must be controlled and must not expose unnecessary personal information.
10. Role and object authorization must be enforced server-side, never only in the clients.

## Authentication decision required

Do not blindly copy another project's browser-only authentication model.

FurgoPlus has both a React browser client and a native Flutter client. Evaluate a secure but low-complexity authentication design appropriate for this MVP and record the choice in an ADR.

Compare at least:

- shared Django session/cookie authentication for web and mobile, including the real CSRF/cookie handling cost in Flutter;
- a token-based mobile approach and the security/storage implications;
- whether using two different auth mechanisms would create unnecessary risk for this deadline.

Prefer the smallest design that is secure, testable and realistic for one first-party web client plus one first-party Flutter app.

Do not introduce social login in the MVP.

## Required repository documentation

Create at least these files:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_SCOPE.md`
- `docs/DATA_MODEL.md`
- `docs/ROADMAP.md`
- `docs/decisions/0001-client-surfaces-and-mobile-roles.md`
- `docs/decisions/0002-authentication-strategy.md`
- `docs/decisions/0003-live-location-boundary.md`

Additional ADRs are allowed only when they capture an actual architectural decision that would otherwise remain ambiguous.

### README

Keep it concise. State what FurgoPlus is, the three actors, selected stack, repository layout expected for implementation, and the October MVP goal. Do not claim features are implemented when only architecture exists.

### Architecture

Define the intended structure, preferably a modular monolith:

```text
Flutter mobile (parent + driver)
               \
                REST API -> Django + DRF -> PostgreSQL
               /
React web (driver + admin)
```

Avoid microservices for this deadline.

Document client responsibilities, backend responsibilities, privacy boundaries, file/document handling assumptions, environments, deployment assumptions, CI/testing direction and future live-location extension point.

### Product scope

Separate clearly:

- October MVP;
- optional stretch work only after MVP stability;
- deferred/future functionality.

Include explicit user journeys for parent, driver and administrator.

### Data model

Produce an implementation-oriented conceptual model. At minimum analyze the need for entities equivalent to:

- User / role;
- ParentProfile;
- DriverProfile;
- DriverDocument;
- DriverValidation or validation state/history;
- Plan / DriverSubscription or equivalent;
- Route / service route;
- capacity/seat information;
- ContactRequest;
- Review;
- PaymentRecord;
- AdminActionLog.

Do not create entities just to mirror screens. Prefer normalized relationships and explicit finite states where business rules require them.

Identify which records contain sensitive personal data and which must never be returned in public driver-profile responses.

### Roadmap

Create an implementation sequence suitable for the deadline. Use small vertical tasks similar to:

1. foundation / repository / CI;
2. accounts, roles and authentication;
3. driver onboarding and validation;
4. plans/publication rules;
5. Flutter foundation and role-aware navigation;
6. parent mobile flow;
7. driver mobile operation;
8. driver web management;
9. admin web validation/control;
10. integration, hardening, demo/release candidate.

Adjust ordering if needed, but explain any material change.

The technical freeze date should target **13 October 2026**, leaving 14 October for delivery/demo rather than feature development.

## Testing and quality direction

Document a realistic quality baseline for later tasks:

- backend model/service/API tests for business rules and authorization;
- React component/integration tests for important web flows;
- Flutter unit/widget tests for important mobile flows;
- API contract tests where they reduce client/backend drift;
- a small end-to-end smoke path covering the critical parent-driver-admin journey;
- formatting, linting, static/type checks and builds in CI;
- migrations checked in CI;
- no committed secrets.

## Security/privacy baseline

The architecture must explicitly cover:

- password hashing through Django;
- secure authentication/session/token handling based on ADR 0002;
- server-side role/object authorization;
- CSRF if cookie/session authentication is used where applicable;
- safe file upload validation and private driver-document access;
- no direct public URLs to sensitive driver documents;
- no unnecessary exposure of phone/email/address information;
- environment-based secrets/configuration;
- HTTPS in deployed environments;
- auditability of administrator validation actions.

Do not claim regulatory compliance merely because these controls exist.

## Working rules for Codex

- Work autonomously inside the repository.
- `workspace-write` is expected.
- Do not ask for routine approvals.
- Do **not** commit, push, merge or deploy.
- Do not implement application code in Task 00.
- Do not add dependencies in Task 00.
- Keep documentation concise enough to remain useful to later coding agents; avoid duplicated prose across files.
- Record assumptions and unresolved decisions explicitly rather than silently inventing product behavior.
- If a choice would materially change user-visible scope or the October deadline, document the question instead of expanding scope.

## Completion criteria

Task 00 is complete when:

- the required documentation exists and is internally consistent;
- one Flutter app with parent/driver role-aware navigation is the documented mobile architecture;
- React web is the management/admin surface;
- Django/DRF/PostgreSQL is the documented backend/data architecture;
- authentication has a concrete ADR decision suitable for both web and Flutter;
- live GPS tracking is explicitly deferred while future extensibility is preserved;
- privacy boundaries for driver documents and personal data are explicit;
- October MVP vs future scope is unambiguous;
- the data model is concrete enough for Task 01/02 implementation planning;
- the roadmap is sequenced through the October 13 technical freeze;
- no application code has been introduced.
