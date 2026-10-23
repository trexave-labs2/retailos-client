# Subscription Launch Readiness: Engineering Notes

## Entitlement enforcement warning

Plan metadata displayed on the Plans page is not proof that every listed entitlement is enforced on every server route. Before marketing Pro-only capabilities, review the server's subscription launch-readiness notes and verify enforcement in the backend.

The public Plans page must describe customer-facing plan information only. Keep implementation caveats and release-readiness warnings in engineering documentation, not in customer-facing UI.

## Release checklist

- [ ] Confirm each advertised feature is implemented and enforced by the server, not merely present in plan metadata.
- [ ] Verify Free and Pro limits on every relevant create/update and reporting path.
- [ ] Verify subscription state and pending paid upgrades cannot grant paid entitlements before payment is confirmed.
- [ ] Run relevant client tests, lint, and production build.
- [ ] Run the server subscription tests and review its launch-readiness notes before publishing plan claims.

This document records an engineering warning; it does not claim that the listed checks have passed.
