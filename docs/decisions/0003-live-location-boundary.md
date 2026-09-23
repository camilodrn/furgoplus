# ADR 0003 — External navigation now; live location later

Status: accepted. Date: 23 September 2026.

## Decision and rationale

October includes a user-triggered **Open in maps** action on driver mobile route details. Encode the route destination into a normal platform URL/deep link for an installed navigation provider. Use a validated address or coordinate pair, an allowlisted URL scheme/provider and platform launch handling. Show a useful fallback if no compatible application exists. No custom turn-by-turn navigation, embedded moving map or multi-stop optimization.

This app requests no background or continuous location permission and collects no GPS samples. The external application controls its own navigation and permissions. Before launch, make clear that the selected destination is shared with that provider; never include student names, account identifiers, credentials or entire passenger lists. A start/end timestamp is operational state, not evidence of physical position or arrival.

Live GPS streaming, parent tracking, background jobs for location, WebSockets, brokers and push infrastructure are deferred. Building them now would displace the core discovery/validation/operation journey.

## Extension boundary

Keep stable driver, route and dated RouteRun identifiers and centralize assignment/ownership checks. A future Django `tracking` module could associate authorized location observations with a run without changing what a recurring route means. **Do not create a tracking table, ingestion endpoint or placeholder service in October.**

A later ADR must establish guardian-to-passenger/run entitlement, opt-in/consent, collection frequency, retention, stale-location behavior, battery/offline handling and platform background permission rules. Neither an accepted contact request nor knowledge of a route ID grants tracking access. Select polling or streaming only after those requirements and measured load justify it; retain the monolith until evidence says otherwise.

## Consequences and verification

Parents will not see a vehicle position in this release. Drivers can still use familiar navigation. Verify URL encoding, provider failure, no credential leakage, no location permission prompts and no location ingestion traffic. Use synthetic destinations in the demo. See [data model](../DATA_MODEL.md) for static destination and run fields.
