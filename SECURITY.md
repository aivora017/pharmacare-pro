# Security Policy

## Supported Versions
Only the latest release and current `main` are supported for security fixes.

## Reporting a Vulnerability
Do not create public GitHub issues for security problems.

Use GitHub Security Advisories:
- Repository -> Security -> Advisories -> Report a vulnerability

Include:
- Impact and attack scenario
- Steps to reproduce
- Affected files/modules
- Suggested remediation (if known)

## Security Requirements for This Project
- Never store plaintext passwords.
- Never commit API keys/secrets.
- Use parameterized SQL queries only.
- Validate sensitive actions against role permissions.
- Record create/update/delete actions in `audit_log`.
- Prefer least-privilege access for all features.

## Response Targets
- Initial triage: within 48 hours
- Risk classification and plan: within 5 business days
- Patch ETA shared after triage
