# GitHub Live Project Setup Guide

This guide turns the repository into a live, trackable project.

## 1. Repository Settings
1. Enable branch protection on `main`:
- Require pull request before merging
- Require status checks to pass
- Require at least 1 approval
- Dismiss stale approvals on new commits

2. Add required status checks:
- `Lint & Type Check`
- `Run Tests`

3. Enable Dependabot alerts and secret scanning.

## 2. Project Board
Create a GitHub Project with columns:
- Backlog
- Ready
- In Progress
- In Review
- Blocked
- Done

Fields to add:
- Priority (`p0/p1/p2/p3`)
- Area (`billing/medicine/purchase/customers/reports/infra`)
- Milestone (`M0..M6`)
- Estimate

## 3. Milestones
Create milestones matching `docs/DELIVERY_PLAN.md`:
- M0 Repo Stabilization
- M1 Auth + App Shell
- M2 Medicine Master
- M3 Billing Core
- M4 Purchase + Customer
- M5 Reports + Backup
- M6 Hardening + Release

## 4. Issue Workflow
- Create issues only via templates in `.github/ISSUE_TEMPLATE/`.
- Tag each issue with `type:*`, `priority:*`, `area:*`, and `status:*`.
- Link issue to milestone and project board.

## 5. PR Workflow
- Create feature branch from `develop`.
- Open PR to `develop` with linked issue.
- Merge `develop` to `main` only after milestone sign-off.

## 6. Release Workflow
- Update `CHANGELOG.md`.
- Tag release `vX.Y.Z` on `main`.
- Let `.github/workflows/release.yml` build and publish assets.

## 7. Team Ritual
- Daily standup updates in issue comments.
- Weekly demo and risk review.
- Keep blockers visible using `status:blocked` label.
