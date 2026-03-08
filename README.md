# PharmaCare Pro

> Complete pharmacy management system for Indian pharmacies.
> Cross-platform (Windows / macOS / Linux) · Offline-first · AI-powered

---

## Quick Start (5 minutes)

### Prerequisites
| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 LTS | https://nodejs.org |
| Rust | Stable | https://rustup.rs |
| VS Code | Latest | https://code.visualstudio.com |

### Steps
```bash
# 1. Open this folder in VS Code
# 2. Install recommended extensions (prompt will appear — click Install All)
# 3. Run:
npm install
npm run tauri:dev
# First build takes 3-5 min (Rust compiling). Subsequent restarts are instant.
```

### Build Installers
```bash
npm run tauri:build
# Output:
#   Windows  → src-tauri/target/release/bundle/nsis/*.exe
#   macOS    → src-tauri/target/release/bundle/dmg/*.dmg
#   Linux    → src-tauri/target/release/bundle/appimage/*.AppImage
```

---

## Using GitHub Copilot to Build This

Open Copilot Chat: `Ctrl+Shift+I`

```
@workspace what should I build first?
@workspace implement auth_login in src-tauri/src/commands/auth.rs
@workspace implement billing_create_bill as a SQLite transaction
@workspace build the medicine search dropdown for the POS screen
@workspace add drug interaction warnings to the billing screen
@workspace implement Database::init with SQLCipher encryption
@workspace write unit tests for the GST calculation utils
```

The `.github/copilot-instructions.md` file gives Copilot full context about the project.
It's read automatically when you use `@workspace`.

---

## Project Structure

