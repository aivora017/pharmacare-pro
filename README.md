# 💊 PharmaCare Pro

> **A complete pharmacy management system for small to mid-range pharmacies.**
> Cross-platform (Windows, macOS, Linux) · Lightweight · Offline-first · AI-powered

## Project Operations

This repository is configured to run as a live production project on GitHub.

- Delivery roadmap: `docs/DELIVERY_PLAN.md`
- Workflow + MVP execution plan: `docs/WORKFLOW_AND_MVP_EXECUTION_PLAN.md`
- GitHub tracking setup: `docs/GITHUB_LIVE_PROJECT_SETUP.md`
- Contribution rules: `CONTRIBUTING.md`
- Security process: `SECURITY.md`
- Release notes: `CHANGELOG.md`

For day-to-day work:
1. Create issues using templates in `.github/ISSUE_TEMPLATE/`.
2. Work in feature branches and open PRs with the PR template.
3. Keep issue labels and milestone status updated.
4. Merge only when CI checks are green.

---

## 🚀 Quick Start (First Time Setup)

### Step 1 — Install Prerequisites

| Tool | Version | Download Link |
|------|---------|---------------|
| Node.js | 20 LTS or newer | https://nodejs.org |
| Rust | Latest stable | https://rustup.rs |
| VS Code | Latest | https://code.visualstudio.com |
| GitHub Copilot | Extension | VS Code Extensions tab |

### Step 2 — Clone & Install

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/pharmacare-pro.git
cd pharmacare-pro

# Install Node.js dependencies
npm install

# The Rust dependencies install automatically when you first run the app
```

### Step 3 — Set Up Environment

```bash
# Copy the example environment file
cp .env.example .env

# Open .env and fill in your values (see .env.example for instructions)
```

### Step 4 — Run in Development Mode

```bash
npm run tauri dev
```

The app will open in a desktop window. The first run may take 2–3 minutes while Rust compiles.

### Step 5 — Build for Distribution

```bash
# Build for your current operating system
npm run tauri build

