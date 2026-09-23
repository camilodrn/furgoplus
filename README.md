# FurgoPlus

FurgoPlus connects parents/guardians with school-transport drivers in Greater Concepción. The October MVP targets a complete discovery, validation, contact and daily-operation journey for three actors:

- **Parent/guardian:** mobile discovery, comparison and controlled contact.
- **Driver:** mobile daily operation and web service administration.
- **Administrator:** web document validation, plans and profile control.

**Status:** architecture and documentation only. There is no runnable application, dependency setup or CI pipeline yet. [Task 00](CODEX_TASK_00.md) is the source brief. Technical freeze: **13 October 2026**; delivery/demo: **14 October 2026**.

The selected stack is one role-aware Flutter/Dart app, React web, a Django/Python + Django REST Framework modular monolith, PostgreSQL, and REST/JSON over HTTPS. Implementation will use Docker Compose for local backend/web/database development and GitHub Actions for CI. Live GPS, chat and payment gateways are outside the critical path.

Expected implementation layout (only the documentation paths currently exist):

```text
backend/           Django project, domain apps, API and tests
web/               React driver/admin application and tests
mobile/            Single Flutter parent/driver application and tests
infra/             Local Compose and deployment configuration
.github/workflows/ CI
docs/              Product, architecture, data model, roadmap and ADRs
```

Read [product scope](docs/PRODUCT_SCOPE.md), [architecture](docs/ARCHITECTURE.md), [data model](docs/DATA_MODEL.md) and [roadmap](docs/ROADMAP.md) before implementation. The accepted ADRs cover [client surfaces](docs/decisions/0001-client-surfaces-and-mobile-roles.md), [authentication](docs/decisions/0002-authentication-strategy.md), [live location](docs/decisions/0003-live-location-boundary.md) and [publication eligibility](docs/decisions/0004-publication-eligibility.md). Open product questions and their safe interim assumptions live in the product scope.
