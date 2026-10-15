# ADR 0007 — Single-host synthetic demo behind Cloudflare Tunnel

Status: implemented in r4 according to operator evidence; Debian/HTTPS, React and
Android functional, synthetic scenario prepared and backed up. Formal Git/PR review
and detailed security acceptance evidence remain separate.
Date: 14 October 2026. Baseline: `816dda0` in `task/11-homelab-deployment`.

## Context

The existing Compose serves Django's development server and Vite. The demo needs
one HTTPS origin on Debian 13, sharing an AMD A10-5750M (four cores), 10 GiB RAM
and a 1 TB HDD with FitFu and other projects. DNS/Tunnel were inactive in the initial
proposal; the operator now confirms r4 functioning at demo.furgoplus.cl. Task 09/10
documentation was subsequently integrated here without modifying its other worktree.
The modular monolith, PostgreSQL sessions and synthetic-only scope remain as
defined by ADRs 0001–0006 and the privacy/freeze documents.

## Decision

Use an independent `furgoplus-demo` Compose project with three runtime services:

```text
Browser / Flutter -> HTTPS demo.furgoplus.cl -> Cloudflare edge
  -> encrypted tunnel -> host cloudflared -> HTTP 127.0.0.1:18080
  -> project-scoped ingress bridge (Caddy only)
  -> Caddy:8080 [compiled React; /api and /api/* keep their original paths]
  -> private proxy network -> Gunicorn:8000 -> Django/DRF
  -> separate private database network -> PostgreSQL:5432
                                      -> private_uploads persistent volume
```

Gunicorn uses WSGI, two gthread workers and two threads per worker. React is built
in a Node stage; no Node process is present in the Caddy runtime. No Redis, broker,
Celery, ASGI server or monitoring stack is needed for the implemented workflows.
The two database/file volumes are scoped to the Compose project. Caddy never
mounts private uploads, proxies Django admin or serves a media directory.

The Fedora integration corrected Gunicorn config-file types:
`forwarded_allow_ips` is a comma-separated string containing the exact Caddy
proxy IP and loopback; `forwarder_headers` is the empty string. Neither is a
Python list. The empty forwarder-header list after parsing enables no forwarded
PATH_INFO/SCRIPT_NAME rewriting. A secret-free helper exercises Gunicorn's real
`--check-config` parser with a standard-library WSGI callable; it does not load
Django or certify application readiness.

Only Caddy publishes one TCP port, on IPv4 host loopback. The tested topology uses
three networks: an ordinary `ingress` bridge for Caddy's working host publication,
an internal `proxy` bridge for Caddy/backend, and an internal `database` bridge
for backend/PostgreSQL. All are project-scoped; none is external or shared with
FitFu. The original all-internal topology did not make the host port reachable
in the Fedora integration. Backend and PostgreSQL never join ingress or publish
ports. Ingress grants Caddy outbound network access, not direct database access;
Caddy remains a trusted API gateway. No host network mode, extra ports, privilege
or Docker socket is introduced. Verify host firewall/Engine and denied LAN access
when accepting Debian; source configuration alone cannot certify host isolation.
Caddy's exact static IPv4 address on **proxy**, not its dynamic ingress address, is
trusted by Gunicorn and the demo-only Django middleware. All other peers keep
their socket address and cannot assert a forwarded scheme. The sole local
scheme-header exception is the backend's loopback GET health probe.

Caddy replaces the private client-IP header using `CF-Connecting-IP`, discards
forwarding chains and asserts the externally secured scheme. Django validates
the actual Host, validates/canonicalizes this single IP, then normalizes
`REMOTE_ADDR` before existing auth/upload throttles. Missing, invalid, chained or
scoped proxy IPs are rejected. IPv4-mapped IPv6 uses the IPv4 bucket.

This boundary trusts the host and its loopback callers. It does not authenticate
the tunnel at the local HTTP hop; a compromised local process can forge Cloudflare
headers. Root/Docker administrators can also cross Docker isolation. Attaching
another proxy, containerized cloudflared, Workers or external Caddy ingress
requires a deliberate new review. Do not trust all private ranges or `*`.

Demo settings force `DEBUG=False`, the exact public host and one HTTPS origin,
host-only Secure/HttpOnly/Lax cookies, HTTPS redirects and one exact trusted CSRF
origin. No CORS exception is added. Cloudflare must redirect public HTTP to HTTPS
and bypass caching of API responses. Caddy does not obtain local certificates.

Keep `SECURE_HSTS_INCLUDE_SUBDOMAINS=False` and `SECURE_HSTS_PRELOAD=False`.
`security.W005` and `security.W021` are deliberate, visible deployment warnings:
the demo should not extend HSTS to its child subdomains or request preload-list
registration. HSTS still applies to the demo host for one year. Deploy checks use
`--fail-level ERROR`; any warning other than these two needs explicit review,
and the restore procedure leaves the app stopped for that review.

