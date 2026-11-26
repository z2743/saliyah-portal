-- Airport pre-opening schema, independent in AVIATION_DB. No ticket sales until staffed/authorized.
CREATE TABLE IF NOT EXISTS aviation_settings(
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);
INSERT OR IGNORE INTO aviation_settings(key,value) VALUES('opening_authorized','0');
CREATE TABLE IF NOT EXISTS aviation_airlines(
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 code TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('full_service','low_cost')),
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1))
);
INSERT OR IGNORE INTO aviation_airlines(id,name,code,kind) VALUES('saliyah-airlines','الخطوط الصالية','SY','full_service');
INSERT OR IGNORE INTO aviation_airlines(id,name,code,kind) VALUES('flyadeal-saliyah','فلاي أديل الصالية','FS','low_cost');
CREATE TABLE IF NOT EXISTS aviation_staff(
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('atc','airport_ops','ground','security','maintenance','pilots','cabin','planning','cargo')),
 employee_user_id TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','inactive')),
 appointed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(employee_user_id,category)
);
CREATE INDEX IF NOT EXISTS idx_aviation_staff_readiness ON aviation_staff(category,status);
CREATE TABLE IF NOT EXISTS aviation_flights(
 id TEXT PRIMARY KEY,
 airline_id TEXT NOT NULL REFERENCES aviation_airlines(id),
 number TEXT NOT NULL,
 origin_code TEXT NOT NULL,
 destination_code TEXT NOT NULL,
 departure_at TEXT NOT NULL,
 arrival_at TEXT NOT NULL,
 price_economy INTEGER NOT NULL CHECK(price_economy>=0),
 seats_economy INTEGER NOT NULL CHECK(seats_economy>=0),
 seats_business INTEGER NOT NULL DEFAULT 0 CHECK(seats_business>=0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','boarding','departed','arrived','completed','cancelled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(number,departure_at)
);
CREATE INDEX IF NOT EXISTS idx_aviation_flights_departure ON aviation_flights(status,departure_at);
CREATE TABLE IF NOT EXISTS aviation_bookings(
 id TEXT PRIMARY KEY,
 reference TEXT NOT NULL UNIQUE,
 flight_id TEXT NOT NULL REFERENCES aviation_flights(id),
 user_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled')),
 seat_class TEXT NOT NULL CHECK(seat_class IN ('economy','business')),
 price INTEGER NOT NULL CHECK(price>=0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_aviation_bookings_owner ON aviation_bookings(user_id,created_at);
CREATE TABLE IF NOT EXISTS aviation_boarding_passes(
 id TEXT PRIMARY KEY,
 booking_id TEXT NOT NULL UNIQUE REFERENCES aviation_bookings(id),
 seat TEXT NOT NULL,
 issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
