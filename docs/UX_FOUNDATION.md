# FurgoPlus approved UX foundation — Slice 1

A person comfortable with WhatsApp, basic banking or ordinary mobile apps should
understand FurgoPlus without knowing its architecture. Prioritize readability,
clear next actions, recovery, trust and privacy. The visual character is calm,
modern and friendly for adults using school transport.

## Information architecture and vocabulary

| Surface | Approved primary destinations |
| --- | --- |
| Driver web | Inicio, Mi servicio, Pasajeros, Solicitudes, Pagos |
| Administrator web | Validaciones, Conductores |
| Parent mobile | Buscar, Solicitudes, Mi cuenta |
| Driver mobile | Hoy, the primary daily surface |

Slice 1 establishes the web shell only. Inicio uses the existing summary;
Mi servicio groups existing Perfil, Documentos, Validación, Publicación and Rutas.
Keep all functional screens reachable and preserve drafts while navigating.
Administrator document review and driver controls remain separate. Mobile
operational destinations are future work; do not redesign them here.

Use **ruta** for a recurring configuration and **servicio** for a dated daily
operation. Use familiar verbs and objects, explain consequences and recovery,
and avoid raw roles, status codes and architectural terms in new user content.
Do not rewrite deep operational copy in this slice.

## Visual tokens and component rules

System font stack, no remote font. Web body 18px with 1.55 line height;
support 16px; nonessential metadata at least 14px. Dense admin data may be 16px.
Titles: page 32px, section 24px, card 20px. Use rem and wrapping; never shrink text
to make it fit. Flutter Material/system text: body 18, support 16, metadata 14,
page title 28 logical px; preserve system text scaling.

Spacing tokens: 4, 8, 12, 16, 24, 32, 48. Web auth card width 520px (about 454px
usable on desktop); Flutter auth max width 480px; focused forms 720px;
legal/readable content 720px; driver workspace 1120px; admin 1320px; sidebar 240px.

| Meaning | Token |
| --- | --- |
| Primary / hover / subtle | #0752AC / #06458F / #EAF3FF |
| Background / surface | #F5F7FB / #FFFFFF |
| Decorative / interactive border | #D8E0EB / #68788D |
| Main / supporting text | #202B3A / #526176 |
| Success / surface | #16643F / #E9F6ED |
| Warning / surface | #835313 / #FFF5DF |
| Danger / surface | #A32735 / #FFF0F1 |

Test foreground/background contrast. State always includes descriptive text;
color is supplemental. Decorative borders do not identify controls.

Buttons: one dominant primary action per task, explicit verb/object. Secondary
uses an outlined surface; tertiary uses text styling with a full target. Danger
uses explicit consequences and separate placement from ordinary Save. Routine
web controls are at least 48px high; mobile primary actions at least 56 logical
px. Disabled/pending actions cannot submit again and retain understandable text.

Fields: persistent visible labels, useful help via accessible descriptions,
field errors nearby and a clear error announcement. Placeholders supplement
labels only. Password visibility is an explicit accessible control. Password
registration help matches backend: at least eight characters, not entirely
numeric, common or too similar to account details. Backend remains authoritative.

Cards/lists: modest rounded borders, restrained shadows, simple spacing and
hierarchy. Avoid repeated nested containers. Preserve existing operational
structure until its slice. Loading explains the wait; empty states explain what
is absent and a useful next action; errors explain recovery without exposing
private/server detail; success states confirm the result and next step. Use
status/alert announcements, avoiding needless repetition.

## Shell and accessibility

Stable left sidebar on desktop: brand, icons plus text, visibly selected primary
destination and account/logout separated below. Narrow web uses a labeled menu
disclosure in document flow, not tiny compressed desktop controls. Announce
expanded/current state; Escape closes and returns focus, selection closes and
moves focus to main. No modal focus trap needed for a nonmodal disclosure.
Main content must wrap without horizontal core-flow scrolling.

Use header/nav/main landmarks, meaningful nav names, one principal h1 in the
visible page context, skip link, keyboard controls and a visible focus ring.
Use 200% zoom and mobile text scaling without truncating essential text;
respect SafeArea, keyboard insets, autofill and appropriate input types. Support
reduced motion; avoid unnecessary animation. Target WCAG 2.2 AA-oriented behavior
without a certification badge or claim. Manual browser/device verification is
required in addition to automated semantics tests.

## Authentication and legal boundary

Web: “Inicia sesión”, “Coordina tu transporte escolar con FurgoPlus.”,
“Correo electrónico”, “Contraseña”, “Iniciar sesión”, “Crear cuenta de conductor”.
Explain that parents use the mobile app. Registration uses “Cómo te llamas”,
explains account creation before approval, and asks for synthetic/demo data only.
Mobile supports parent and driver login; registration creates a parent/family
account. No role switch. Handle loading, registration success, session expiry,
restore retry and uncertain server logout in plain Spanish.

Reserve a legal footer component area, but render no fake links, document claims,
consent checkbox or company details before actual original drafts exist. Terms,
privacy and authorization are later-slice work.

## Privacy and protected functional boundaries

Minimize data and private display. Clear local private UI immediately on logout,
expiry or account replacement. Shell navigation/private drafts must not survive
identity changes. Preserve AuthApi request generations, stale_request rejection,
central not_authenticated, CSRF handling, keyed workspaces, stale reads/writes/
downloads and overlapping StrictMode restore behavior. Unrelated 403 failures
must not log the user out. Preserve native secure cookie storage and keyed homes.

Future child-data policy (no new intake in Slice 1): student_display_name is the
commonly used name plus enough surname information for safe distinction. Do not
require full legal identity or initials only. No child RUT, birth date, medical
profile or school records. Limit pickup details to the agreed point and guardian
identity/contact to what is necessary. No public/admin operational child
exposure. Real intake requires an approved authorization process; never invent
consent evidence.

Tasks 02–08 boundaries remain binding: session/role authorization; immutable
validation revisions and document access/audit; backend-derived publication
eligibility; hidden-object/participant contact rules; interval capacity and
assignment consistency; payment state/audit; dated runs and attendance/location
limits; bounded admin controls without operational access. No policy, endpoint,
backend schema, billing, tracking, administrative authority or legal expansion.

## Implemented contrast evidence

Calculated WCAG sRGB contrast ratios for the actual token pairs: white on primary
7.47:1, white on primary hover 9.31:1, main text on white 14.30:1, supporting text on
white 6.31:1, success on pale green 6.44:1, warning on pale amber 6.03:1, danger on
pale red 6.55:1. Interactive border on white is 4.51:1; the web focus ring on white
is 4.97:1. These are token calculations, not a claim of full accessibility
conformance. Browser zoom/device/screen-reader acceptance remains a manual gate.
