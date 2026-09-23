# Task 03 — Driver onboarding, private documents and admin validation

Implement the first FurgoPlus domain slice on top of the proven Task 02 authentication foundation: a driver can complete a minimal onboarding profile, upload a clearly demo-only private document set, submit an immutable validation revision, read observations/history, replace documents and resubmit; an administrator can review the exact submitted revision, privately retrieve its documents, and approve or reject it with an atomic audit record.

Read the repository documentation first, especially:

- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_SCOPE.md`
- `docs/DATA_MODEL.md`
- `docs/ROADMAP.md`
- `docs/decisions/0002-authentication-strategy.md`
- `docs/decisions/0004-publication-eligibility.md`
- `docs/AUTH_ACCEPTANCE.md`
- `CODEX_TASK_02.md`

Task 00 remains authoritative for product scope. Task 02 authentication is now proven on real HTTPS/Android and must remain intact. Do not silently expand the MVP.

## Product goal

After this task:

- a driver who registered in React can manage the minimum profile fields needed for onboarding;
- the driver sees a configured, explicitly synthetic/demo validation checklist and can upload private PDF/JPEG/PNG documents for it;
- uploaded file versions are immutable, private and replaceable only by creating a new version;
- the driver can submit a complete validation revision and later see pending/approved/rejected/superseded history plus private admin observations;
- an administrator has a minimal React validation queue/detail surface;
- the administrator reviews the exact immutable revision and can approve or reject it with observations;
- stale review cannot approve a revision after validation material changed;
- document access is limited to the owning driver and authorized administrator, with administrator reads audited;
- decision + driver validation state + append-only audit entry are committed atomically;
- real-document onboarding remains explicitly blocked until Product Scope Q3 and malware/quarantine policy are resolved.

This task does **not** implement plans, publication, routes, discovery, contact requests, passengers, payments, runs or GPS.

## Q3 / demo-only boundary is binding

Product Scope Q3 is unresolved. Do not invent or claim a Chilean legal compliance checklist.

Implement a configurable **demo checklist** sufficient to exercise the workflow and tests. It must be visibly labeled as synthetic/demo-only in the driver/admin UI and documentation. Use neutral identifiers/labels rather than claiming they satisfy a legal standard. A reasonable checked-in demo configuration may include three kinds such as:

- `demo_identity_document` — no expiry required;
- `demo_vehicle_document` — expiry required;
- `demo_expiring_credential` — expiry required.

If an equivalent neutral configuration fits the repository better, use it, but keep it small and deterministic. Do not introduce real RUT/license/permit semantics or compliance claims without a product decision.

The checklist representation must expose at least:

- stable kind code;
- Spanish demo label;
- whether an expiration date is required;
- allowed file types inherited from the upload policy.

Until Q3 and malware-scanning/quarantine are resolved:

- the UI must state that only known-safe synthetic files may be uploaded;
- documentation must state that real onboarding is blocked;
- fixtures/tests must contain only generated/sanitized synthetic files;
- do not describe the controls as regulatory compliance or malware detection.

## Driver profile boundary

Extend the existing `DriverProfile` only as required by the accepted data model. The driver web surface may read/update:

- `display_name`;
- `service_summary`;
- `service_contact_email`.

Rules:

- only the owning driver can mutate the profile through driver APIs;
- `display_name` is conservatively validation-sensitive until Q3 is resolved;
- `service_summary` and `service_contact_email` are not validation-sensitive and do not rewrite historical validation snapshots;
- status/publication/validation decision fields are never client-writable through this profile endpoint;
- changing a submitted validation-sensitive field invalidates the current approval/pending material according to the revision rules below;
- do not implement publication intent UI in this task even though the model already contains the field.

Use explicit serializers/contracts. Never serialize the whole model and hide administrator-owned fields in the UI.

## Validation domain model

Implement the conceptual entities from `docs/DATA_MODEL.md` needed by Task 03:

### DriverDocument

Many-to-one from driver profile with at least:

- checklist `kind`;
- opaque generated private storage key;
- detected/accepted content type;
- byte size;
- SHA-256 hash;
- upload timestamp;
- optional `expires_on`;
- `is_current` selection flag.

Constraints/behavior:

- contents and stored metadata are immutable after creation;
- replacing a current file creates a new row and changes selection flags; never overwrite file bytes in place;
- at most one current document per driver/kind;
- document belongs permanently to one driver;
- storage key and sensitive metadata are owner/admin-only and never part of parent/public contracts;
- referenced/reviewed versions are retained; do not hard-delete them merely because a replacement is uploaded.

### DriverValidation

Many-to-one from driver profile with:

- integer revision;
- immutable submitted identity snapshot for the validation-sensitive profile fields in force for this task;
- state `pending / approved / rejected / superseded`;
- submitted timestamp;
- nullable reviewer admin;
- nullable reviewed timestamp;
- nullable observations.

Constraints:

- unique `(driver, revision)`;
- submission snapshot contents are immutable;
- decision fields are written once;
- reviewer must be an administrator account;
- history is retained.

### ValidationDocument

Join between validation and document with stored checklist kind.

Constraints:

- unique `(validation, kind)`;
- each referenced document must belong to the same driver as the validation;
- one required file per checklist kind for the MVP;
- a document may appear in successive revisions if it remains current;
- the join freezes exactly which file version was reviewed.

### AdminActionLog

Implement the accepted append-only audit record needed by this slice with at least:

- actor administrator;
- action code;
- target type/id;
- timestamp;
- request/correlation identifier where the current request stack supports one, otherwise a generated application correlation identifier;
- reason or decision observation where appropriate;
- minimal before/after state.

Do not store document bytes, password/session/CSRF values, full request bodies or unrelated private contact data in audit entries.

Task 03 must record at least:

- administrator validation approval;
- administrator validation rejection;
- administrator document retrieval/read.

Decision audit is atomic with the state transition. Document-read audit occurs before/with the authorized stream response in a normal application transaction; do not claim it is tamper-proof against database operators.

## Revision and invalidation rules

Use the conceptual rules in `DATA_MODEL.md` and make them deterministic in service code and tests.

- New driver profile begins `validation_state=draft`, `current_validation_revision=1`, `approved_revision=null`.
- Initial draft editing/uploading before revision 1 has ever been submitted may continue within revision 1.
- `POST submit` freezes the current validation-sensitive identity snapshot and the current document versions under that revision.
- Repeating submit while that exact revision is still pending returns the existing pending submission rather than creating a duplicate.
- If validation-sensitive profile data or a current required document is changed after the current revision has been submitted, lock the driver; mark an undecided old submission `superseded`; advance `current_validation_revision`; clear `approved_revision`; set profile validation state to `draft`.
- Approved/rejected historical submissions are never rewritten.
- Resubmitting after rejection without any material edit still advances to a new revision before freezing the new submission, so two submissions never share a driver/revision key.
- Gaps in revision numbers are acceptable; duplicate `(driver, revision)` submissions are not.

Keep this logic in transactional domain/service functions rather than scattering it through React or model `save()` side effects.

## Submission completeness

A driver may submit only when:

- every configured required demo checklist kind has one current document;
- kinds that require expiry have `expires_on` present;
- required documents are not already expired on the current `America/Santiago` local date;
- the validation-sensitive identity/profile requirements for this task are present;
- all documents belong to the driver.

If incomplete, return the standard API error envelope with field/checklist details useful to the owning driver. Do not reveal storage paths.

At admin decision time recheck that the pending validation is still the driver's current revision. Also reject approval of a revision whose required snapshot documents are already expired. A document expiring **after** historical approval does not rewrite that historical decision; Task 04 will use current expiry as an independent publication blocker.

## File upload and private storage

Follow the `Driver documents` section of `docs/ARCHITECTURE.md`.

### Storage

- Store document bytes only under `PRIVATE_UPLOAD_ROOT`, outside static/public/media roots.
- Use generated opaque storage keys; never use a user-supplied path as a storage location.
- Keep the current local persistent private volume behavior from Compose.
- Stage/validate bytes privately and ensure failed uploads do not leave durable database rows or orphaned staged files.
- Database and private files are a coupled backup unit; Task 03 only documents this, while the restore rehearsal remains Task 09.

### Limits and accepted formats

For this MVP:

- accepted: PDF, JPEG and PNG only;
- maximum size: 10 MiB per file;
- one uploaded file per request;
- reject executable/archive/SVG/HTML and unknown formats;
- reject extension / declared content type / detected signature mismatches;
- structurally parse accepted formats rather than checking only the extension;
- enforce conservative image dimension/pixel limits to avoid decompression-bomb-style inputs;
- add only the minimal maintained parsing dependency/dependencies required and pin them consistently with the repository's dependency policy.

Do not weaken parser safety warnings globally. If a safe pure-Python parser can satisfy the checks, prefer it over adding native host-library requirements solely for MIME detection.

Use a bounded upload throttle suitable for the single-host MVP (for example per authenticated driver/source) without Redis/brokers. Document and test the chosen rate. Do not delete retained document history merely to enforce the rate.

### Downloads

Provide backend-authorized attachment endpoints. Required behavior:

- owner driver can retrieve only their own document versions;
- administrator can retrieve validation documents for review;
- another driver receives no access to another driver's documents;
- parent receives no document bytes or private metadata;
- anonymous access is denied;
- direct IDs do not bypass ownership/role checks;
- responses use `Content-Disposition: attachment` with a server-generated safe filename, explicit accepted content type, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store`;
- no public media path, public URL or presigned URL is returned;
- admin download records an `AdminActionLog` entry;
- never log bytes, storage keys or file body contents.

