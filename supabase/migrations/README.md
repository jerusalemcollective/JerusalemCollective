# Migration Notes

Migrations `049`, `050`, and `051` are intentionally unused in this project history.

The booking/payment flow work was implemented across:

- `010_host_payment_foundation.sql`
- `039_booking_payment_tracking.sql`
- `041_booking_request_acceptance_and_deposit.sql`
- `052_booking_commission.sql`
- `057_host_payment_choice_and_same_currency.sql`
- `058_platform_payment_controls.sql`

Future migrations should continue sequentially. The latest is
`064_security_followups.sql` (audit follow-ups), so continue from `065`.

See also `REVIEW_FIRST_hosts_email_and_booking_dedup.sql` — guided steps that
need the live schema confirmed before running (not auto-numbered on purpose).
