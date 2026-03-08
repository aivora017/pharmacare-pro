# MVP0 Issue Drafts (Create These First)

Copy these into GitHub issues using the `Work Item` template.

## 1) [TASK] M0 - Fix missing frontend route/page modules

- Labels: `type:task`, `priority:p0`, `area:infra`, `status:ready`
- Milestone: `M0 Repo Stabilization`
- Outcome: `npm run typecheck` has zero missing-module errors from app routing imports.
- Acceptance:
  - Add placeholder page modules for all routes used in `src/App.tsx`.
  - Add missing layout/UI/hook placeholders needed to compile.
  - Keep all placeholders clearly marked for later replacement.

## 2) [TASK] M0 - Align Tauri command registration with existing modules

- Labels: `type:task`, `priority:p0`, `area:infra`, `status:ready`
- Milestone: `M0 Repo Stabilization`
- Outcome: Rust backend compiles without unresolved `mod`/command references.
- Acceptance:
  - Either stub missing command modules or temporarily narrow `invoke_handler`.
  - `cargo check` passes in `src-tauri`.

## 3) [TASK] M0 - Baseline TypeScript/ESLint config hardening

- Labels: `type:task`, `priority:p1`, `area:infra`, `status:ready`
- Milestone: `M0 Repo Stabilization`
- Outcome: `typecheck` and `lint` are meaningful and runnable.
- Acceptance:
  - Keep `tsconfig.json` strict.
  - Keep `.eslintrc.cjs` with TypeScript and hooks rules.
  - Resolve current lint errors in tracked files.

## 4) [TASK] M0 - Ensure local bootstrap works on Windows

- Labels: `type:task`, `priority:p1`, `area:infra`, `status:ready`
- Milestone: `M0 Repo Stabilization`
- Outcome: new machine setup succeeds with documented commands.
- Acceptance:
  - Document `npm.cmd` usage for PowerShell execution-policy environments.
  - Confirm `npm install`, `typecheck`, `lint`, and tests run.

## 5) [TASK] M0 - Establish first CI green baseline

- Labels: `type:task`, `priority:p0`, `area:infra`, `status:ready`
- Milestone: `M0 Repo Stabilization`
- Outcome: PR checks pass on `develop -> main`.
- Acceptance:
  - `Lint & Type Check` and `Run Tests` workflows pass.
  - Required checks are selectable in branch protection rules.

## 6) [TASK] M2 - Medicine Master list + create flow

- Labels: `type:task`, `priority:p0`, `area:medicine`, `status:ready`
- Milestone: `M2 Medicine Master`
- Outcome: Users can search/filter/sort medicines and add a new medicine from UI.
- Acceptance:
  - Implement `medicine_search`, `medicine_list_categories`, and `medicine_create` commands.
  - Replace `/medicine` placeholder with real page in app router.
  - Add frontend `medicineService` and load list data in page.

## 7) [TASK] M2 - Medicine edit + detail drawer

- Labels: `type:task`, `priority:p1`, `area:medicine`, `status:ready`
- Milestone: `M2 Medicine Master`
- Outcome: Users can open medicine detail and update medicine metadata.
- Acceptance:
  - Add backend command for medicine update and single fetch by id.
  - Add UI detail panel with editable fields and save validation.

## 8) [TASK] M2 - Batch add + stock indicators

- Labels: `type:task`, `priority:p1`, `area:medicine`, `status:ready`
- Milestone: `M2 Medicine Master`
- Outcome: Users can add batches and see low-stock and expiry indicators in list/detail.
- Acceptance:
  - Add `medicine_create_batch` command and service call.
  - Validate rack location format and expiry date.
  - Show low-stock badge when stock <= reorder_level.
