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

## Feature workflow

- Product documents under `docs/product/` remain the source of truth. Files under `.scratch/` are temporary execution tickets and must link to their product sources rather than duplicate them.
- Before implementation, identify the bounded behavior, product-document source, explicit non-goals, testing seams, and review fixed point.
- Implement one bounded ticket or behavior at a time. Do not include adjacent items from `docs/product/current-code-gaps.md`.
- `/implement` includes the primary review. Any additional review must use the same fixed point and product source.
- Treat specification misses and documented-standard violations as blocking.
- Treat code smells as judgment calls and unrelated product gaps as separate future work.
- Follow-up reviews must verify corrections without expanding the active scope.

## Testing workflow

- Do not invoke `/tdd` automatically. Use test-first development only when the user or active ticket explicitly requests it.
- Before implementation, identify the observable behavior and public testing seams. When a ticket already records them, no separate confirmation is required.
- For new features, tests may be written after implementing each bounded vertical slice.
- Do not defer tests across multiple tickets or until the end of an entire feature.
- A ticket is not complete until its behavior tests are implemented and passing.
- For bug fixes, first reproduce the defect with a failing regression test when practical.
- Test through public interfaces and observable behavior rather than implementation details.
- Run relevant tests during implementation and the full applicable test suite before final review.
