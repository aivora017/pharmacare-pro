# PharmaCare Pro — GitHub Copilot Instructions

## Project Overview
PharmaCare Pro is a **cross-platform desktop pharmacy management system** built with:
- **Framework**: Tauri 2.0 (Rust backend) + React 18 + TypeScript
- **Database**: SQLite via `better-sqlite3` (local, embedded, no server needed)
- **Styling**: Tailwind CSS + shadcn/ui components
- **State**: Zustand for global state
- **Target Users**: Non-IT pharmacy staff — UI must be extremely simple and self-explanatory

## Core Design Principles
1. **Simplicity First** — Every screen must be usable by someone who has never used software before
2. **Offline First** — Everything works without internet. Cloud AI features are clearly marked optional
3. **Lightweight** — Total RAM usage must stay under 200MB. Use lazy loading everywhere
4. **Fast** — POS screen must respond in under 100ms. Search must return results under 50ms
5. **Safe** — All data is encrypted. All actions are logged. All user inputs are validated

## Naming Conventions
- Components: `PascalCase` (e.g., `MedicineCard.tsx`)
- Services: `camelCase` with `Service` suffix (e.g., `medicineService.ts`)
- Database functions: `camelCase` with verb prefix (e.g., `getMedicines`, `createBill`)
- Types/Interfaces: `PascalCase` with `I` prefix for interfaces (e.g., `IMedicine`)
- Constants: `UPPER_SNAKE_CASE`
- Zustand stores: `camelCase` with `Store` suffix (e.g., `medicineStore.ts`)

## File Structure Rules
- Each page has its own folder: `pages/PageName/index.tsx` + `pages/PageName/components/`
- Services live in `services/` — no database calls directly in components
- All database queries go through `db/` layer only
- All Tauri commands go through `services/` — never call `invoke` directly in components
- Types are shared in `types/` — never define types inline in components

## Code Style
```typescript
// Always use async/await, never .then()
// Always handle errors with try/catch
// Always show user-friendly error messages (no technical errors to users)
// Always validate inputs before database operations
// Always use TypeScript strict mode - no 'any' types
// Always add JSDoc comments to all exported functions
```

## UI/UX Rules
- **Big buttons** — minimum 44px height for all interactive elements (touch-friendly)
- **Clear labels** — every button/field has a plain English label (no jargon)
- **Confirmation dialogs** — always confirm before delete/cancel operations
- **Loading states** — always show a spinner during async operations
- **Success/error feedback** — always show toast notifications after actions
- **Keyboard shortcuts** — F2=New Bill, F3=Search Medicine, F5=Refresh, Escape=Close modal
- **Color coding** — Green=success/safe, Amber=warning, Red=error/danger, Blue=information

## Security Rules
- **Never store passwords in plain text** — use bcrypt for user passwords
- **Never store API keys in code** — use environment variables or OS keychain
- **Always sanitize user inputs** — use parameterized queries (never string concatenation in SQL)
- **Always validate on server side** (Rust/Tauri commands) — never trust frontend validation alone
- **Audit log everything** — every create/update/delete must write to audit_log table
- **Role-based access** — check user permissions before every sensitive operation

## Database Rules
- Always use **parameterized queries** — never interpolate user input into SQL strings
- Always wrap multi-step operations in **transactions**
- Always use **RETURNING** clause to get inserted/updated record back
- Run **migrations** on startup — never modify the database schema manually
- Always use **soft deletes** (`deleted_at` timestamp) — never hard delete records

## AI Features Architecture
- **Tier 1** (Smart Analytics): Pure SQL/TypeScript math — no external libraries
- **Tier 2** (On-Device): ONNX Runtime models in `src/ai/models/` — lazy loaded
- **Tier 3** (Cloud): Claude API via `src/services/claudeService.ts` — always check internet first

## Module Descriptions

### Billing/POS Module (`pages/Billing/`)
Fast keyboard-driven Point of Sale. Press F2 to open. Search medicine by name or scan barcode.
Auto-calculates GST. Supports cash, UPI, card, credit payment modes. Prints to thermal or A4 printer.

### Medicine Module (`pages/Medicine/`)
Complete medicine master with batch tracking. Each batch tracks: batch no, expiry, quantity, rack location.
Generates barcodes per batch. Shows stock levels and expiry alerts.

### Purchase Module (`pages/Purchase/`)
Manage supplier invoices. Supports manual entry AND email auto-import from CSV/Excel.
Auto-matches imported items to medicine master. Shows review screen before saving.

### Customer Module (`pages/Customers/`)
Patient profiles with full purchase history, linked doctor, outstanding balance, allergy records.
One-click billing from patient profile.

### Reports Module (`pages/Reports/`)
GST reports, CA/ROC package, sales reports, stock reports, expiry reports.
All exportable as PDF and Excel.

### AI Module (`pages/AI/`)
Morning briefing, demand forecast, expiry risk scores, customer segments.
Natural language business assistant (requires internet).
