-- =====================================================
-- Settings Table Update Migration
-- Created: 2025-11-20
-- Description: Updated settings table with invoice prefixes,
--              currency settings, and removed SMS/notification fields
-- =====================================================

-- Drop the existing settings table and recreate with new structure
DROP TABLE IF EXISTS public.settings CASCADE;

-- Create new settings table
CREATE TABLE public.settings (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,

    -- Company Information
    company_name VARCHAR(255) NULL,
    contact_detail_1 VARCHAR(100) NULL,
    contact_detail_2 VARCHAR(100) NULL,
    contact_detail_3 VARCHAR(100) NULL,
    ntn VARCHAR(100) NULL,
    str VARCHAR(100) NULL,
    email_1 VARCHAR(255) NULL,
    email_2 VARCHAR(255) NULL,
    company_address TEXT NULL,

    -- Images
    logo_url TEXT NULL,
    signature_url TEXT NULL,
    owner_picture_url TEXT NULL,
    qr_code_url TEXT NULL,

    -- Invoice Numbering Settings
    sale_order_prefix VARCHAR(20) NULL DEFAULT 'SO',
    sale_order_next_number INTEGER NULL DEFAULT 1,

    sale_invoice_prefix VARCHAR(20) NULL DEFAULT 'INV',
    sale_invoice_next_number INTEGER NULL DEFAULT 1,

    purchase_order_prefix VARCHAR(20) NULL DEFAULT 'PO',
    purchase_order_next_number INTEGER NULL DEFAULT 1,

    payment_in_prefix VARCHAR(20) NULL DEFAULT 'PI',
    payment_in_next_number INTEGER NULL DEFAULT 1,

    payment_out_prefix VARCHAR(20) NULL DEFAULT 'PO-PAY',
    payment_out_next_number INTEGER NULL DEFAULT 1,

    stock_in_prefix VARCHAR(20) NULL DEFAULT 'STK-IN',
    stock_in_next_number INTEGER NULL DEFAULT 1,

    stock_out_prefix VARCHAR(20) NULL DEFAULT 'STK-OUT',
    stock_out_next_number INTEGER NULL DEFAULT 1,

    -- Currency Settings
    -- Selected currencies with exchange rates to PKR
    -- Format: [{"code": "USD", "name": "US Dollar", "symbol": "$", "rate_to_pkr": 278.50}, ...]
    selected_currencies JSONB NULL DEFAULT '[{"code": "PKR", "name": "Pakistani Rupee", "symbol": "Rs", "rate_to_pkr": 1}]'::jsonb,
    default_currency VARCHAR(10) NULL DEFAULT 'PKR',

    -- Timestamps
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT settings_pkey PRIMARY KEY (id),
    CONSTRAINT settings_user_id_key UNIQUE (user_id),
    CONSTRAINT settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create index for faster user_id lookups
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON public.settings USING btree (user_id) TABLESPACE pg_default;

-- Create trigger for auto-updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_settings_timestamp ON settings;
CREATE TRIGGER update_settings_timestamp
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_settings_updated_at();

-- Insert sample settings for existing users (if they exist)
INSERT INTO settings (
    user_id,
    company_name,
    contact_detail_1,
    ntn,
    email_1,
    company_address,
    sale_order_prefix,
    sale_invoice_prefix,
    purchase_order_prefix,
    payment_in_prefix,
    payment_out_prefix,
    selected_currencies,
    default_currency
)
SELECT
    id,
    CASE
        WHEN id = 1 THEN 'Admin Corp'
        WHEN id = 2 THEN 'John Business'
        ELSE 'Sara Store'
    END,
    CASE
        WHEN id = 1 THEN '0300-1234567'
        WHEN id = 2 THEN '0301-2345678'
        ELSE '0302-3456789'
    END,
    CASE
        WHEN id = 1 THEN '1234567-1'
        WHEN id = 2 THEN '2345678-2'
        ELSE '3456789-3'
    END,
    email,
    CASE
        WHEN id = 1 THEN 'Head Office, Karachi'
        WHEN id = 2 THEN 'Main Branch, Lahore'
        ELSE 'Shop #5, Rawalpindi'
    END,
    'SO',
    'INV',
    'PO',
    'PI',
    'PO-PAY',
    '[{"code": "PKR", "name": "Pakistani Rupee", "symbol": "Rs", "rate_to_pkr": 1}, {"code": "USD", "name": "US Dollar", "symbol": "$", "rate_to_pkr": 278.50}, {"code": "EUR", "name": "Euro", "symbol": "€", "rate_to_pkr": 302.00}]'::jsonb,
    'PKR'
FROM users
WHERE id IN (1, 2, 3)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
