-- =============================================
-- PURCHASE ORDERS & CURRENCIES DATABASE SCHEMA
-- =============================================

-- =============================================
-- SETTINGS TABLE - Currency Configuration
-- =============================================
-- Currencies are stored as JSON in the settings table:
-- - selected_currencies: JSON array of currency objects
-- - default_currency: The default currency code
--
-- To add/update these columns on existing settings table:

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS selected_currencies jsonb
DEFAULT '[{"code": "PKR", "symbol": "Rs", "name": "Pakistani Rupee", "rate_to_pkr": 1}]';

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS default_currency character varying(10)
DEFAULT 'PKR';

-- Set default currencies for users who don't have any configured:
UPDATE public.settings
SET selected_currencies = '[{"code": "PKR", "symbol": "Rs", "name": "Pakistani Rupee", "rate_to_pkr": 1}]',
    default_currency = 'PKR'
WHERE selected_currencies IS NULL OR default_currency IS NULL;


-- =============================================
-- CURRENCIES TABLE (Public Master List)
-- =============================================
-- Master list of all worldwide currencies for all users
-- Users select from this list and customize rates in their settings

CREATE TABLE IF NOT EXISTS public.currencies (
  id serial not null,
  code character varying(10) not null,
  name character varying(100) not null,
  symbol character varying(10) not null,
  is_active boolean null default true,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint currencies_pkey primary key (id),
  constraint currencies_code_key unique (code)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_currencies_code ON public.currencies USING btree (code) TABLESPACE pg_default;

-- Add unique constraint if it doesn't exist (needed for ON CONFLICT)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'currencies_code_key'
    ) THEN
        ALTER TABLE public.currencies ADD CONSTRAINT currencies_code_key UNIQUE (code);
    END IF;
END $$;

-- Insert worldwide currencies (public list for all users)
INSERT INTO public.currencies (code, name, symbol) VALUES
-- Major Currencies
('PKR', 'Pakistani Rupee', 'Rs'),
('USD', 'US Dollar', '$'),
('EUR', 'Euro', '€'),
('GBP', 'British Pound', '£'),
('JPY', 'Japanese Yen', '¥'),
('CNY', 'Chinese Yuan', '¥'),
('INR', 'Indian Rupee', '₹'),
('AUD', 'Australian Dollar', 'A$'),
('CAD', 'Canadian Dollar', 'C$'),
('CHF', 'Swiss Franc', 'CHF'),
-- Middle East
('AED', 'UAE Dirham', 'د.إ'),
('SAR', 'Saudi Riyal', 'ر.س'),
('QAR', 'Qatari Riyal', 'ر.ق'),
('KWD', 'Kuwaiti Dinar', 'د.ك'),
('BHD', 'Bahraini Dinar', '.د.ب'),
('OMR', 'Omani Rial', 'ر.ع.'),
-- Asia
('SGD', 'Singapore Dollar', 'S$'),
('MYR', 'Malaysian Ringgit', 'RM'),
('THB', 'Thai Baht', '฿'),
('IDR', 'Indonesian Rupiah', 'Rp'),
('PHP', 'Philippine Peso', '₱'),
('VND', 'Vietnamese Dong', '₫'),
('KRW', 'South Korean Won', '₩'),
('BDT', 'Bangladeshi Taka', '৳'),
('LKR', 'Sri Lankan Rupee', 'Rs'),
('NPR', 'Nepalese Rupee', 'रू'),
-- Europe
('SEK', 'Swedish Krona', 'kr'),
('NOK', 'Norwegian Krone', 'kr'),
('DKK', 'Danish Krone', 'kr'),
('PLN', 'Polish Zloty', 'zł'),
('CZK', 'Czech Koruna', 'Kč'),
('HUF', 'Hungarian Forint', 'Ft'),
('RUB', 'Russian Ruble', '₽'),
('TRY', 'Turkish Lira', '₺'),
-- Americas
('MXN', 'Mexican Peso', '$'),
('BRL', 'Brazilian Real', 'R$'),
('ARS', 'Argentine Peso', '$'),
('CLP', 'Chilean Peso', '$'),
('COP', 'Colombian Peso', '$'),
-- Africa
('ZAR', 'South African Rand', 'R'),
('EGP', 'Egyptian Pound', 'E£'),
('NGN', 'Nigerian Naira', '₦'),
('KES', 'Kenyan Shilling', 'KSh'),
-- Others
('NZD', 'New Zealand Dollar', 'NZ$'),
('HKD', 'Hong Kong Dollar', 'HK$'),
('TWD', 'Taiwan Dollar', 'NT$'),
('ILS', 'Israeli Shekel', '₪'),
('AFN', 'Afghan Afghani', '؋'),
('IRR', 'Iranian Rial', '﷼')
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- USER CURRENCIES TABLE (Per User Selected)
-- =============================================
-- User's selected currencies with custom exchange rates
-- Copied from public currencies table when user adds them

