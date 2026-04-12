-- Sprint 10: GST-aware onboarding + business profile
INSERT OR IGNORE INTO settings(key,value) VALUES
  ('onboarding_complete','"false"'),
  ('gst_enabled','"false"'),
  ('legal_name','""'),
  ('trade_name','""'),
  ('state_code','""'),
  ('state_name','""'),
  ('reg_type','"Unregistered"'),
  ('pin_code','""');
