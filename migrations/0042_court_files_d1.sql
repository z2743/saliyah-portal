-- Store small private court files in D1, linked to existing court attachments.
CREATE TABLE IF NOT EXISTS court_attachment_data (
 attachment_id TEXT PRIMARY KEY REFERENCES court_attachments(id) ON DELETE CASCADE,
 content_base64 TEXT NOT NULL CHECK(length(content_base64) BETWEEN 4 AND 174764)
);
