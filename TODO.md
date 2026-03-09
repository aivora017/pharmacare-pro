# PharmaCare Pro — Development TODO

# ===================================

# This file tracks what needs to be built.

# Use GitHub Copilot Chat with: "@workspace what should I build next?"

# Mark items as done: change [ ] to [x]

# ===================================

## PHASE 1 — Foundation (Weeks 1–4)

### Project Setup

- [x] Create project structure and all config files
- [ ] Run `npm install` and `npm run tauri dev` to verify it starts
- [ ] Create app icon (use any pharmacy/pill image, 1024x1024 PNG)

### Database

- [ ] Test database migration runs on first startup (check for 001_initial.sql running)
- [ ] Verify all 15+ tables are created correctly
- [ ] Add seed data: 5 demo medicines, 1 demo supplier, 1 admin user

### Authentication

- [x] Implement `auth_login` Rust command (see src-tauri/src/commands/auth.rs)
- [x] Build Login page UI (src/pages/Auth/index.tsx)
- [ ] Test: login with wrong password → shows friendly error
- [ ] Test: login with correct password → goes to dashboard
- [ ] Test: session persists after closing and reopening the app
- [x] Build: Change password screen in Settings

### Layout & Navigation

- [x] Verify Sidebar renders correctly (src/components/layout/Sidebar.tsx)
- [x] Build Header component with search bar and user menu
- [x] Test keyboard shortcuts: F2 opens billing, Escape closes modals

## PHASE 2 — Medicine Master (Weeks 2–3)

- [x] Medicine list page (search, filter by category, sort by name)
- [x] Add medicine form (all fields from IMedicine type)
- [x] Edit medicine form
- [x] Add batch to medicine (all fields from IBatch type)
- [x] Barcode auto-generation when batch is saved
- [x] Rack location field with format validation (A-1-1 format)
- [x] Low stock indicator (red badge when quantity < reorder_level)
- [x] Expiry indicator (colour-coded badge by days until expiry)
- [ ] Medicine detail page: show all batches, stock levels, alternates

## PHASE 3 — Billing / POS (Weeks 4–6)

- [x] Medicine search in POS (src/pages/Billing/index.tsx)
- [x] Barcode scan support (USB scanner wedge input)
- [ ] Barcode scan support (camera)
- [x] Add item to cart with FEFO batch selection
- [x] Update quantity with +/- buttons and direct typing
- [x] Item-level discount (%)
- [x] Bill-level discount (₹ flat or %)
- [x] GST calculation (CGST + SGST for intrastate)
- [x] Payment panel: Cash, UPI, Card, Credit modes
- [x] Cash denomination calculator (enter amount → show change)
- [x] Split payment (two modes on same bill)
- [x] Save bill (billingService.createBill)
- [ ] Print thermal bill (80mm ESC/POS)
- [ ] Print A4 bill (OS print dialog)
- [x] Hold bill (F4) and recall held bills (F5)
- [x] Link customer to bill (customer search popup)
- [x] Drug interaction check (basic version — rule-based)
- [x] Near-expiry warning on bill items (< 30 days)

## PHASE 4 — Purchase & Suppliers (Weeks 7–9)

- [x] Supplier list + add/edit form
- [x] Manual purchase bill entry (all fields from IPurchaseBill)
- [ ] Email IMAP configuration (Settings → Email)
- [ ] Email polling service (background, every 20 mins)
- [ ] CSV/Excel parser for distributor bills
- [ ] Column mapping UI for first-time import from new distributor
- [ ] Import review screen (show parsed data, edit before saving)
- [ ] Auto-match imported items to medicine master
- [ ] Import log (show all past imports with status)
- [ ] Purchase return / debit note

## PHASE 5 — Customers & Doctors (Weeks 10–11)

- [x] Customer list with search (by name, phone)
- [ ] Add/edit customer form (all fields from ICustomer)
- [x] Customer detail page: purchase history timeline
- [ ] Outstanding balance display and credit payment
- [ ] Loyalty points display and redemption at POS
- [x] Doctor list + add/edit form
- [ ] Prescription upload (image/PDF attachment to bill)
- [ ] Allergy/condition recording and warnings at POS

## PHASE 6 — Expiry & Barcodes (Weeks 12–13)

- [ ] Expiry dashboard (list all batches by expiry, colour-coded)
- [ ] Barcode scan in Expiry mode → show full batch details
- [ ] Build expiry return list (scan multiple → create return note)
- [ ] Barcode generator (bulk generate for selected batches)
- [ ] Label template designer (size, fields to print)
- [ ] Print to barcode printer (Zebra ZPL commands)
- [ ] Print queue management

## PHASE 7 — Reports (Weeks 14–16)

- [ ] Sales report (date range filter, export PDF + Excel)
- [ ] Purchase report (supplier-wise, date range)
- [ ] Stock valuation report
- [ ] Expiry / write-off report
- [ ] GST report (GSTR-1 format, GSTR-3B summary)
- [ ] P&L report (revenue, COGS, gross profit)
- [ ] CA Package: one-click generate all reports as ZIP
- [ ] Customer outstanding report (ageing analysis)
- [ ] Supplier outstanding report

## PHASE 8 — AI Features (Weeks 17–19)

### Tier 1 (No model needed)

- [ ] Morning briefing card on dashboard
- [ ] Demand forecast (nightly SQL calculation)
- [ ] Expiry risk scoring (score each batch)
- [ ] Customer segmentation (champion/at-risk/dormant)
- [ ] Sales anomaly detection (high discounts, negative stock)

### Tier 2 (ONNX models)

- [ ] Smart fuzzy search (better medicine name matching)
- [ ] Drug interaction checker (local database + AI scoring)
- [ ] Smart billing assistant (upsell suggestions panel)

### Tier 3 (Claude API — optional)

- [ ] Ask PharmaCare natural language assistant
- [ ] Smart message composer (WhatsApp/SMS templates)
- [ ] AI CA report summary

## PHASE 9 — Polish & Distribution (Weeks 20–22)

- [ ] License key activation screen
- [ ] 30-day trial countdown
- [ ] Auto-update mechanism (Tauri updater)
- [ ] Backup scheduler (daily auto-backup)
- [ ] Restore from backup UI
- [ ] Performance testing (POS response time < 100ms)
- [ ] Build Windows .exe installer
- [ ] Build macOS .dmg
- [ ] Build Linux .AppImage
- [ ] Write user manual (one page per module, screenshots)

## PHASE 10 — Mobile API (Future)

- [ ] Embed Fastify REST API server (localhost:4200)
- [ ] JWT auth for API endpoints
- [ ] Customer-facing endpoints (check stock, place order)
- [ ] Owner dashboard API (live sales, alerts)
- [ ] API documentation (Swagger/OpenAPI)

---

## Quick Copilot Commands to Use

Open Copilot Chat and try:

- `@workspace explain the billing service`
- `@workspace how does the email import work?`
- `@workspace implement the medicine search query in billingService.ts`
- `@workspace write tests for the GST calculation utility`
- `@workspace what's left to do in Phase 3?`