# Output files will be in: src-tauri/target/release/bundle/
# Windows: .exe installer
# macOS: .dmg file
# Linux: .AppImage file
```

---

## 📁 Project Structure

```
pharmacare-pro/
│
├── .github/                        # GitHub configuration
│   ├── workflows/                  # CI/CD pipelines (auto-build, security scan)
│   │   ├── build.yml              # Builds app on every push
│   │   ├── security.yml           # Runs security checks
│   │   └── release.yml            # Creates release when you tag a version
│   ├── ISSUE_TEMPLATE/            # Bug report & feature request templates
│   └── copilot-instructions.md    # ← Copilot reads this to understand the project
│
├── .vscode/                        # VS Code workspace settings
│   ├── settings.json              # Recommended settings for this project
│   ├── extensions.json            # Recommended extensions list
│   └── launch.json                # Debug configurations
│
├── src-tauri/                      # Rust/Tauri backend
│   ├── src/
│   │   ├── main.rs                # App entry point
│   │   ├── lib.rs                 # Register all Tauri commands
│   │   └── commands/              # Tauri commands (called from frontend)
│   │       ├── mod.rs             # Export all commands
│   │       ├── auth.rs            # Login, logout, session management
│   │       ├── medicine.rs        # Medicine CRUD operations
│   │       ├── billing.rs         # Billing and POS operations
│   │       ├── purchase.rs        # Purchase and supplier operations
│   │       ├── customer.rs        # Customer and doctor operations
│   │       ├── inventory.rs       # Stock management operations
│   │       ├── barcode.rs         # Barcode generation
│   │       ├── email.rs           # IMAP email integration
│   │       ├── printer.rs         # Thermal + normal + barcode printing
│   │       ├── reports.rs         # Report generation
│   │       ├── backup.rs          # Backup and restore
│   │       └── license.rs         # License validation
│   ├── Cargo.toml                 # Rust dependencies
│   ├── Cargo.lock                 # Rust lockfile (commit this!)
│   └── tauri.conf.json            # Tauri app configuration
│
├── src/                            # React/TypeScript frontend
│   │
│   ├── main.tsx                   # React entry point
│   ├── App.tsx                    # Root component, router setup, auth guard
│   ├── routes.tsx                 # All route definitions
│   │
│   ├── components/                # Reusable UI components
│   │   ├── layout/
│   │   │   ├── Layout.tsx         # Main app layout (sidebar + header + content)
│   │   │   ├── Sidebar.tsx        # Navigation sidebar with icons
│   │   │   ├── Header.tsx         # Top bar (search, notifications, user menu)
│   │   │   └── MobileNav.tsx      # Bottom navigation for small screens
│   │   ├── ui/                    # Low-level building blocks
│   │   │   ├── Button.tsx         # Button with variants (primary/secondary/danger)
│   │   │   ├── Card.tsx           # White card container with shadow
│   │   │   ├── Modal.tsx          # Accessible modal dialog
│   │   │   ├── Table.tsx          # Sortable, searchable data table
│   │   │   ├── SearchBox.tsx      # Fast search input with debounce
│   │   │   ├── Badge.tsx          # Status badges (green/amber/red)
│   │   │   ├── Alert.tsx          # Success/warning/error alert banners
│   │   │   ├── Toast.tsx          # Toast notification system
│   │   │   ├── LoadingSpinner.tsx # Loading indicator
│   │   │   ├── EmptyState.tsx     # Empty list placeholder with illustration
│   │   │   ├── ConfirmDialog.tsx  # "Are you sure?" confirmation dialog
│   │   │   ├── NumberInput.tsx    # Number input with +/- buttons
│   │   │   └── DatePicker.tsx     # Date picker component
│   │   └── shared/               # Cross-module shared components
│   │       ├── BarcodeScanner.tsx # USB + camera barcode scanner input
│   │       ├── BarcodeDisplay.tsx # Renders a barcode image (JsBarcode)
│   │       ├── PrintButton.tsx    # Print to any configured printer
│   │       ├── ExportButton.tsx   # Export as PDF or Excel
│   │       ├── MedicinePicker.tsx # Reusable medicine search dropdown
│   │       ├── CustomerPicker.tsx # Reusable customer search dropdown
│   │       └── DrugInteractionAlert.tsx # Drug interaction warning popup
│   │
│   ├── pages/                     # One folder per screen/feature
│   │   │
│   │   ├── Auth/                  # LOGIN SCREEN
│   │   │   ├── index.tsx          # Login page
│   │   │   └── components/
│   │   │       └── LoginForm.tsx
│   │   │
│   │   ├── Dashboard/             # HOME SCREEN (after login)
│   │   │   ├── index.tsx          # Main dashboard
│   │   │   └── components/
│   │   │       ├── MorningBriefing.tsx   # AI daily summary card
│   │   │       ├── SalesWidget.tsx       # Today's sales counter
│   │   │       ├── AlertsWidget.tsx      # Low stock + expiry alerts
│   │   │       ├── QuickActions.tsx      # Big shortcut buttons
│   │   │       └── SalesTrendChart.tsx   # Last 7 days sales chart
│   │   │
│   │   ├── Billing/               # POINT OF SALE — Most used screen
│   │   │   ├── index.tsx          # POS main screen
│   │   │   └── components/
│   │   │       ├── BillItemRow.tsx       # Single line item in bill
│   │   │       ├── PaymentPanel.tsx      # Payment mode selection
│   │   │       ├── CustomerSelector.tsx  # Link bill to patient
│   │   │       ├── BillingAssistant.tsx  # AI upsell suggestions panel
│   │   │       ├── HeldBills.tsx         # Show parked/held bills
│   │   │       └── BillPreview.tsx       # Print preview before printing
│   │   │
│   │   ├── Medicine/              # MEDICINE MASTER
│   │   │   ├── index.tsx          # Medicine list
│   │   │   └── components/
│   │   │       ├── MedicineForm.tsx      # Add/edit medicine form
│   │   │       ├── BatchList.tsx         # All batches for a medicine
│   │   │       ├── BatchForm.tsx         # Add/edit batch form
│   │   │       ├── StockCard.tsx         # Stock level visual card
│   │   │       └── AlternatesPanel.tsx   # Generic substitutes panel
│   │   │
│   │   ├── Purchase/              # BUYING FROM DISTRIBUTORS
│   │   │   ├── index.tsx          # Purchase bills list
│   │   │   └── components/
│   │   │       ├── PurchaseBillForm.tsx  # Manual purchase entry form
│   │   │       ├── EmailImport.tsx       # Email auto-import screen
│   │   │       ├── ImportReview.tsx      # Review parsed CSV before saving
│   │   │       ├── POCreator.tsx         # Purchase order creation
│   │   │       └── GRNForm.tsx           # Goods received note form
│   │   │
│   │   ├── Customers/             # PATIENT PROFILES
│   │   │   ├── index.tsx          # Customer list
│   │   │   └── components/
│   │   │       ├── CustomerForm.tsx      # Add/edit patient form
│   │   │       ├── PurchaseHistory.tsx   # Patient's bill timeline
│   │   │       ├── CreditLedger.tsx      # Outstanding balance details
│   │   │       ├── PrescriptionList.tsx  # Uploaded prescriptions
│   │   │       └── MedSyncCard.tsx       # Medication sync settings
│   │   │
│   │   ├── Doctors/               # DOCTOR PROFILES
│   │   │   ├── index.tsx          # Doctor list
│   │   │   └── components/
│   │   │       ├── DoctorForm.tsx        # Add/edit doctor form
│   │   │       └── DoctorAnalytics.tsx   # Prescriptions & revenue per doctor
│   │   │
│   │   ├── Suppliers/             # DISTRIBUTOR MANAGEMENT
│   │   │   ├── index.tsx          # Supplier list
│   │   │   └── components/
│   │   │       ├── SupplierForm.tsx      # Add/edit supplier form
│   │   │       ├── SupplierLedger.tsx    # Payments and outstanding
│   │   │       └── SupplierScore.tsx     # AI reliability score card
│   │   │
│   │   ├── Expiry/                # EXPIRY MANAGEMENT
│   │   │   ├── index.tsx          # Expiry dashboard (scan or list)
│   │   │   └── components/
│   │   │       ├── ExpiryScanner.tsx     # Scan barcode → show details
│   │   │       ├── ExpiryRiskList.tsx    # AI-scored risk list
│   │   │       └── ReturnNoteForm.tsx    # Raise return to supplier
│   │   │
│   │   ├── Barcodes/              # BARCODE MANAGEMENT
│   │   │   ├── index.tsx          # Barcode generation & print screen
│   │   │   └── components/
│   │   │       ├── BarcodeGenerator.tsx  # Generate barcodes for batches
│   │   │       ├── LabelDesigner.tsx     # Label size & content editor
│   │   │       └── PrintQueue.tsx        # Queue labels for printing
│   │   │
│   │   ├── Reports/               # ALL REPORTS
│   │   │   ├── index.tsx          # Reports menu
│   │   │   └── components/
│   │   │       ├── SalesReport.tsx
│   │   │       ├── PurchaseReport.tsx
│   │   │       ├── StockReport.tsx
│   │   │       ├── GSTReport.tsx
│   │   │       ├── CAPackage.tsx         # Full CA/ROC export
│   │   │       ├── ProfitLoss.tsx
│   │   │       └── AuditLog.tsx
│   │   │
│   │   ├── AI/                    # AI FEATURES DASHBOARD
│   │   │   ├── index.tsx          # AI features overview
│   │   │   └── components/
│   │   │       ├── DemandForecast.tsx    # Stock predictions
│   │   │       ├── CustomerSegments.tsx  # At-risk customers
│   │   │       ├── ABCAnalysis.tsx       # Inventory classification
│   │   │       ├── AnomalyLog.tsx        # Fraud/anomaly alerts
│   │   │       └── AskPharmaCare.tsx     # Natural language assistant
│   │   │
│   │   └── Settings/              # SETTINGS & CONFIGURATION
│   │       ├── index.tsx          # Settings menu
│   │       └── components/
│   │           ├── PharmacyProfile.tsx   # Name, logo, GSTIN, address
│   │           ├── UserManagement.tsx    # Staff accounts & roles
│   │           ├── PrinterSettings.tsx   # Configure 3 printer types
│   │           ├── EmailSettings.tsx     # IMAP email configuration
│   │           ├── BackupRestore.tsx     # Backup & restore database
│   │           ├── TaxSettings.tsx       # GST slabs configuration
│   │           └── LicenseActivation.tsx # Software license key
│   │
│   ├── services/                  # Business logic layer
│   │   ├── medicineService.ts     # Medicine & batch operations
│   │   ├── billingService.ts      # Bill creation, payment, returns
│   │   ├── purchaseService.ts     # PO, GRN, purchase bills
│   │   ├── customerService.ts     # Patient & doctor operations
│   │   ├── supplierService.ts     # Supplier management
│   │   ├── inventoryService.ts    # Stock adjustments, stocktake
│   │   ├── barcodeService.ts      # Barcode generate + print
│   │   ├── reportService.ts       # All report generators
│   │   ├── emailService.ts        # IMAP + CSV import
│   │   ├── printerService.ts      # Thermal + A4 + label printing
│   │   ├── backupService.ts       # Backup & restore
│   │   ├── notificationService.ts # WhatsApp / SMS integration
│   │   ├── licenseService.ts      # License validation
│   │   └── claudeService.ts       # Claude AI API calls
│   │
│   ├── store/                     # Zustand global state
│   │   ├── authStore.ts           # Logged-in user, permissions
│   │   ├── cartStore.ts           # Current billing cart (POS state)
│   │   ├── settingsStore.ts       # App settings (printer, tax, etc.)
│   │   ├── notificationStore.ts   # Toast notifications queue
│   │   └── aiStore.ts             # AI results cache (forecasts, segments)
│   │
│   ├── db/                        # Database layer (SQLite)
│   │   ├── index.ts               # Database connection + init
│   │   ├── migrations/            # Schema versioned migrations
│   │   │   ├── 001_initial.sql    # Base schema (all tables)
│   │   │   ├── 002_ai_tables.sql  # AI caches + anomaly log
│   │   │   └── 003_audit.sql      # Full audit trail table
│   │   └── queries/               # All SQL query functions
│   │       ├── medicines.ts
│   │       ├── billing.ts
│   │       ├── customers.ts
│   │       ├── suppliers.ts
│   │       ├── reports.ts
│   │       └── audit.ts
│   │
│   ├── ai/                        # AI features engine
│   │   ├── tier1/                 # Smart Analytics (offline, no model)
│   │   │   ├── demandForecast.ts  # Demand prediction engine
│   │   │   ├── expiryRisk.ts      # Expiry risk scorer
│   │   │   ├── anomalyDetect.ts   # Sales anomaly detector
│   │   │   ├── segmentation.ts    # Customer segmenter
│   │   │   ├── abcAnalysis.ts     # ABC+XYZ classifier
│   │   │   └── morning.ts         # Morning briefing generator
│   │   ├── tier2/                 # On-device ONNX models
│   │   │   ├── drugInteraction.ts # Drug interaction checker
│   │   │   ├── fuzzySearch.ts     # Smart search engine
│   │   │   ├── billParser.ts      # Supplier CSV AI parser
│   │   │   └── prescriptionOCR.ts # Handwriting recognition
│   │   └── models/                # ONNX model files (bundled)
│   │       ├── drug_interaction.onnx
│   │       ├── bill_parser.onnx
│   │       └── README.md          # How to update models
│   │
│   ├── utils/                     # Pure utility functions
│   │   ├── gst.ts                 # GST calculation helpers
│   │   ├── barcode.ts             # Barcode format helpers
│   │   ├── date.ts                # Date formatting helpers
│   │   ├── currency.ts            # Indian currency formatting (₹)
│   │   ├── validation.ts          # Form validation rules
│   │   ├── encrypt.ts             # Encryption helpers (AES-256)
│   │   ├── export.ts              # PDF + Excel export helpers
│   │   └── keyboard.ts            # Global keyboard shortcut handler
│   │
│   ├── types/                     # TypeScript type definitions
│   │   ├── medicine.ts            # IMedicine, IBatch, ICategory
│   │   ├── billing.ts             # IBill, IBillItem, IPayment
│   │   ├── customer.ts            # ICustomer, IDoctor
│   │   ├── supplier.ts            # ISupplier, IPurchaseBill
│   │   ├── inventory.ts           # IStockAdjustment, IStocktake
│   │   ├── reports.ts             # Report input/output types
│   │   ├── user.ts                # IUser, IRole, IPermission
│   │   ├── ai.ts                  # AI result types
│   │   └── common.ts              # Shared utility types
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useBarcodeScan.ts      # Handle barcode scanner input
│   │   ├── useKeyboard.ts         # Global keyboard shortcuts
│   │   ├── usePermission.ts       # Check user permissions
│   │   ├── usePrint.ts            # Print helpers
│   │   └── useDebounce.ts         # Debounce for search inputs
│   │
│   └── styles/
│       ├── globals.css            # Global styles + Tailwind base
│       └── print.css              # Print-specific styles for bills
│
├── public/
│   ├── app-icon.png               # App window icon
│   └── splash.html                # Loading screen
│
├── scripts/
│   └── generate-icons.js          # Generate all icon sizes from source
│
├── .env.example                   # Environment variables template
├── .env                           # Your local environment (DO NOT COMMIT)
├── .gitignore                     # Files to exclude from git
├── .eslintrc.json                 # Code quality rules
├── .prettierrc                    # Code formatting rules
├── package.json                   # Node.js dependencies + scripts
├── tsconfig.json                  # TypeScript configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── vite.config.ts                 # Vite bundler configuration
└── README.md                      # This file
```

---

## 🏗️ Build Commands

| Command | What It Does |
|---------|-------------|
| `npm run tauri dev` | Start development mode (hot reload) |
| `npm run tauri build` | Build production app for your OS |
| `npm run lint` | Check code for errors |
| `npm run typecheck` | Check TypeScript types |
| `npm run test` | Run unit tests |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed demo data for testing |

---

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt with salt rounds = 12 |
| Database encryption | SQLCipher (AES-256) |
| API key storage | OS Keychain via Tauri plugin |
| Session management | JWT tokens, 8hr expiry |
| Audit logging | Every DB write logged with user + timestamp |
| Input sanitisation | Parameterized queries only, never string SQL |
| Role-based access | Permission checks in every Tauri command |
| Backup encryption | AES-256 encrypted ZIP exports |

---

## 🤖 AI Features

| Feature | Tier | Internet? | When It Runs |
|---------|------|-----------|-------------|
| Demand Forecasting | 1 — Analytics | No | Every night at 2AM |
| Expiry Risk Score | 1 — Analytics | No | Every night at 2AM |
| Anomaly Detection | 1 — Analytics | No | Real-time at billing |
| Customer Segments | 1 — Analytics | No | Every night at 2AM |
| Drug Interaction | 2 — ONNX | No | Real-time at POS |
| Smart Search | 2 — ONNX | No | Real-time at POS |
| Prescription OCR | 2/3 — Hybrid | Optional | On demand |
| Ask PharmaCare | 3 — Claude API | Yes | On demand |
| Smart Messages | 3 — Claude API | Yes | On demand |

---

## 📦 Key Dependencies

```json
Frontend:
  react, react-dom, react-router-dom
  @tauri-apps/api
  zustand
  tailwindcss
  @radix-ui/react-* (shadcn/ui base)
  recharts (charts)
  jsbarcode (barcode generation)
  jspdf (PDF export)
  xlsx (Excel import/export)
  imapflow (email IMAP)
  papaparse (CSV parsing)
  bcryptjs (password hashing)
  zod (input validation)
  date-fns (date utilities)
  react-hot-toast (notifications)
  lucide-react (icons)

Rust (Tauri):
  tauri
  rusqlite (SQLite)
  serde, serde_json
  tokio (async runtime)
  keyring (OS keychain)
  bcrypt
```

---

## 🚦 Development Workflow

1. **Pick a feature** from `TODO.md`
2. **Open the relevant page folder** (e.g., `src/pages/Billing/`)
3. **Read the comments** at the top of each file — they tell Copilot exactly what to build
4. **Use Copilot Chat** with `@workspace` to get context-aware suggestions
5. **Run `npm run tauri dev`** to test live
6. **Commit with descriptive messages**: `git commit -m "feat(billing): add split payment support"`

---

## 🆘 Getting Help

- Open an issue on GitHub with the `bug` or `feature` label
- Use the Copilot Chat command: `@workspace explain the billing service`
- Check the `docs/` folder for architecture decisions

---

*Built for Indian pharmacies. Made with ❤️ using Tauri + React + TypeScript.*
