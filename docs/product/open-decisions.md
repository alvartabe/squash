# Open Decisions

Agents must not invent answers to these items. Resolve the relevant item through a product decision before implementation depends on it.

## Legal and operational

- Audit, security, consent, and anonymized-history retention periods
- Whether the product database must be registered with PRODHAB
- Final Guardian consent and privacy-notice text
- Security-incident and personal-data response deadlines
- Moderation categories, escalation policy, and response targets

These require Costa Rican legal or operational review before launch.

## Configuration bounds

- Minimum and maximum configurable target points per Game
- Allowed recurrence patterns and maximum horizon for Play Session Series
- Club Invitation expiration and resend limits
- Maximum Tournament roster, Group count, and Group size
- Maximum media file sizes and allowed image formats

Validation must be conservative, but a code task cannot establish these as product policy without updating this document.

## Exceptional recovery

- Exact recovery workflow after a Platform Administrator reopens a dependency-locked Official Result
- Handling an active Tournament when its sole available organizer becomes Platform Suspended
- Handling a Guardian dispute or legal-authority challenge after consent was recorded

Normal behavior is already defined. These exceptional workflows require explicit review rather than silent automated cascades.
