
-- Extend aviation booking records for idempotent real-person simulated payments.
ALTER TABLE aviation_bookings ADD COLUMN idempotency_key TEXT;
ALTER TABLE aviation_bookings ADD COLUMN passport_number TEXT;
ALTER TABLE aviation_bookings ADD COLUMN passenger_name TEXT;
ALTER TABLE aviation_bookings ADD COLUMN bank_account_id TEXT;
ALTER TABLE aviation_bookings ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','debited','paid','refunded'));
ALTER TABLE aviation_bookings ADD COLUMN paid_at TEXT;
ALTER TABLE aviation_bookings ADD COLUMN checked_in_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_aviation_booking_user_key ON aviation_bookings(user_id,idempotency_key);
CREATE INDEX IF NOT EXISTS idx_aviation_booking_flight_status ON aviation_bookings(flight_id,seat_class,status);
ALTER TABLE aviation_boarding_passes ADD COLUMN flight_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_aviation_seat_unique ON aviation_boarding_passes(flight_id,seat);
CREATE TABLE IF NOT EXISTS aviation_boarding_events(
 id TEXT PRIMARY KEY,
 booking_id TEXT NOT NULL UNIQUE REFERENCES aviation_bookings(id),
 flight_id TEXT NOT NULL REFERENCES aviation_flights(id),
 passport_number TEXT NOT NULL,
 border_movement_id TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 boarded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_aviation_boarding_events_flight ON aviation_boarding_events(flight_id,status);
CREATE TRIGGER IF NOT EXISTS aviation_pass_guard BEFORE INSERT ON aviation_boarding_passes
 WHEN NOT EXISTS(SELECT 1 FROM aviation_bookings b WHERE b.id=NEW.booking_id AND b.status='confirmed' AND b.payment_status='paid')
 BEGIN SELECT RAISE(ABORT,'boarding pass requires confirmed paid booking'); END;
CREATE TRIGGER IF NOT EXISTS aviation_booking_confirm_guard BEFORE UPDATE OF status ON aviation_bookings
 WHEN NEW.status='confirmed' AND OLD.status<>'confirmed' AND NEW.payment_status<>'paid'
 BEGIN SELECT RAISE(ABORT,'booking not paid'); END;