```
pharmacare-pro/
├── .github/
│   ├── copilot-instructions.md  ← Copilot context (read this!)
│   └── workflows/
│       ├── build.yml            ← Build on push to main
│       └── release.yml          ← Build + release on version tag
├── .vscode/
│   ├── extensions.json          ← Copilot, Rust, Tailwind, etc.
│   ├── settings.json
│   └── launch.json              ← Debugger config
├── src-tauri/                   ← RUST BACKEND
│   ├── build.rs                 ← Required by Tauri (do not delete)
│   ├── Cargo.toml               ← Rust dependencies
│   ├── tauri.conf.json          ← Window, bundle, security config
│   └── src/
│       ├── main.rs              ← Registers all 60+ Tauri commands
│       ├── lib.rs               ← Library root
│       ├── db.rs                ← SQLite init + migrations
│       ├── error.rs             ← User-friendly error types
│       └── commands/
│           ├── mod.rs           ← Declares all command modules
│           ├── auth.rs          ← Login, sessions, users (bcrypt + JWT)
│           ├── billing.rs       ← POS — most critical, runs as TRANSACTION
│           ├── medicine.rs      ← Medicine + batch CRUD
│           ├── purchase.rs      ← Supplier bills + PO management
│           ├── customer.rs      ← Patient profiles + doctor management
│           ├── inventory.rs     ← Stock queries + adjustments
│           ├── barcode.rs       ← Generate + print barcodes
│           ├── email_import.rs  ← IMAP auto-import of distributor bills
│           ├── printer.rs       ← ESC/POS thermal + ZPL barcode printing
│           ├── reports.rs       ← All reports + CA annual package ZIP
│           ├── backup.rs        ← Encrypted DB backup + restore
│           ├── license.rs       ← LemonSqueezy license validation
│           ├── ai_commands.rs   ← AI analytics (Tier 1) + Claude API (Tier 3)
│           └── settings.rs      ← App configuration
├── src/                         ← REACT FRONTEND
│   ├── main.tsx                 ← Entry point
│   ├── App.tsx                  ← Router, auth guard, global shortcuts
│   ├── styles/globals.css       ← Tailwind base styles
│   ├── types/index.ts           ← All TypeScript interfaces (IMedicine, IBill, etc.)
│   ├── components/
│   │   ├── layout/              ← Sidebar, Header, Layout wrapper
│   │   └── shared/              ← ConfirmDialog, EmptyState, PageHeader, StatusBadge
│   ├── pages/
│   │   ├── Auth/                ← Login page
│   │   ├── Dashboard/           ← Home: stats, briefing, quick actions
│   │   ├── Billing/             ← POS: search → cart → payment → print
│   │   │   └── components/      ← MedicineSearchDropdown, PaymentPanel, CustomerSelector
│   │   ├── Medicine/            ← Medicine master + batch management
│   │   ├── Purchase/            ← Supplier bills + email import
│   │   ├── Customers/           ← Patient profiles + history
│   │   ├── Doctors/             ← Doctor profiles
│   │   ├── Suppliers/           ← Distributor management
│   │   ├── Expiry/              ← Scan barcode + risk dashboard
│   │   ├── Barcodes/            ← Generate + print labels
│   │   ├── Reports/             ← All reports + CA package
│   │   ├── AI/                  ← AI features dashboard
│   │   └── Settings/            ← App configuration + user management
│   ├── services/                ← Business logic (14 service files)
│   │   ├── billingService.ts    ← createBill, cancelBill, getTodaySummary
│   │   ├── medicineService.ts   ← search, get, create, createBatch
│   │   ├── customerService.ts   ← search, get, create, purchase history
│   │   ├── supplierService.ts   ← list, create, update
│   │   ├── purchaseService.ts   ← create/list purchase bills + POs
│   │   ├── inventoryService.ts  ← stock, low stock, expiry list
│   │   ├── barcodeService.ts    ← generate, bulk, print labels
│   │   ├── emailImportService.ts← IMAP connect, fetch, import
│   │   ├── printerService.ts    ← list printers, print bill/labels
│   │   ├── reportService.ts     ← all reports + CA package
│   │   ├── aiService.ts         ← Tier 1 AI (offline SQL analytics)
│   │   ├── claudeService.ts     ← Tier 3 AI (Claude API — internet)
│   │   ├── backupService.ts     ← create, restore, list
│   │   ├── licenseService.ts    ← validate, activate, status
│   │   └── settingsService.ts   ← get, set, getAll
│   ├── store/
│   │   ├── authStore.ts         ← Login state + permissions
│   │   ├── cartStore.ts         ← POS cart (GST auto-calculated)
│   │   └── uiStore.ts           ← Sidebar, notifications
│   ├── hooks/
│   │   ├── useDebounce.ts       ← Debounce input values
│   │   ├── usePermission.ts     ← Check user permissions
│   │   ├── useToast.ts          ← Toast notification helpers
│   │   ├── useKeyboard.ts       ← Global keyboard shortcuts
│   │   └── useSettings.ts       ← Fetch settings from DB
│   ├── utils/
│   │   ├── gst.ts               ← GST calculation (ALWAYS use this — never inline)
│   │   ├── currency.ts          ← Format Indian Rupees
│   │   ├── date.ts              ← Format dates, expiry color coding
│   │   ├── validation.ts        ← Zod schemas for forms
│   │   └── barcode.ts           ← Barcode string generation
│   └── db/
│       └── migrations/
│           └── 001_initial.sql  ← Complete schema: 25 tables, seed data
├── TODO.md                      ← Phase-by-phase build checklist
├── package.json                 ← All npm dependencies
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## Security

| Feature | Implementation |
|---------|---------------|
| Passwords | bcrypt hash cost=12 in Rust — never plain text |
| Database | SQLCipher AES-256 encryption at rest |
| API keys | OS keychain (Windows Credential Store / macOS Keychain) |
| Sessions | JWT, 8-hour expiry, stored in OS keychain |
| Audit trail | Append-only log, every DB write recorded |
| SQL | Parameterized queries only — never string interpolation |
| Account lockout | 5 failed attempts → 30 min lock |
| Permissions | RBAC checked in every Rust command |

---

## AI Features

| Feature | Tier | Internet | RAM |
|---------|------|----------|-----|
| Morning briefing | 1 — SQL math | No | 0 |
| Demand forecast | 1 — SQL math | No | 0 |
| Expiry risk score | 1 — SQL math | No | 0 |
| Customer segments | 1 — SQL math | No | 0 |
| Anomaly detection | 1 — SQL math | No | 0 |
| Drug interactions | Built-in DB | No | 0 |
| Natural language Q&A | 3 — Claude API | Yes | 0 |
| WhatsApp composer | 3 — Claude API | Yes | 0 |

---

## Keyboard Shortcuts (POS)

| Key | Action |
|-----|--------|
| F2 | New bill from anywhere |
| F4 | Hold current bill |
| F5 | Open held bills |
| F7 | Open payment screen |
| Escape | Close any popup |

---

## Pricing Tiers
| Plan | Price | PCs | Features |
|------|-------|-----|---------|
| Starter | ₹4,999/yr | 1 | All core features |
| Professional | ₹9,999/yr | 2 | + AI features |
| Multi-Branch | ₹19,999/yr | 5 | + Cloud sync (Phase 2) |
| One-Time | ₹24,999 | 1 | Lifetime, major updates extra |
