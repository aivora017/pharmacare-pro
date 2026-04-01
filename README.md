# PharmaCare Pro

A GST-compliant pharmacy management desktop application for Indian retail pharmacies. Built with Tauri — works offline, installs like native software, runs on Windows/macOS/Linux.

Designed as a faster, simpler alternative to legacy solutions like Marg ERP.

---

## Features

### Billing & Invoicing
- GST-compliant bills: GSTIN, HSN codes, 5%/12%/18% slabs, CGST/SGST split on every invoice
- Drug license number auto-printed on invoices
- Barcode generation for medicines
- WhatsApp bill sharing with AI-assisted message composer
- Offline billing with background sync when reconnected

### Inventory Management
- Batch and expiry date tracking on every stock entry (legally required)
- Expiry alerts at 30 / 60 / 90 days
- Low-stock alerts with configurable thresholds
- Stock adjustments with audit trail
- Schedule H / H1 / X controlled substance flagging at billing

### Compliance
- GST compliance dashboard — CGST/SGST verification, mismatch alerts
- Prescription record storage (required for Schedule H/X drugs)
- Drug license tracking
- Batch-level traceability

### Supplier & Purchase Management
- Supplier directory with contact management
- Purchase orders and GRN tracking
- Supplier-wise purchase history

### Customer Management
- Customer credit and advance tracking
- Customer purchase history
- Doctor directory linked to prescriptions

### Reports & Analytics
- Daily, monthly, and custom date range sales reports
- GST summary reports (GSTR-ready)
- Expiry and near-expiry reports
- Inventory valuation
- CSV and PDF export

### Administration
- Multi-user support with role-based access
- Pharmacy profile setup (GSTIN, drug license, address)
- Data backup and restore
- Network sync for multi-counter setups

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + Lucide icons |
| Desktop shell | Tauri v2 (Rust backend) |
| State management | Zustand |
| Database | SQLite via Tauri FS plugin |
| Validation | Zod |
| Charts | Recharts |
| Router | React Router v6 |

---

## Project Structure

```
src/
├── pages/              Feature pages (Billing, Inventory, Reports, etc.)
├── components/
│   ├── layout/         Header, Sidebar, Layout wrapper
│   └── shared/         Reusable: FormField, StatusBadge, ConfirmDialog, etc.
├── services/           Business logic (billingService, gstService, inventoryService, etc.)
├── store/              Zustand stores (auth, cart)
├── hooks/              useDebounce, useKeyboard
├── db/
│   └── migrations/     SQL migration files
└── types/              Shared TypeScript types

src-tauri/              Tauri/Rust desktop shell and native APIs
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Rust + Cargo — [install via rustup](https://rustup.rs)

### Development

```bash
git clone https://github.com/aivora017/pharmacare-pro.git
cd pharmacare-pro
npm install
npm run dev              # Web preview
npm run tauri:dev        # Full desktop app with hot-reload
```

### Build

```bash
npm run tauri:build      # Produces native installer for your OS
```

Output: `src-tauri/target/release/bundle/`

---

## Compliance

Built to meet Indian pharmacy regulatory requirements:

- **GST Act** — Every bill includes GSTIN, HSN code, GST rate, CGST + SGST breakdown
- **Drugs and Cosmetics Act** — Schedule H/H1/X substances flagged at billing, prescriptions stored
- **Drug License** — License number on all invoices
- **Batch traceability** — Batch number + expiry on every stock entry

> The GST compliance dashboard automatically flags CGST + SGST mismatches before filing.

---

## Pricing

| Plan | Price | Target |
|------|-------|--------|
| Basic | ₹999/month | Single-counter pharmacies |
| Standard | ₹1,999/month | Multi-counter with reporting |
| Pro | ₹2,999/month | Chain pharmacies, full features |

---

## License
MIT
