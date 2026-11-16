import pg from 'pg'

const { Pool } = pg

// DATE (OID 1082) como texto 'YYYY-MM-DD', sin desfase de zona horaria
pg.types.setTypeParser(1082, (v) => v)

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. En Railway agrega el plugin Postgres y enlaza la variable.')
  process.exit(1)
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
})

export const q = (text, params) => pool.query(text, params)

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monthly_income NUMERIC(14,2) DEFAULT 0,
  hourly_rate NUMERIC(14,2) DEFAULT 0,
  hours_per_week NUMERIC(6,2) DEFAULT 40,
  monthly_budget NUMERIC(14,2) DEFAULT 0,
  category_budgets JSONB DEFAULT '{}'::jsonb,
  theme TEXT DEFAULT 'dark',
  setup_done BOOLEAN DEFAULT false
);
CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank TEXT DEFAULT '',
  last4 TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'credit',
  credit_limit NUMERIC(14,2) DEFAULT 0,
  initial_balance NUMERIC(14,2) DEFAULT 0,
  cut_day INT,
  pay_day INT,
  min_payment NUMERIC(14,2) DEFAULT 0,
  color TEXT DEFAULT '#3987e5',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id INT REFERENCES cards(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'otros',
  kind TEXT NOT NULL DEFAULT 'purchase',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS msi_plans (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id INT REFERENCES cards(id) ON DELETE CASCADE,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'otros',
  total NUMERIC(14,2) NOT NULL,
  months INT NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_installments INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS recurring (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id INT REFERENCES cards(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  category TEXT DEFAULT 'servicios',
  day_of_month INT NOT NULL DEFAULT 1,
  active BOOLEAN DEFAULT true,
  last_posted DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target NUMERIC(14,2) NOT NULL,
  current NUMERIC(14,2) DEFAULT 0,
  deadline DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS no_interest_payment NUMERIC(14,2) DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_msi_user ON msi_plans(user_id);
`

export async function initDb() {
  await q(SCHEMA)
  console.log('DB lista')
}
