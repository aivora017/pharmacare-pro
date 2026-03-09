# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

### Added

- GitHub issue forms for bugs, features, and work items.
- PR template, CODEOWNERS, labels automation workflow.
- Contributing, security, and live project execution documentation.
- Customer and doctor backend commands for get/update/history and doctor CRUD.
- Functional Doctors and Customers pages with search, create, edit, and detail/history views.
- Supplier backend commands and Suppliers page with list, create, and update flows.
- Manual purchase bill backend commands (create/get/list) with supplier outstanding update and audit logging.
- Functional Purchase page with supplier/payment filters and bill entry form.
- Customer credit payment command and UI action to reduce outstanding balances with audit logging.
- Purchase order creation command and Purchase tab support for creating draft POs.
- Expanded customer profile editing to include allergies, chronic conditions, and med-sync day.
- Email import commands now avoid runtime todo panics and support test/list flows.
- Settings page now includes IMAP email configuration and import log viewer.
- Background email polling task now runs every 20 minutes and triggers invoice fetch.
- Purchase page now includes CSV and Excel invoice parsing with first-time column mapping.
- Email import review now supports row-level editing before creating purchase bills.
- Auto-match for imported lines now maps medicines against the medicine master.
- Purchase return/debit note creation is now available in backend and Purchase UI.
- POS billing now supports loyalty point redemption with customer point-balance updates.
- POS billing now supports prescription image/PDF attachment capture on bill save.
- POS customer selection now carries allergy/chronic data and shows safety warnings on potential medicine matches.
- Inventory commands (`inventory_get_stock`, `inventory_get_low_stock`, `inventory_get_expiry_list`, `inventory_adjust_stock`) are now implemented with database logic and audit logging.
- Expiry page now includes a working expiry dashboard with risk summary cards and a colour-coded expiry table.
- Expiry page now supports barcode scan lookup to show batch details and add scanned items to a return-list export.
