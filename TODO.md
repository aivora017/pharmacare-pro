# PharmaCare Pro — Build Checklist
# Use Copilot: "@workspace implement the next unchecked item"

## PHASE 1 — Foundation
- [ ] npm install + verify tauri dev starts
- [ ] Create app icons (src-tauri/icons/ — 32x32, 128x128, 128x128@2x, .icns, .ico)
- [ ] Implement Database::init (db.rs) — SQLite + SQLCipher + WAL + migrations
- [ ] Implement settings_get and settings_set commands
- [ ] Implement auth_login — bcrypt verify + JWT + OS keychain
- [ ] Implement auth_restore_session
- [ ] Test login/logout flow in the app

## PHASE 2 — Medicine Master
- [ ] Implement medicine_search (LIKE on name + generic_name)
- [ ] Implement medicine_get + medicine_list_batches
- [ ] Implement medicine_create + medicine_create_batch
- [ ] Medicine list page with search, filters, stock badges
- [ ] Add/Edit Medicine form
- [ ] Add Batch form with barcode auto-generate

## PHASE 3 — Billing / POS
- [ ] MedicineSearchDropdown component
- [ ] Barcode scan detection (fast chars = scanner input)
- [ ] Implement billing_create_bill as SQLite transaction
- [ ] PaymentPanel component (Cash/UPI/Card/Credit/Split)
- [ ] Cash change calculator
- [ ] Hold bill (F4) + recall (F5)
- [ ] Customer selector modal
- [ ] Drug interaction warning banner
- [ ] Print thermal receipt (ESC/POS)

## PHASE 4 — Purchase & Email Import
- [ ] Implement purchase_create_bill
- [ ] Implement purchase_create_supplier
- [ ] Supplier add/edit form
- [ ] Manual purchase bill entry
- [ ] IMAP config in Settings (store in OS keychain)
- [ ] Email fetch + CSV/Excel parser
- [ ] Column mapper UI (first import from new supplier)
- [ ] Import review screen

## PHASE 5 — Customers & Doctors
- [ ] Customer list with phone search
- [ ] Add/Edit customer form
- [ ] Customer detail with purchase history
- [ ] Outstanding balance tracking
- [ ] Doctor list + add/edit form

## PHASE 6 — Expiry & Barcodes
- [ ] Expiry dashboard with AI risk scores
- [ ] Barcode scan → show batch card
- [ ] Bulk expiry return list PDF
- [ ] Barcode generator + bulk generate
- [ ] ZPL label printing for Zebra printer

## PHASE 7 — Reports
- [ ] Sales report with date filter
- [ ] Purchase report
- [ ] Stock valuation
- [ ] GST report (GSTR-1 format)
- [ ] P&L report
- [ ] CA Package ZIP generation
- [ ] PDF + Excel export for all reports

## PHASE 8 — AI Features
- [ ] Morning briefing on dashboard
- [ ] Demand forecast table
- [ ] Customer segments (RFM scoring)
- [ ] Anomaly detection
- [ ] Ask PharmaCare chat UI (Claude API)
- [ ] WhatsApp message composer (Claude API)

## PHASE 9 — Polish & Distribution
- [ ] License key activation screen
- [ ] 30-day trial countdown
- [ ] Auto-update (Tauri updater plugin)
- [ ] Auto-backup (daily encrypted)
- [ ] Performance audit (POS < 100ms response)
- [ ] Build Windows .exe
- [ ] Build macOS .dmg
- [ ] Build Linux .AppImage
- [ ] Create GitHub release with all three installers