Prefer 404 for cross-owner/direct-ID object lookups where the API boundary is intended to hide existence; preserve the existing auth error semantics for unauthenticated requests.

## Suggested API boundary

Keep versioning under `/api/v1/` and the existing error envelope. Exact internal view class names are implementation details, but implement a coherent resource family equivalent to:

### Driver owner

- `GET /api/v1/driver/profile/`
- `PATCH /api/v1/driver/profile/`
- `GET /api/v1/driver/validation/checklist/`
- `GET /api/v1/driver/documents/`
- `POST /api/v1/driver/documents/` — multipart upload
- `GET /api/v1/driver/documents/{id}/download/`
- `GET /api/v1/driver/validations/` — history/current state
- `POST /api/v1/driver/validations/submit/`

### Administrator

- `GET /api/v1/admin/validations/` — bounded queue/history list, at least filterable by validation state
- `GET /api/v1/admin/validations/{id}/`
- `GET /api/v1/admin/documents/{id}/download/`
- `POST /api/v1/admin/validations/{id}/approve/`
- `POST /api/v1/admin/validations/{id}/reject/`

The implementation may consolidate read endpoints when that produces a simpler stable contract, but do not collapse driver/admin permissions or expose private model fields for convenience.

Unsafe endpoints must continue to use the Task 02 CSRF/session protocol. Multipart upload still requires CSRF.