Secrets are external files mounted only into their consumers; Compose standalone
secrets are bind-mounted files, not an encrypted secret store. Resource ceilings
total 1920 MiB and three CPUs, leaving nominal headroom for the rest of the host;
they are starting limits, not measured sizing or reservations.

## Consequences and gates

Keep development settings/Dockerfiles/Compose unchanged. Migrations, data seeds,
administrator provisioning, backups, restoration and updates are explicit
operator steps, never container startup side effects. Back up the database and
private files while all writers are stopped; rehearse into new volumes/project.
The scripts refuse overwriting a restore project and never delete volumes.

Do not use `compose run backend` for operations: its static IP can remain reserved
by the canonical container. Recovery uses network-free, unprivileged file helpers
with the existing backend image ID. A metadata-verified local volume mountpoint
is passed as a bind (read-only for export); a missing path fails rather than
creating named storage. Both original volumes and their mounts must exist before
stopping writers. A complete snapshot couples DB/files, strict SHA256SUMS and
per-file hashes; a final COMPLETE marker distinguishes it from a partial capture.

Restore checks new project/resources, distinct subnet/unused port and exact image
IDs before provisioning. It creates only the new DB and a stopped canonical
backend, then streams private files to the empty new volume and verifies hashes.
No one-off shares the backend IP, and no PostgreSQL helper creates anonymous
volumes via its image VOLUME declaration. Django checks run later via exec on the
canonical backend, before exposing Caddy. Partial targets are preserved, never
deleted/overwritten or resumed automatically. File helpers disable SELinux label
confinement on Fedora to avoid relabeling source files, while remaining without
network, capabilities or secret mounts; runtime services keep their confinement.
Agent recovery checks are simulations only. The operator subsequently confirmed
real backup/restore on Fedora and physical reboot on Debian; retain those as
separate evidence and repeat against the next accepted candidate. See the runbook.

The Task 11 security review closes the contact-create frequency-control gap with
independent 10/account/hour and 20/source IP/hour fixed-window counters in the
existing AuthThrottle table. Stable row-lock order and a transaction committed
before domain validation/rejection support shared PostgreSQL workers without
schema changes or cache services. Linux/PostgreSQL process-race tests are added
but remain unexecuted in the agent sandbox; SQLite HTTP results do not certify
these locks. Login/register/upload retain their existing rates; these counters
do not provide DDoS protection or independent per-account login limits.

Product decision: the academic hostname is public with no visitor IP restrictions,
and account creation is controlled. Demo settings force public registration closed
before payload parsing/counters/writes; React/Flutter retain illustrative forms
with local explanation/clearing and no registration transport/storage. Normal
settings/builds retain public parent/driver registration, including future
app.furgoplus.cl. A private TTY management command provisions fictional accounts
with validated passwords and normal unprivileged profiles, never automatic approval.
See [DEMO_MODE](../DEMO_MODE.md). No new anonymous private-data surfaces are added.

The operator confirmed healthy PostgreSQL/Gunicorn/Caddy, HTTP 200 for React/API,
HTTP 404 for `/private/`, HTTP 400 for API requests without proxy IP, and now 16/16
tests with Django 5.2.18 plus Gunicorn 26.2.0 validation on Fedora. This is local
integration evidence. Later operator evidence establishes healthy Debian 13,
physical reboot and real Fedora recovery, with Task 09/10 documentation integrated
locally without commit. At closure the operator confirms r4 deployed and tested
over HTTPS/Tunnel, with React and Android APK working and the synthetic scenario
prepared and backed up. The agent did not repeat these operations. Record image/APK/
snapshot identities separately; repeat affected checks with each new candidate.
Specific PostgreSQL process-race and forwarded-IP abuse evidence and the full
HTTPS invalidation/role/secure-storage matrix were not supplied. See
[the final review](../TASK11_FINAL_REVIEW.md) and
[the exposure review](../DEMO_SECURITY_REVIEW.md); functional success does not
mark every detailed security gate passed.
Real accounts, minors, documents and destinations remain prohibited. The
synthetic acknowledgement is operator policy, not a content detector. Public
exposure is not acceptance or production approval. See the
[runbook](../HOMELAB_DEMO.md) for exact commands and validation limits.

## Primary references

- [Django proxy SSL trust](https://docs.djangoproject.com/en/5.2/ref/settings/#secure-proxy-ssl-header)
- [Caddy proxy header handling](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#headers)
- [Cloudflare visitor IP headers and Worker behavior](https://developers.cloudflare.com/fundamentals/reference/http-headers/)
- [Cloudflare tunnel origin configuration](https://developers.cloudflare.com/tunnel/configuration/)
- [Gunicorn trusted forwarded IPs](https://gunicorn.org/reference/settings/#forwarded_allow_ips)
- [Docker loopback publication and Engine caveats](https://docs.docker.com/engine/network/port-publishing/)
- [Django security check IDs](https://docs.djangoproject.com/en/5.2/ref/checks/#security)