CREATE TABLE IF NOT EXISTS public.user_currencies (
  id serial not null,
  user_id integer not null,
  code character varying(10) not null,
  name character varying(100) not null,
  symbol character varying(10) not null,
  rate_to_pkr numeric(15, 6) not null default 1,
  is_default boolean null default false,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint user_currencies_pkey primary key (id),
  constraint user_currencies_user_code_key unique (user_id, code),
  constraint user_currencies_user_id_fkey foreign key (user_id) references users (id) on delete cascade
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_user_currencies_user_id ON public.user_currencies USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_user_currencies_code ON public.user_currencies USING btree (code) TABLESPACE pg_default;

-- Add user_id column if table already exists
ALTER TABLE public.user_currencies ADD COLUMN IF NOT EXISTS user_id integer;
ALTER TABLE public.user_currencies ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Insert default PKR for existing users who don't have any currencies
-- Run this after creating the table:
-- INSERT INTO public.user_currencies (user_id, code, name, symbol, rate_to_pkr, is_default)
-- SELECT id, 'PKR', 'Pakistani Rupee', 'Rs', 1, true FROM users
-- WHERE id NOT IN (SELECT DISTINCT user_id FROM user_currencies WHERE user_id IS NOT NULL)
-- ON CONFLICT (user_id, code) DO NOTHING;


-- =============================================
-- PURCHASE ORDERS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id serial not null,
  user_id integer not null,
  po_no character varying(100) not null,
  supplier_id integer null,
  po_date date not null default CURRENT_DATE,
  receiving_date date null,
  currency_code character varying(10) null default 'PKR',
  subtotal numeric(15, 2) null default 0,
  is_gst boolean null default true,
  gst_percentage numeric(5, 2) null default 0,
  gst_amount numeric(15, 2) null default 0,
  total_amount numeric(15, 2) null default 0,
  previous_balance numeric(15, 2) null default 0,
  final_payable numeric(15, 2) null default 0,
  status character varying(50) null default 'pending'::character varying,
  notes text null,
  created_by integer null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint purchase_orders_pkey primary key (id),
  constraint purchase_orders_user_id_po_no_key unique (user_id, po_no),
  constraint purchase_orders_created_by_fkey foreign KEY (created_by) references users (id) on delete set null,
  constraint purchase_orders_supplier_id_fkey foreign KEY (supplier_id) references suppliers (id) on delete set null,
  constraint purchase_orders_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

-- Add new columns to existing purchase_orders table (if it already exists):
-- These must run BEFORE creating indexes on these columns
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS currency_code character varying(10) DEFAULT 'PKR';
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS receiving_date date NULL;

-- Create indexes (after columns exist)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id ON public.purchase_orders USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_purchase_po_no ON public.purchase_orders USING btree (po_no) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_purchase_supplier ON public.purchase_orders USING btree (supplier_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_purchase_currency ON public.purchase_orders USING btree (currency_code) TABLESPACE pg_default;


-- =============================================
-- PURCHASE ORDER ITEMS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id serial not null,
  user_id integer not null,
  po_id integer null,
  product_id integer null,
  product_name character varying(255) null,
  quantity numeric(15, 2) not null,
  received_quantity numeric(15, 2) null default 0,
  unit_price numeric(15, 2) not null,
  total_price numeric(15, 2) not null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint purchase_order_items_pkey primary key (id),
  constraint purchase_order_items_po_id_fkey foreign KEY (po_id) references purchase_orders (id) on delete CASCADE,
  constraint purchase_order_items_product_id_fkey foreign KEY (product_id) references products (id) on delete set null,
  constraint purchase_order_items_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_user_id ON public.purchase_order_items USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON public.purchase_order_items USING btree (po_id) TABLESPACE pg_default;


-- =============================================
-- PRODUCTS TABLE - Ensure is_active is set
-- =============================================
-- If products are not showing in dropdown, run this:

UPDATE public.products SET is_active = true WHERE is_active IS NULL;


-- =============================================
-- TRIGGER FOR UPDATED_AT (if not exists)
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to purchase_orders if not exists
DROP TRIGGER IF EXISTS update_purchase_updated_at ON purchase_orders;
CREATE TRIGGER update_purchase_updated_at
BEFORE UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
