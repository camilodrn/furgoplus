# Product scope

Status: implementation baseline, 23 September 2026. Delivery: 14 October; technical freeze: 13 October. This describes intended behavior, not completed features. The locked requirements come from [Task 00](../CODEX_TASK_00.md).

## October MVP

| Surface | Required outcome |
| --- | --- |
| Parent mobile | Register/login/logout; edit basic profile; search eligible drivers by commune; view profile, validation badge and reviews/ratings; compare 2–3 drivers; submit and inspect a controlled contact request. |
| Driver mobile | Login/logout and driver home; today's scheduled services; route schedule, used/available seats and minimum passenger details; explicitly start/end today's run; open its destination in an external map application. |
| Driver web | Register before approval; manage profile, private documents and validation observations; manage routes, coverage, schedules, capacity and passenger assignments; manage contact requests and manual payment records; see plan/publication state and a basic operational dashboard. |
| Administrator web | Login; search/filter validation queue; securely retrieve documents; approve/reject with observations and history; manually activate/change/suspend plans; suspend/deactivate/restore profiles with reasons; inspect relevant action history. |

Dashboards are summaries of existing records, not analytics products. One account has one role for the MVP; there is no role switching or administrator self-registration. Parents register on mobile and drivers on web. Admin accounts are provisioned through a restricted operational procedure. Both clients use the same API and permission rules.

### Parent journey

1. Register as a parent, log in, and set a display name. No child's identity is needed to search.
2. Select a standardized commune and browse eligible drivers. Open details showing service summary, coverage, route schedule summaries, availability, approved badge, and published review average/count. An empty review set says “No reviews,” not zero stars.
3. Compare 2–3 selected profiles using the same fields and units: coverage communes, service description, days/time windows, available seats per route, validation label, average rating and count. No cross-route seat sum or unnormalized price comparison.
4. Send one bounded request message and explicitly consent to share the account email with that driver. Do not request student names or home addresses in the message. Track pending/accepted/declined/cancelled status; no chat or automatic seat reservation.
5. On acceptance, see the driver's designated service contact email in the private request detail. Availability and eligibility are rechecked on the server, including when opening previously selected profiles. A hidden driver cannot be contacted anew.

### Driver journey

1. Register on web, create a draft profile and designate a service contact email. Upload the required document set and submit a validation revision. Login and onboarding work before approval; discovery visibility does not.
2. Read private observations if rejected, replace documents and resubmit. An administrator approves the exact submitted revision and activates a plan. The driver chooses publication; all eligibility conditions must still hold.
3. Create a one-way recurring route with days/time window, coverage, capacity and a destination. A return trip is a separate route. Review contact requests and accept/decline; arrange the service outside FurgoPlus through the consented contact details.
4. Manually add minimal passenger assignments after that arrangement. Acceptance alone neither proves a transport contract nor consumes a seat. Maintain pending/paid/void manual payment records on web.
5. On mobile, inspect today's services and assigned passengers, start a run, open external navigation if useful, then complete the run. Changes are online-only; failures preserve the last confirmed state and offer retry. No real-time parent tracking is implied.

### Administrator journey

1. Log in to the protected React surface, filter pending drivers and open the submitted document revision.
2. Read documents through authorized download endpoints and approve/reject with observations. The result, reviewer, timestamp and reviewed revision are retained atomically with the audit entry.
3. Assign Basic/Pro/Elite manually, with explicit validity dates. Inspect the computed publication blockers. Approval alone does not publish a profile.
4. Suspend a subscription or profile, or deactivate the profile, with a reason. Verify immediate removal from search, detail and comparison; the driver still has access to remediation/status unless the account itself is disabled. Restoration does not bypass validation or plan checks.

## Business constraints

The single publication predicate and plan behavior are defined by [ADR 0004](decisions/0004-publication-eligibility.md); entity states and transition permissions are defined in the [data model](DATA_MODEL.md). These are server constraints, not client conventions.

