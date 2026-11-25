-- Bridge simulated phone numbers to normal human telecom inboxes.
CREATE TABLE IF NOT EXISTS saliyah_sim_phone_sms(
 contact_id TEXT PRIMARY KEY REFERENCES saliyah_sim_public_contacts(id) ON DELETE CASCADE,
 from_line_id TEXT NOT NULL REFERENCES telecom_lines(id),
 from_number TEXT NOT NULL,
 to_number TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sim_phone_sms_line ON saliyah_sim_phone_sms(from_line_id,created_at DESC);
