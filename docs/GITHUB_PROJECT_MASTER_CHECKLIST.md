# GitHub Project Master Checklist (PharmaCare Pro)

Use this as the single source of truth to set up and run this project as a production-grade live GitHub project.

## 0. Prerequisites

- Git installed locally
- GitHub account with repo admin access
- Node.js 20+ and Rust stable installed
- Local project available at `d:\pharmacare-pro`

## 1. Create GitHub Repository

1. Go to GitHub -> New repository.
2. Name: `pharmacare-pro`.
3. Visibility: Private (recommended until pilot release).
4. Do not initialize with README, .gitignore, or license.
5. Create repository.

## 2. Connect Local Repo and Push

Run in terminal:

```powershell
cd d:\pharmacare-pro
git remote add origin https://github.com/<your-username>/pharmacare-pro.git
git push -u origin main
```

If remote already exists:

```powershell
git remote set-url origin https://github.com/<your-username>/pharmacare-pro.git
git push -u origin main
```

## 3. Branch Strategy

Create these long-lived branches:

- `main` -> production-ready only
- `develop` -> integration branch

```powershell
git checkout -b develop
git push -u origin develop
git checkout main
```

Feature branch naming:

- `feature/<area>-<short-name>`
- `fix/<area>-<short-name>`
- `hotfix/<short-name>`

## 4. Protect Branches (GitHub Settings)

### `main` protection

- Require a pull request before merging
- Require approvals: at least 1
- Dismiss stale approvals when new commits are pushed
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Include administrators (recommended)
- Restrict force pushes and deletions

### `develop` protection

- Require pull request before merging
- Require status checks to pass
- Optional: 1 approval

## 5. Required Status Checks

Set these as required for protected branches:

- `Lint & Type Check`
- `Run Tests`

They are defined in:

- `.github/workflows/build.yml`

## 6. Enable Security Features

In GitHub repository settings, enable:

- Dependabot alerts
- Dependabot security updates
- Secret scanning
- Push protection for secrets (if available)
- Code scanning (optional now, recommended later)

## 7. Labels Setup

Labels are defined in:

- `.github/labels.yml`

Automation workflow:

- `.github/workflows/sync-labels.yml`

Steps:

1. Open Actions tab.
2. Run `Sync Labels` workflow manually once.
3. Verify labels are created.

## 8. Milestones (Create in GitHub)

Create these milestones exactly:

1. `M0 Repo Stabilization`
2. `M1 Auth + App Shell`
3. `M2 Medicine Master`
4. `M3 Billing Core`
5. `M4 Purchase + Customer`
6. `M5 Reports + Backup`
7. `M6 Hardening + Release`

Reference:

- `docs/DELIVERY_PLAN.md`

## 9. GitHub Project Board Setup

Create a GitHub Project (table or board view).

Recommended columns:

- Backlog
- Ready
- In Progress
- In Review
- Blocked
- Done

Recommended custom fields:

- Priority (`p0`, `p1`, `p2`, `p3`)
- Area (`billing`, `medicine`, `purchase`, `customers`, `reports`, `infra`)
- Milestone (`M0`..`M6`)
- Estimate (`0.5d`, `1d`, `3d`, `1w`)
- Owner
- Due Date

## 10. Issue Creation Rules

Use issue templates only:

- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/ISSUE_TEMPLATE/work_item.yml`

For every issue, set:

- One `type:*` label
- One `priority:*` label
- One `area:*` label
- One `status:*` label
- A milestone (`M0`..`M6`)
- Add to GitHub Project board

## 11. PR Workflow Rules

PR template is:

- `.github/pull_request_template.md`

Rules:

1. PR must link issue(s).
2. PR must include test evidence.
3. PR must pass required checks.
4. No direct pushes to `main`.
5. Merge method: Squash and merge (recommended for clean history).

## 12. Code Ownership

Code owners file:

- `.github/CODEOWNERS`

Action:

- Replace `@YOUR_GITHUB_USERNAME` with your real GitHub username/team.

## 13. Secrets and Release Configuration

Required repository secrets for Tauri build/release workflows:

- `TAURI_PRIVATE_KEY`
- `TAURI_KEY_PASSWORD`

Optional future secrets:

- `CLAUDE_API_KEY`
- Any cloud integration keys

Workflows:

- CI/build/test: `.github/workflows/build.yml`
- Release by tag: `.github/workflows/release.yml`

## 14. Release Process (Production)

1. Ensure milestone release criteria are met.
2. Update `CHANGELOG.md`.
3. Merge approved changes into `main`.
4. Create and push semantic tag:

```powershell
git checkout main
git pull
git tag v0.1.0
git push origin v0.1.0
```

5. Verify GitHub Release is created and artifacts uploaded.

## 15. Team Operating Cadence

Weekly rhythm:

- Monday: Plan sprint and assign issues
- Daily: update issue comments and board status
- Friday: demo, risk review, release decision

Mandatory behaviors:

- Keep blockers in `status:blocked`
- Close issue only when Definition of Done is satisfied
- Keep milestone scope realistic

## 16. Definition of Done (Per Issue)

- Code implemented and reviewed
- CI checks pass
- Tests added/updated
- Security and permission checks handled
- User-facing error messages are friendly
- Docs/TODO updated if behavior changed

## 17. Quality Gates Before Any Merge

Run locally:

```powershell
npm run typecheck
npm run lint
npm test
```

For release candidates also run:

```powershell
npm run tauri:build
```

## 18. Initial Phase Execution Order (Recommended)

1. M0: Make repo compile and run with minimal placeholders.
2. M1: Complete auth/session and app shell navigation.
3. M2: Implement medicine + batch core CRUD.
4. M3: Implement POS transaction-safe billing flow.
5. M4: Add purchase and customer credit flows.
6. M5: Deliver reports + backup/restore.
7. M6: Hardening, performance, release packaging.

## 19. Admin Quick Checklist (One-Time)

- [ ] Repo created on GitHub
- [ ] Local repo pushed (`main`, `develop`)
- [ ] Branch protections enabled
- [ ] Required checks configured
- [ ] Security features enabled
- [ ] Labels synced via workflow
- [ ] Milestones created
- [ ] Project board created with fields
- [ ] CODEOWNERS updated with real usernames
- [ ] Tauri release secrets added

## 20. Where Everything Lives

- Master process: `docs/GITHUB_PROJECT_MASTER_CHECKLIST.md`
- Delivery milestones: `docs/DELIVERY_PLAN.md`
- Live project setup details: `docs/GITHUB_LIVE_PROJECT_SETUP.md`
- Contributing rules: `CONTRIBUTING.md`
- Security policy: `SECURITY.md`
- Release notes: `CHANGELOG.md`

## 21. Live Implementation Status (March 2026)

Milestone status:

- [x] M0 Repo Stabilization
- [x] M1 Auth + App Shell
- [x] M2 Medicine Master (baseline)
- [x] M3 Billing Core (baseline)
- [x] M4 Purchase + Supplier + Customer (baseline)
- [ ] M5 Reports + Backup
- [ ] M6 Hardening + Release (in progress)

Feature completion highlights:

- [x] Customer/doctor/supplier core workflows
- [x] Manual purchase + PO + purchase return/debit note
- [x] Email import (IMAP config, polling, parser/mapping/review, auto-match)
- [x] POS loyalty redemption + prescription attachment + allergy warnings
- [x] Expiry dashboard + barcode expiry lookup + return-note creation from selected batches
- [x] Barcode label template designer + ZPL queue generation + print queue requeue flow

Hard-check status:

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run test -- --run`
- [x] `npm run build`
- [x] `cargo fmt -- --check`
- [x] `cargo clippy --all-targets --all-features -- -D warnings`
- [x] `cargo check --all-targets`
- [x] `cargo test`
