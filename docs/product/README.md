# Product Documentation

This directory defines the intended Squash product. Code may be incomplete or inconsistent with these documents.

## Start here

- [Product definition](product-definition.md) — purpose, audiences, principles, and value
- [Release scope](release-scope.md) — Initial, Later, and Excluded capabilities
- [Roles and permissions](roles-permissions.md) — responsibility and access boundaries
- [Non-goals](non-goals.md) — explicit product boundaries
- [Open decisions](open-decisions.md) — unresolved values agents must not invent
- [Current code gaps](current-code-gaps.md) — known mismatches, not an automatic backlog

## Feature definitions

- [Accounts and safety](features/accounts-and-safety.md)
- [Clubs and membership](features/clubs-and-membership.md)
- [Play and player network](features/play-and-player-network.md)
- [Competitions](features/competitions.md)
- [Platform operations](features/platform-operations.md)

## Supporting decisions

- [Canonical domain language](../../CONTEXT.md)
- [Architecture decision records](../adr/)

Decision index:

- [Web management and mobile Player experience](../adr/0001-web-management-mobile-player-experience.md)
- [Composable Club Responsibilities](../adr/0002-compose-club-responsibilities.md)
- [Group Stage tiebreak procedure](../adr/0003-fix-the-group-stage-tiebreak-procedure.md)
- [Guardian-supervised Junior accounts](../adr/0004-supervise-junior-player-accounts.md)
- [Anonymized history after Account Closure](../adr/0005-anonymize-history-on-account-closure.md)
- [Least-privilege Platform administration](../adr/0006-limit-platform-administrator-data-access.md)

## Document conventions

- **Initial** means part of the first release boundary.
- **Later** means accepted product behavior that must not be implemented as Initial scope without an explicit scope change.
- **Excluded** means intentionally outside the product.
- “Must” and “cannot” define required behavior.
- Examples explain rules but do not create additional behavior.

When a product rule changes, update the relevant feature document first, then the release scope, glossary, ADRs, tests, and code as applicable.
