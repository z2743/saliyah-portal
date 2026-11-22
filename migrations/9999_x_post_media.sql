-- D1 storage for small X Al-Saliyah image and video attachments.
-- The application enforces a 1 MiB decoded-file limit.
CREATE TABLE IF NOT EXISTS x_post_media (
 post_id TEXT PRIMARY KEY REFERENCES x_posts(id) ON DELETE CASCADE,
 mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm')),
 data_base64 TEXT NOT NULL
);
