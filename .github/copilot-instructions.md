# PharmaCare Pro — GitHub Copilot Instructions

## Project Summary
Cross-platform desktop pharmacy management app. Tauri 2.0 (Rust) + React 18 + TypeScript + SQLite.
Target: Indian pharmacy staff who are NOT IT people — UI must be dead simple, no training required.

## Architecture (ALWAYS follow this chain)
Component → Service (src/services/) → invoke() → Tauri Command (Rust) → SQLite → Result

NEVER call invoke() directly from a component. NEVER write SQL in components or services.

## Code Rules
- async/await always, never .then()
- try/catch on every invoke() call — show user-friendly toast on error
- No `any` types — use types from @/types/index.ts
- Min 44px height on ALL buttons and inputs
- Always show spinner during loading
- Always show toast after save/delete
- Always confirm before delete (ConfirmDialog component)
- Audit log every create/update/delete (Rust side)

## Security Rules
- Passwords: bcrypt only in Rust, never plain text, never in frontend
- SQL: parameterized queries ONLY — never string interpolation
- API keys: OS keychain (tauri-plugin-keyring), never in .env or code
- Permissions: check hasPermission() before every sensitive action
- Sessions: JWT in OS keychain, 8hr expiry

## File Naming
- Components: PascalCase.tsx
- Services: camelCaseService.ts
- Stores: camelCaseStore.ts
- Types: IPascalCase (interface prefix I)
- Rust commands: snake_case

## Module Guide
- Billing/POS: F2 shortcut, barcode scan auto-add, FEFO batch, GST calc, print receipt
- Medicine: master CRUD + batch CRUD + barcode generate + rack location
- Purchase: manual entry + email IMAP auto-import CSV/Excel from distributors
- Customers: patient profiles, purchase history, allergies, loyalty points
- Expiry: scan barcode to check, colour-coded risk, build return list
- Reports: sales/purchase/stock/GST/P&L + CA annual package ZIP
- AI Tier1: pure SQL math (demand forecast, expiry risk, customer segments)
- AI Tier3: Claude API (natural language Q&A, WhatsApp message drafts)