Use:

- 400 for malformed/completeness validation;
- 404 for hidden/out-of-owner objects;
- 409 for stale/invalid validation transitions;
- 413 (or a consistent documented validation response if framework handling makes 413 unsafe) for oversized uploads;
- existing auth/CSRF error semantics for authentication failures.

Update `backend/openapi.json` through the generator and keep the typed React contract current. Describe multipart/binary responses accurately enough that generated/handwritten boundary types do not pretend downloads are JSON.

## Administrator decision semantics

Approval/rejection is an explicit action, not generic model CRUD.

Both actions must:

- require administrator role server-side;
- lock the driver and validation rows in a database transaction;
- require validation state `pending`;
- require `validation.revision == driver.current_validation_revision`;
- reject stale/superseded/already-decided revisions with a consistent 409 machine code;
- never allow a client to choose reviewer/timestamps/revision/driver IDs inside the mutation payload;
- require nonblank bounded observations; an approval note may be short, rejection must be actionable in the UI;
- write reviewer and reviewed timestamp once;
- update `DriverProfile.validation_state` and `approved_revision` consistently;
- append the corresponding admin audit entry in the same transaction.

Approval sets the current profile to approved and `approved_revision` to the reviewed revision. Rejection sets current profile state to rejected and leaves/clears `approved_revision` so no rejected current revision can be treated as approved.

A decision must never silently approve a revision whose documents/profile changed while the administrator had the screen open.

## React driver onboarding UI

Extend the authenticated driver shell only enough for this slice.

Provide a clear minimal workflow:

