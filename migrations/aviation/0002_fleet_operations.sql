CREATE TABLE IF NOT EXISTS aviation_fleet(
 id TEXT PRIMARY KEY,
 airline_id TEXT NOT NULL REFERENCES aviation_airlines(id),
 aircraft TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('passenger','cargo')),
 fleet_size INTEGER NOT NULL CHECK(fleet_size>0),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
INSERT OR IGNORE INTO aviation_fleet(id,airline_id,aircraft,kind,fleet_size) VALUES
 ('sy-777','saliyah-airlines','B777-300','passenger',10),
 ('sy-748','saliyah-airlines','B747-8','passenger',5),
 ('sy-330','saliyah-airlines','A330-300','passenger',15),
 ('sy-320','saliyah-airlines','A320','passenger',20),
 ('sy-777f','saliyah-airlines','B777F','cargo',5),
 ('sy-748f','saliyah-airlines','B747-8F','cargo',10),
 ('fs-320','flyadeal-saliyah','A320','passenger',25);
INSERT OR IGNORE INTO aviation_settings(key,value) VALUES('operations_validated','0');
CREATE INDEX IF NOT EXISTS idx_aviation_fleet_operator ON aviation_fleet(airline_id,kind);
CREATE TRIGGER IF NOT EXISTS aviation_flight_time_guard BEFORE INSERT ON aviation_flights
 WHEN NEW.departure_at>=NEW.arrival_at
 BEGIN SELECT RAISE(ABORT,'arrival must be after departure'); END;
