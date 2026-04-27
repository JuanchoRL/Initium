# Initium Production Data And Access

## Decision

Use Supabase for production:

- Supabase Postgres stores organizations, recruiter memberships, jobs, invites, assessment results and candidates.
- Supabase Auth should own recruiter identity. The current email-only recruiter login remains a local/dev fallback.
- Row Level Security isolates each company's pipeline by `organization_id`.
- Public candidate submissions must carry an `inviteId`; the server resolves the invite and links the result to the correct job and company.

## Local Behavior

The app still runs with SQLite locally. This keeps development fast and lets Playwright run without cloud credentials.

Candidate invite links now use:

```text
/?invite=<invite-id>
```

When the candidate completes the assessment, `/api/assessment-results` persists the result, marks the invite as completed and syncs the candidate into the recruiter dashboard when the invite points to a known vacancy.

## Recruiter Access

For local/staging control, set:

```bash
INITIUM_RECRUITER_ALLOWLIST="mercado-libre:ana@mercadolibre.com,juan@mercadolibre.com;acme:@acme.com"
```

Supported matchers:

- Exact email: `ana@mercadolibre.com`
- Whole domain: `@acme.com`

If the variable is empty, the app allows all recruiter emails for local development.

## Production Next Step

Apply the SQL migration in `supabase/migrations/20260427000000_initium_multitenant.sql`, then replace the SQLite server store with a Supabase-backed implementation that uses the authenticated user's `organization_id` from `recruiter_memberships`.