- profile basics form (`display_name`, `service_summary`, `service_contact_email`);
- prominent synthetic/demo-only document warning;
- configured checklist with current file state and expiry state;
- upload/replace action per checklist kind;
- submission blockers/completeness display;
- submit-for-validation action;
- current state `draft / pending / approved / rejected`;
- validation history with revision, timestamps, state and private observations;
- owner download for their own uploaded versions where useful;
- disabled/loading/error states that prevent accidental duplicate submissions.

Do not expose storage keys, hashes or administrator audit internals in normal driver UI.

Do not implement routes, plans, publication controls or contact requests here.

## React administrator validation UI

Extend the authenticated admin shell with a minimal validation surface:

- validation queue/list with state filtering and bounded results;
- driver display name/email only where necessary for administrator identification in this private screen;
- validation revision/state/submitted timestamp;
- detail showing immutable identity snapshot and exact referenced document list;
- authorized download action per submitted document;
- observations input;
- approve and reject actions with explicit confirmation/state feedback;
- stale/409 state causes a refetch and clear explanation rather than overwriting newer data.

The admin screen is validation-specific. Do not add general passenger/payment/contact browsing or plan controls in this task.

## Authorization / privacy tests

Add backend tests that exercise role and object boundaries through direct IDs, not only UI visibility.

At minimum cover:

- parent cannot access driver profile/document/validation owner APIs;
- driver A cannot retrieve or mutate driver B documents/submissions;
- driver cannot call admin decision/list/download endpoints;
- admin can review documents/validation but cannot mutate driver-owned profile through owner APIs merely because it is admin;
- anonymous requests are denied except existing public auth endpoints;
- document response has no-store/nosniff/attachment headers;
- API responses never include storage key/private path/document bytes in JSON;
- admin document retrieval appends an audit entry without content/secrets;
- validation observations/history are visible only to owner driver/admin, never parents/other drivers.

## Transaction / stale-review tests

Use PostgreSQL where row-lock/concurrency semantics matter. SQLite-only tests are not sufficient evidence for stale approval behavior.

At minimum test:

1. driver submits revision N;
2. administrator reads N;
3. driver replaces validation material, causing N to become superseded and current revision to advance;
4. administrator attempts to approve N;
5. server returns 409 and neither `approved_revision` nor an approval audit entry is written.

Also test:

- approval of current pending revision atomically updates validation/profile/audit;
- rejection does the same;
- repeated decision does not create duplicate audit transitions;
- same pending revision repeated submit is idempotent;
- resubmission after rejection creates a new revision;
- upload/identity change invalidates an approved current revision without deleting historical approval;
- required expired/missing docs block submission/approval as specified.

## Upload-security tests

Use generated tiny synthetic fixtures. Do not check real identity/vehicle documents into the repository.

At minimum test:

- valid minimal PDF;
- valid small JPEG/PNG;
- file >10 MiB rejected without persisted document/orphan;
- extension/content-type/signature mismatch rejected;
- malformed PDF/image rejected;
- SVG/HTML/archive/executable-style payload rejected;
- excessive image dimensions/pixels rejected;
- unknown checklist kind rejected;
- missing/invalid required expiry rejected;
- replacement creates a new immutable row and changes current selection rather than overwriting bytes;
- stored filename/key is generated and not derived as a trusted path from malicious input.

Do not claim this is antivirus coverage.

## Throttling and logging

Bound uploads without introducing Redis, Celery, brokers or another service. Reuse/extend the Task 02 database-backed throttle mechanism when sensible, but key authenticated upload throttling so one driver's activity does not globally block all drivers behind the same NAT.

Never log:

- document bytes;
- passwords/session/CSRF values;
- storage keys in ordinary request logs;
- full multipart request bodies.

Error messages may identify checklist kind/revision/state to the authorized user but must not reveal filesystem paths.

## Data lifecycle

Q7 retention/erasure remains unresolved. Therefore:

- use restrictive/protective foreign keys for reviewed/audited records where consistent with the accepted data model;
- retain historical submissions and referenced document versions for the synthetic MVP;
- do not add a "permanent retention" claim;
- do not implement a real-user delete/erasure workflow in this task;
- document that real personal-document intake remains blocked until retention/access/deletion procedures are decided.

## Contract and CI

