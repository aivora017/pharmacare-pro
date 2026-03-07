# Contributing to PharmaCare Pro

## Branch Strategy
- `main`: production-ready, releaseable only.
- `develop`: integration branch for completed features.
- `feature/<area>-<short-name>`: regular feature work.
- `fix/<area>-<short-name>`: bug fixes.
- `hotfix/<short-name>`: urgent production fixes.

## Commit Convention
Use Conventional Commits:
- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `docs: ...`
- `test: ...`
- `chore: ...`

Examples:
- `feat(billing): add FEFO batch selection`
- `fix(auth): handle locked account error message`

## Pull Request Rules
1. Link at least one issue.
2. Keep PRs focused and small when possible.
3. Add test evidence (unit/manual).
4. Include screenshots/videos for UI changes.
5. Do not merge without passing CI checks.

## Quality Gate (Required)
Before opening a PR:
```bash
npm run typecheck
npm run lint
npm test
```

## Coding Standards
- Use TypeScript strict typing. Avoid `any`.
- Use async/await with try/catch for async calls.
- Show user-friendly error messages only.
- Validate inputs before service/database operations.
- Route all DB operations through service/db layers.

## Definition of Done
- Feature behavior implemented.
- Error states handled.
- Tests updated.
- Documentation and TODO updated.
- Security and permission checks applied.
- Performance impact reviewed for billing path.
