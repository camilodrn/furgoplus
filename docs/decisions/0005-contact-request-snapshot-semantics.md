# ADR 0005 — Consented contact-request snapshots

Status: accepted for the October MVP

## Context

Task 05 adds a controlled contact workflow between an authenticated parent and an eligible driver. FurgoPlus must allow the two participants to exchange only the minimum contact information required to arrange the service outside the application, without turning discovery into a public directory and without introducing chat, phone/WhatsApp fields or a booking contract.

The product scope and data model already require:

- explicit parent consent before sharing the parent's account email;
- a bounded request message;
- one pending request per parent/driver pair;
- driver acceptance before the parent receives the driver's private service-contact email;
- immutable contact snapshots so later profile/email changes do not rewrite historical consented disclosure;
- existing participant history to remain readable even when the driver later becomes hidden.

## Decision

### Creation

A parent may create a contact request only for a driver who is currently discoverable under the authoritative publication predicate.

The request stores:

- parent and driver ownership;
- immutable request message;
- explicit consent timestamp;
- a server-captured snapshot of the authenticated parent's account email;
- status `pending`;
- timestamps.

The parent does not submit an arbitrary contact email. The server snapshots the authenticated account email after explicit consent.

At most one pending request may exist for a parent/driver pair. This is enforced transactionally and at the database level where practical.

Creating a request does not reserve a seat, create a passenger, create a payment record or prove a transport contract.

### Disclosure while pending

The target driver may read the consented parent-email snapshot on that driver's own incoming request. This disclosure is authorized by the parent's explicit consent at creation.

The parent does **not** receive the driver's private service-contact email while the request is pending.

### Acceptance

Only the target driver may accept a pending request.

Acceptance locks/rechecks the request and the driver's current publication eligibility. If the driver is no longer eligible, acceptance is rejected.

On successful acceptance the server snapshots the driver's **current** private service-contact email into the request and transitions it atomically to `accepted`.

The parent may then read that accepted driver-email snapshot through the participant-private request detail.

Later edits to either participant's current email do not alter either stored snapshot.

### Decline and cancellation

The target driver may transition `pending -> declined`.

The owning parent may transition `pending -> cancelled`.

Decline/cancel remain available if the driver later becomes hidden so outstanding requests can be closed cleanly.

Terminal requests cannot be reopened. A later request is a new row and must satisfy the current creation gates.

### History and publication changes

If the driver later becomes hidden, participants may still read their own existing request history and already-consented snapshots.

A hidden driver cannot receive a new request and cannot accept a still-pending request until current eligibility is restored.

Admin role does not gain a general contact-message browsing endpoint from this workflow.

### Privacy boundary

Discovery never exposes either participant's email or request history.

Contact endpoints are participant-only and non-cacheable. Message bodies, email snapshots, session cookies and CSRF tokens must not be written to ordinary application/audit logs.

## Consequences

- Consent and disclosure are explicit and auditable through request state without publishing contact information globally.
- Historical requests remain intelligible if profile contact data changes later.
- Contact remains deliberately separate from booking, capacity, passenger and payment logic.
- Task 06 may create passenger assignments only after the parties arrange service; Task 05 acceptance itself consumes no seat.
- Q4 may later change the permitted contact channel, but adding phone/WhatsApp/chat is not authorized by this ADR.