- Update `backend/openapi.json` through the existing generator.
- Extend typed React API boundary rather than creating untyped ad-hoc fetch code.
- Keep Task 01/02 CI green.
- Add backend tests for models/services/API/security/file handling.
- Add React tests for driver onboarding and admin validation happy/error/stale states.
- Flutter has no Task 03 feature scope; keep its existing auth/analyze/tests/build green without adding document UI to mobile.
- If parser dependencies are added, pin/update lock or requirements consistently.
- `git diff --check` and secret/generated-output review must remain clean.

## Acceptance gate

Task 03 is not complete merely because an admin button changes a status.

Required deterministic/host evidence:

1. Driver registers/logs in through the existing React auth flow, fills the minimal profile, uploads a complete **synthetic** demo checklist and submits revision 1.
2. Admin logs in, sees the pending queue/detail, downloads each exact revision document through an authorized private endpoint, and an audit row records the reads.
3. Admin rejects revision 1 with observations; driver sees those observations/history.
4. Driver replaces at least one required document and resubmits a new revision; old rejected history remains intact.
5. Admin approves the current revision; approval/history/audit are consistent.
6. Stale-review test proves an older/pending screen cannot approve after a driver-side material change.
7. Parent and another driver cannot retrieve document bytes even with direct IDs.
8. No file is reachable through a public media/static URL.

A browser manual smoke is useful for upload/download behavior, but core privacy/stale-revision evidence must also exist as deterministic backend/React tests so it is not only a visual claim.

If the execution sandbox cannot exercise filesystem download/browser behavior, implement all deterministic checks and report exact host-side steps. Do not weaken authorization or file checks to make sandbox tests easier.

## Out of scope

Do not implement:

- Basic/Pro/Elite subscriptions or plan UI;
- publication intent/eligibility UI or discovery;
- communes, routes, schedules, capacities or destinations;
- parent discovery/comparison/reviews/contact requests;
- passengers/guardians/pickup data;
- transport payments;
- driver mobile daily services/runs/maps;
- live GPS/location;
- chat, push, notifications, brokers/background jobs;
- malware-scanning service/quarantine claim;
- real legal/compliance checklist claims;
- real personal documents/data;
- password recovery/MFA/email verification;
- deployment or app-store work.

## Completion checks

Before reporting completion, run every available check and report exact results.

Expected checks include:

- backend Ruff format/lint and Django system checks;
- empty/current PostgreSQL migrations plus no-missing-migration check;
- validation model/service/API tests including PostgreSQL stale-decision behavior;
- upload parser/security/privacy tests using generated synthetic bytes;
- private storage cleanup/orphan tests;
- OpenAPI generation/drift check;
- React formatting/lint/typecheck/tests/build;
- Flutter format/analyze/tests and Android debug build to prove Task 02 remains intact;
- Compose integration smoke;
- `git diff --check`;
- repository status/security review for `.env`, uploaded demo files, private keys, APK/build output, raw document fixtures or other generated junk.

If a check cannot run in the Codex sandbox, state the exact blocked command, cause and host-side procedure. Do not fabricate results.

## Important boundaries

- preserve ADR 0002 authentication/CSRF/session behavior;
- no public document storage or public/presigned document URL;
- no whole-model serializers for private/public boundaries;
- no stale revision approval;
- no client-trusted authorization;
- no real personal documents or compliance claims;
- no Task 04+ features;
- no commit, push, merge or deploy by Codex.

## Completion criteria

Task 03 is complete when:

- driver onboarding profile basics exist with correct owner authorization and validation-sensitive invalidation;
- private immutable document versions and demo checklist behavior are implemented;
- upload validation enforces the documented size/type/parser/dimension/expiry boundaries;
- submission snapshots exact current document versions into immutable validation revisions;
- driver can see validation state/history/private observations and resubmit after remediation;
- admin can list/detail pending validations, securely retrieve exact revision documents and approve/reject with observations;
- stale/current revision checks prevent an administrator from approving changed material;
- decision/profile/audit mutation is atomic and admin document reads are audited;
- parent/other-driver/direct-ID document access tests fail safely;
- no public document URL/path leaks from the API;
- Task 02 auth/session/CSRF behavior and all existing CI foundations remain green;
- real-document intake remains explicitly blocked pending Q3/scanning/retention decisions;
- no Task 04+ domain scope has leaked in;
- no commit, push, merge or deploy is performed by Codex.
