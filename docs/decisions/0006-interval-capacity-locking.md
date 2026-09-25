# ADR 0006: Interval capacity is derived under a route lock

Status: accepted for Task 06.

## Context

Recurring routes have dated assignment intervals and no stored used-seat count. Checking only today's count, or a fixed future horizon, can miss overbooking. Concurrent inserts can both observe the last seat unless writes serialize.

## Decision

The route row is the serialization point for assignment creation, interval edits, ending, and schedule/capacity changes. Each write runs in `transaction.atomic`, acquires `select_for_update` on its route, reads current assignment intervals, and checks the proposed state. A sweep over interval start and end-plus-one boundaries checks the first scheduled weekday in each constant-demand segment, including the unbounded final segment. Public and owner dated counts read the same assignment table; there is no editable counter. Capacity applies to scheduled dates even when a route is currently inactive, so reactivation cannot silently reveal overbooking.

Manual transport-payment transitions separately lock the payment row. They have no subscription side effect.

## Consequences

All product writes affecting capacity must use this route-lock path. PostgreSQL transaction tests are required for concurrent final-seat attempts. Public read snapshots may change immediately after a committed assignment write.
