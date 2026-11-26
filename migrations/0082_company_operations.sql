-- Operating companies: inventory, orders, bot employment and public vacancies.
CREATE TABLE IF NOT EXISTS company_catalog(
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES commerce_companies(id),
 branch_id TEXT REFERENCES commerce_branches(id),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 160),
 description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 5 AND 2500),
 kind TEXT NOT NULL CHECK(kind IN ('product','service')),
 price INTEGER NOT NULL CHECK(price BETWEEN 1 AND 1000000),
 stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0),
 image_url TEXT CHECK(image_url IS NULL OR length(image_url)<=110000),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS company_catalog_company ON company_catalog(company_id,active,created_at);
CREATE TABLE IF NOT EXISTS company_catalog_orders(
 id TEXT PRIMARY KEY,
 catalog_id TEXT NOT NULL REFERENCES company_catalog(id),
 buyer_id TEXT NOT NULL REFERENCES users(id),
 bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 50),
 unit_price INTEGER NOT NULL CHECK(unit_price BETWEEN 1 AND 1000000),
 total INTEGER NOT NULL CHECK(total=unit_price*quantity AND total>0),
 status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid','fulfilled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 fulfilled_at TEXT
);
CREATE INDEX IF NOT EXISTS company_catalog_orders_buyer ON company_catalog_orders(buyer_id,created_at);
CREATE INDEX IF NOT EXISTS company_catalog_orders_item ON company_catalog_orders(catalog_id,created_at);
CREATE TRIGGER IF NOT EXISTS company_catalog_order_guard BEFORE INSERT ON company_catalog_orders BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM company_catalog p JOIN commerce_companies c ON c.id=p.company_id
  JOIN company_treasuries t ON t.company_id=c.id
  JOIN bank_accounts b ON b.id=NEW.bank_account_id
  WHERE p.id=NEW.catalog_id AND p.active=1 AND c.status='approved'
    AND (p.branch_id IS NULL OR EXISTS(SELECT 1 FROM commerce_branches br WHERE br.id=p.branch_id AND br.company_id=p.company_id AND br.status='approved'))
    AND p.price=NEW.unit_price AND (p.kind='service' OR p.stock>=NEW.quantity)
    AND b.user_id=NEW.buyer_id AND b.balance>=NEW.total
 ) THEN RAISE(ABORT,'Invalid order or insufficient balance') END;
END;
CREATE TRIGGER IF NOT EXISTS company_catalog_order_apply AFTER INSERT ON company_catalog_orders BEGIN
 UPDATE bank_accounts SET balance=balance-NEW.total WHERE id=NEW.bank_account_id;
 UPDATE company_treasuries SET balance=balance+NEW.total
 WHERE company_id=(SELECT company_id FROM company_catalog WHERE id=NEW.catalog_id);
 UPDATE company_catalog SET stock=stock-NEW.quantity,updated_at=CURRENT_TIMESTAMP
 WHERE id=NEW.catalog_id AND kind='product';
END;
CREATE TABLE IF NOT EXISTS company_bot_hires(
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES commerce_companies(id),
 bot_id TEXT NOT NULL REFERENCES saliyah_sim_citizens(id),
 position TEXT NOT NULL CHECK(length(trim(position)) BETWEEN 3 AND 120),
 weekly_salary INTEGER NOT NULL CHECK(weekly_salary BETWEEN 1 AND 1000000),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended')),
 hired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ended_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS company_bot_active_job ON company_bot_hires(bot_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS company_bot_company ON company_bot_hires(company_id,status);
CREATE TABLE IF NOT EXISTS company_vacancies(
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES commerce_companies(id),
 branch_id TEXT REFERENCES commerce_branches(id),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 120),
 description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 10 AND 2000),
 weekly_salary INTEGER NOT NULL CHECK(weekly_salary BETWEEN 1 AND 1000000),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS company_vacancies_company ON company_vacancies(company_id,status);
CREATE TABLE IF NOT EXISTS company_vacancy_applications(
 id TEXT PRIMARY KEY,
 vacancy_id TEXT NOT NULL REFERENCES company_vacancies(id),
 applicant_id TEXT NOT NULL REFERENCES users(id),
 statement TEXT NOT NULL CHECK(length(trim(statement)) BETWEEN 10 AND 2000),
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewing','accepted','rejected','withdrawn')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT,
 UNIQUE(vacancy_id,applicant_id)
);
CREATE INDEX IF NOT EXISTS company_vacancy_applicant ON company_vacancy_applications(applicant_id,created_at);
