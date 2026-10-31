# Isolated auth-gate browser test

This temporary page is available only in the audit branch through the `?audit-auth=1` query parameter.

## Safety scope
- Repository: `rafisuryarizkika-maker/savixara-test`
- Supabase project: `bumoiebziefburtmisnn`
- Function: `melostore-auth-gate-audit-v2`
- No provider API requests, sync/dry-run, or catalog writes.

## AAL1 test
1. Sign in to the test app using the non-admin test account.
2. Open the audit page.
3. Confirm the page reports the current assurance level as `aal1`.
4. Run the test. It invokes only the auth-only endpoint using the current Supabase session.
5. Expected result: HTTP 403 with `requires_mfa: true` because the session is not AAL2.

If the session is not AAL1, the page skips the endpoint request. Do not paste access tokens or MFA codes into chat or GitHub issues.
