-- Sprint 12: E-Invoice IRN + E-Way Bill live storage

CREATE TABLE IF NOT EXISTS bill_gst_compliance (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id         INTEGER NOT NULL UNIQUE,
    irn             TEXT,
    ack_no          TEXT,
    ack_date        TEXT,
    qr_code         TEXT,
    signed_invoice  TEXT,
    ewb_no          TEXT,
    ewb_date        TEXT,
    ewb_valid_until TEXT,
    generated_at    TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (bill_id) REFERENCES bills(id)
);
