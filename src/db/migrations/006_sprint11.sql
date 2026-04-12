-- Sprint 11: P&L report, audit log, reorder alerts, prescription history, SMS
INSERT OR IGNORE INTO settings(key,value) VALUES
  ('sms_provider','"fast2sms"'),
  ('sms_api_key','""'),
  ('sms_sender_id','"PHARMA"'),
  ('sms_enabled','"false"');
