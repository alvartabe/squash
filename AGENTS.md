# Agent Instructions

Product behavior in this repository is documentation-led. Existing code may lag behind the intended product and must not be treated as the product specification.

## Required reading

Before planning or implementing a product change:

1. Read [docs/product/README.md](docs/product/README.md).
2. Read [CONTEXT.md](CONTEXT.md) and use its canonical domain language.
3. Read [docs/product/release-scope.md](docs/product/release-scope.md).
4. Read the relevant feature document under `docs/product/features/`.
5. Check [docs/product/open-decisions.md](docs/product/open-decisions.md) and do not invent an unresolved value.
6. Read any related ADR under `docs/adr/`.
7. Check [docs/product/current-code-gaps.md](docs/product/current-code-gaps.md) for known differences between code and intended behavior.

## Product change control

- Do not invent capabilities, permissions, lifecycle states, exceptions, or user-visible behavior.
- Implementation choices are allowed only when they preserve the documented behavior.
- Do not implement a Later feature unless the task explicitly moves it into the Initial release.
- If a requested change conflicts with the product documents, surface the conflict before changing code.
- Any accepted product-level change must update the relevant product document in the same change.
- Update `CONTEXT.md` when canonical terminology changes.
- Add an ADR only for a decision that is hard to reverse, surprising without context, and based on a real trade-off.
- Tests must express documented behavior, not merely preserve legacy code behavior.

## Conflict handling

Use this order when sources disagree:

1. The user's explicit instruction for the current task
2. Product documents under `docs/product/`
3. Canonical language in `CONTEXT.md`
4. Accepted ADRs under `docs/adr/`
5. Existing code and tests

Do not silently resolve a genuine product-document conflict. Report it and request a product decision.