1. Drivers can register and upload documents before approval.
2. Only the owning driver and an authorized administrator can retrieve driver documents; no parent-facing document metadata, paths or URLs.
3. Administrators record an explicit validation decision and history against an immutable submission revision.
4. Only approved, eligible drivers appear in discovery, detail or comparison.
5. Basic, Pro and Elite exist as manually administered plans; no gateway or automatic billing.
6. Publication requires an active, currently valid plan and the other ADR 0004 gates.
7. All parent discovery endpoints apply the same eligibility predicate, including lookups by ID.
8. Search and comparison share a standardized, allowlisted response schema.
9. Contact details are disclosed only through the consented request flow. No public personal phone/email/address fields.
10. Every operation enforces role and object ownership on the server; client navigation is only presentation.

## Optional stretch, only after MVP acceptance

- Parent review submission and basic moderation, once service-eligibility policy is approved. October requires **display only**; demo reviews are explicitly synthetic fixtures.
- Profile photos, additional search filters or saved comparisons.
- Email notices of request/validation changes, if delivery can be tested without affecting core work.

Stretch work may not consume the integration/freeze buffer. There is no commitment to deliver it.

## Deferred / future

Live GPS and continuous/background location streaming; animated map movement; route optimization; internal real-time chat; advanced push notifications; absence workflows; payment gateway/Webpay; automated billing; production app-store publication; microservices/message brokers; offline synchronization; multi-role accounts. [ADR 0003](decisions/0003-live-location-boundary.md) describes the future location boundary. No prerequisite infrastructure for these features is part of October.

## Explicit assumptions and unresolved questions

These defaults keep planning buildable; they are not claims of validated product policy. Changes that expand scope require a new planning decision.

| ID | Interim assumption | Unresolved question / decision owner and deadline |
| --- | --- | --- |
| Q1 | One role per account; Spanish UI; Greater Concepción commune catalog; service times use America/Santiago. | Product owner confirms initial communes and vocabulary before search implementation (1 October). |
| Q2 | Basic/Pro/Elite have identical MVP capabilities and all require manual activation; no displayed prices or ranked placement. | Product owner confirms plan validity periods and commercial benefits before real enrollment; do not invent billing or entitlements. |
| Q3 | A configured checklist defines required document kinds and required expiration dates; demo files are synthetic. No checklist is asserted to satisfy a legal standard. | Product/validation owner supplies exact checklist, approval criteria and which identity fields trigger revalidation by 26 September. Delivery/security owner settles malware scanning/quarantine before real-document intake. Until then, test with a clearly labeled demo checklist and known-safe synthetic files; real onboarding is blocked. |
| Q4 | Only a consented email exchange is included; the parent sees the driver's service email after acceptance. Maximum request message: 500 characters; one pending request per pair. | Product owner confirms wording and whether another contact channel is essential by 1 October; do not add chat. |
| Q5 | Reviews are read-only in October; fixture reviews use fictional users and are visibly marked as demo data. No fabricated reviews in a real environment. | Product owner determines legitimate review provenance, submission eligibility and moderation before real reviews are loaded. Empty states are supported without fixtures. |
| Q6 | Drivers manually maintain one-route passenger assignments and CLP transport-payment records. No student accounts, attendance automation or parent payment screen. | Product owner confirms minimum passenger fields and guardian consent process by 3 October. Use synthetic children until that process is agreed. |
| Q7 | Demonstration uses synthetic accounts/documents/passengers; retention and erasure are not claimed resolved. | Data owner defines document/passenger/contact/audit retention, access and deletion procedures before collecting real personal data. No compliance claim follows from technical controls. |
| Q8 | Single-host same-origin HTTPS demo deployment; Flutter Android device/emulator is the minimum demo target, while one codebase remains Android/iOS capable. | Delivery owner confirms hosting, certificates, backups and available Android/iOS hardware by 25 September. If iOS demonstration is required, confirm macOS/signing access then. |
| Q9 | Login, logout and expiry are core; self-service password recovery, email verification and MFA are not included in October. | Delivery/security owner agrees an account-recovery procedure and real-user launch requirements before external enrollment. Do not improvise identity verification or disclose passwords. |

## Acceptance of the October product

A synthetic driver registers, submits private documents, receives an audited admin decision and an active plan, publishes, and becomes discoverable by a parent on Flutter. The parent compares eligible profiles and sends a consented request. The driver accepts on web, assigns a fictional passenger and records a payment, then starts/ends today's run on the same Flutter app using the driver role. Admin suspension immediately hides discovery while preserving controlled access to existing private records. The roadmap defines the test gates for this path.
