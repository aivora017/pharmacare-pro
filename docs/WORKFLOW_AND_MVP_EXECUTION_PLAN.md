# Workflow + Multi-MVP Execution Plan

This plan is for a solo developer building a production-grade app with DevOps discipline, while keeping the project public and reducing copy risk as much as possible.

## 1. Core Reality and Strategy
- Public repository means source code can be viewed and cloned.
- You cannot technically prevent copying in a public repo.
- You can reduce misuse with legal protection and product architecture.

### Practical protection model (recommended)
1. Keep this repo public for visibility, progress, and trust.
2. Use strict license terms (`All Rights Reserved` or commercial source-available terms).
3. Keep business secrets private:
- release signing keys
- production API keys
- proprietary AI models/weights
- advanced premium modules (if needed)
4. Ship signed installers only.
5. Protect brand with trademark notice for app name/logo.

## 2. DevOps Workflow (Solo but Production-grade)

## Branch model
- `main`: always release-ready
- `develop`: integration
- feature branches: `feature/<area>-<name>`
- fixes: `fix/<area>-<name>`

## Required flow per task
1. Create issue from template.
2. Assign milestone + labels + estimate.
3. Create branch from `develop`.
4. Implement code + tests.
5. Run local checks:
```powershell
npm run typecheck
npm run lint
npm test
```
6. Open PR -> `develop`.
7. Merge only when CI is green.
8. Promote `develop` -> `main` at milestone close.
9. Tag release from `main` (`vX.Y.Z`).

## Automation already in repo
- CI build/test workflow: `.github/workflows/build.yml`
- Release workflow: `.github/workflows/release.yml`
- Label sync workflow: `.github/workflows/sync-labels.yml`

## 3. Multi-MVP Plan (Load Minimization)

Use thin vertical slices. Each MVP must be deployable and testable.

## MVP 0: Stabilization and Runability (Week 1)
Goal: project compiles and starts reliably.

Deliverables:
- Resolve missing module imports and command registration mismatches.
- App boots with placeholder pages where needed.
- Tauri backend starts without missing modules.
- CI passing for lint/typecheck/tests.

Exit criteria:
- `npm run tauri:dev` starts app successfully.
- No blocking compile errors.

## MVP 1: Authentication + App Shell (Week 2)
Goal: secure entry and usable navigation shell.

Deliverables:
- Login/logout/session restore.
- Sidebar + header + protected routes.
- Role-based menu visibility.

Exit criteria:
- Login works with valid/invalid credentials.
- Session persists across restart.

## MVP 2: Medicine Master Core (Weeks 3-4)
Goal: stock master foundation.

Deliverables:
- Medicine list/search/add/edit.
- Batch add/edit and barcode lookup.
- Rack location validation.
- Low-stock and near-expiry indicators.

Exit criteria:
- Can create medicine and batch records end-to-end.
- Search and barcode lookup return correct medicine/batch.

## MVP 3: Billing Core (Weeks 5-7)
Goal: usable POS for real billing flow.

Deliverables:
- Fast medicine search and add to cart.
- Quantity/discount/GST calculation.
- Multi-mode payment panel.
- Atomic bill save transaction.
- Hold/restore bill baseline.

Exit criteria:
- End-to-end bill generation in under target UX latency.
- No partial writes on failure.

## MVP 4: Purchase + Supplier + Customer Credit (Weeks 8-10)
Goal: complete daily operations loop.

Deliverables:
- Supplier CRUD.
- Manual purchase bill entry.
- Customer profile + outstanding balance flow.

Exit criteria:
- Purchase updates stock.
- Credit billing updates customer outstanding correctly.

## MVP 5: Reports + Backup + Audit (Weeks 11-12)
Goal: compliance and operational confidence.

Deliverables:
- Sales/purchase/stock/GST reports.
- Audit log view/export.
- Backup and restore flow.

Exit criteria:
- Reports match database truth.
- Backup restore verified on test data.

## MVP 6: Hardening + Distribution (Weeks 13-14)
Goal: release-grade quality.

Deliverables:
- Performance pass (POS/search targets).
- Security hardening pass.
- Signed builds and release automation.

Exit criteria:
- No P0/P1 defects open.
- Installers produced and validated.

## 4. Initialization Steps (Do This First)

## A. Repository setup
1. Create GitHub repo (public or private).
2. Push local code:
```powershell
cd d:\pharmacare-pro
git remote add origin https://github.com/<your-username>/pharmacare-pro.git
git push -u origin main
```
3. Create and push `develop`:
```powershell
git checkout -b develop
git push -u origin develop
git checkout main
```

## B. GitHub settings
1. Enable branch protection on `main` and `develop`.
2. Require checks:
- `Lint & Type Check`
- `Run Tests`
3. Enable Dependabot and secret scanning.
4. Run `Sync Labels` workflow once.

## C. Project management setup
1. Create milestones `M0` to `M6`.
2. Create GitHub Project board:
- Backlog, Ready, In Progress, In Review, Blocked, Done.
3. Add fields:
- Priority, Area, Milestone, Estimate, Owner, Due Date.

## D. Security and ownership setup
1. Update `.github/CODEOWNERS` with your real username.
2. Add repository secrets:
- `TAURI_PRIVATE_KEY`
- `TAURI_KEY_PASSWORD`
3. Add a strict license file and notice (recommended next step).

## E. Local dev bootstrap
1. Install dependencies:
```powershell
npm install
```
2. Validate baseline commands:
```powershell
npm run typecheck
npm run lint
npm test
```
3. Run app:
```powershell
npm run tauri:dev
```

## 5. First 10 Issues to Create Immediately
1. M0: Fix frontend missing imports/pages.
2. M0: Fix tauri command module mismatches.
3. M0: Add placeholder pages for route stability.
4. M0: Add base db service wiring and startup checks.
5. M1: Implement login page and auth flow.
6. M1: Implement session restore and logout flow.
7. M2: Medicine list and search API/UI.
8. M2: Batch create/edit with validation.
9. M3: Bill creation transaction in Rust command.
10. M3: Payment panel save + print baseline.

## 6. Weekly Solo Execution Rhythm
- Monday: pick 5-8 issues from one MVP only.
- Daily: move cards and post short progress notes.
- Friday: demo build + risk review + close completed issues.
- End of MVP: tag release candidate and smoke test.

## 7. Anti-Copy Checklist for Public Project
- Use restrictive license terms.
- Do not commit proprietary keys/models/data.
- Keep premium logic in private modules if needed.
- Ship signed binaries.
- Use clear copyright + trademark notice.

## 8. Success Metrics by MVP
- MVP0: app boots and CI green.
- MVP1: secure auth/session stable.
- MVP2: medicine/batch operations reliable.
- MVP3: billing works end-to-end with transaction safety.
- MVP4: purchase/customer credit loop complete.
- MVP5: reports and backup trusted.
- MVP6: release-grade installers shipped.

## 9. Related Files
- `docs/GITHUB_PROJECT_MASTER_CHECKLIST.md`
- `docs/DELIVERY_PLAN.md`
- `docs/GITHUB_LIVE_PROJECT_SETUP.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
