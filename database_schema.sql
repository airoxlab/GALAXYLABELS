-- =====================================================
-- SaaS Multi-Tenant ERP Database Schema
-- Created: 2025-11-20
-- Description: Complete database with user_id for multi-tenancy
--              and product_history for tracking all product changes
-- =====================================================

-- =====================================================
-- DROP ALL EXISTING TABLES (in correct order due to foreign keys)
-- =====================================================

DROP TABLE IF EXISTS public.user_permissions CASCADE;
DROP TABLE IF EXISTS public.receiving_records CASCADE;
DROP TABLE IF EXISTS public.purchase_order_items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.sales_invoice_items CASCADE;
DROP TABLE IF EXISTS public.sales_invoices CASCADE;
DROP TABLE IF EXISTS public.sale_order_items CASCADE;
DROP TABLE IF EXISTS public.sale_orders CASCADE;
DROP TABLE IF EXISTS public.stock_in CASCADE;
DROP TABLE IF EXISTS public.stock_out CASCADE;
DROP TABLE IF EXISTS public.customer_ledger CASCADE;
DROP TABLE IF EXISTS public.supplier_ledger CASCADE;
DROP TABLE IF EXISTS public.payments_in CASCADE;
DROP TABLE IF EXISTS public.payments_out CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.expense_categories CASCADE;
DROP TABLE IF EXISTS public.product_history CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.units CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;
DROP TABLE IF EXISTS public.company_settings CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- =====================================================
-- DROP AND RECREATE FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_settings_updated_at() CASCADE;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function for settings updated_at
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- CREATE TABLES
-- =====================================================

-- Users table (base table for multi-tenancy)
CREATE TABLE public.users (
    id SERIAL NOT NULL,
    username VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(50) NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_username_key UNIQUE (username),
    CONSTRAINT users_email_key UNIQUE (email)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users USING btree (username) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email) TABLESPACE pg_default;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Units table
CREATE TABLE public.units (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT units_pkey PRIMARY KEY (id),
    CONSTRAINT units_user_id_name_key UNIQUE (user_id, name),
    CONSTRAINT units_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_units_user_id ON public.units USING btree (user_id) TABLESPACE pg_default;

-- Categories table
CREATE TABLE public.categories (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT categories_pkey PRIMARY KEY (id),
    CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name),
    CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories USING btree (user_id) TABLESPACE pg_default;

-- Expense Categories table
CREATE TABLE public.expense_categories (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT expense_categories_pkey PRIMARY KEY (id),
    CONSTRAINT expense_categories_user_id_name_key UNIQUE (user_id, name),
    CONSTRAINT expense_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_expense_categories_user_id ON public.expense_categories USING btree (user_id) TABLESPACE pg_default;

-- Warehouses table
CREATE TABLE public.warehouses (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    location TEXT NULL,
    is_active BOOLEAN NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT warehouses_pkey PRIMARY KEY (id),
    CONSTRAINT warehouses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_warehouses_user_id ON public.warehouses USING btree (user_id) TABLESPACE pg_default;

-- Customers table
CREATE TABLE public.customers (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NULL,
    mobile_no VARCHAR(50) NULL,
    whatsapp_no VARCHAR(50) NULL,
    email VARCHAR(255) NULL,
    address TEXT NULL,
    ntn VARCHAR(100) NULL,
    str VARCHAR(100) NULL,
    opening_balance NUMERIC(15, 2) NULL DEFAULT 0,
    current_balance NUMERIC(15, 2) NULL DEFAULT 0,
    notes TEXT NULL,
    last_order_date DATE NULL,
    is_active BOOLEAN NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customers_pkey PRIMARY KEY (id),
    CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers USING btree (customer_name) TABLESPACE pg_default;

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Suppliers table
CREATE TABLE public.suppliers (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NULL,
    mobile_no VARCHAR(50) NULL,
    whatsapp_no VARCHAR(50) NULL,
    email VARCHAR(255) NULL,
    address TEXT NULL,
    ntn VARCHAR(100) NULL,
    str VARCHAR(100) NULL,
    opening_balance NUMERIC(15, 2) NULL DEFAULT 0,
    current_balance NUMERIC(15, 2) NULL DEFAULT 0,
    notes TEXT NULL,
    last_purchase_date DATE NULL,
    is_active BOOLEAN NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT suppliers_pkey PRIMARY KEY (id),
    CONSTRAINT suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers USING btree (supplier_name) TABLESPACE pg_default;

CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Products table
CREATE TABLE public.products (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    category_id INTEGER NULL,
    unit_id INTEGER NULL,
    size_width NUMERIC(10, 2) NULL,
    size_length NUMERIC(10, 2) NULL,
    color VARCHAR(100) NULL,
    weight NUMERIC(10, 2) NULL,
    photo_url TEXT NULL,
    unit_price NUMERIC(15, 2) NULL DEFAULT 0,
    current_stock NUMERIC(15, 2) NULL DEFAULT 0,
    notes TEXT NULL,
    is_active BOOLEAN NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT products_pkey PRIMARY KEY (id),
    CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT products_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES units (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products USING btree (name) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products USING btree (category_id) TABLESPACE pg_default;

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Product History table (for tracking all product changes)
CREATE TABLE public.product_history (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'add', 'edit', 'sell', 'purchase', 'stock_in', 'stock_out', 'delete'
    reference_type VARCHAR(50) NULL, -- 'sale_order', 'sales_invoice', 'purchase_order', 'stock_in', 'stock_out', 'manual'
    reference_id INTEGER NULL, -- ID of the related document
    reference_no VARCHAR(100) NULL, -- Document number for easy reference

    -- Quantity changes
    quantity_change NUMERIC(15, 2) NULL DEFAULT 0, -- Positive for increase, negative for decrease
    old_stock NUMERIC(15, 2) NULL DEFAULT 0,
    new_stock NUMERIC(15, 2) NULL DEFAULT 0,

    -- Price changes (for edit tracking)
    old_unit_price NUMERIC(15, 2) NULL,
    new_unit_price NUMERIC(15, 2) NULL,

    -- Transaction details
    unit_price NUMERIC(15, 2) NULL DEFAULT 0, -- Price at transaction time
    total_amount NUMERIC(15, 2) NULL DEFAULT 0,

    -- Related parties
    customer_id INTEGER NULL,
    supplier_id INTEGER NULL,
    warehouse_id INTEGER NULL,

    -- Additional info
    notes TEXT NULL,
    changed_fields JSONB NULL, -- For edit action, stores what fields were changed

    created_by INTEGER NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT product_history_pkey PRIMARY KEY (id),
    CONSTRAINT product_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT product_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT product_history_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
    CONSTRAINT product_history_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL,
    CONSTRAINT product_history_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL,
    CONSTRAINT product_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_product_history_user_id ON public.product_history USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_product_history_product_id ON public.product_history USING btree (product_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_product_history_action_type ON public.product_history USING btree (action_type) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_product_history_created_at ON public.product_history USING btree (created_at DESC) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_product_history_reference ON public.product_history USING btree (reference_type, reference_id) TABLESPACE pg_default;

-- Company Settings table
CREATE TABLE public.company_settings (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    company_name VARCHAR(255) NULL,
    address TEXT NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(50) NULL,
    logo_url TEXT NULL,
    signature_url TEXT NULL,
    reminder_enabled BOOLEAN NULL DEFAULT false,
    reminder_mode VARCHAR(50) NULL DEFAULT 'daily',
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT company_settings_pkey PRIMARY KEY (id),
    CONSTRAINT company_settings_user_id_key UNIQUE (user_id),
    CONSTRAINT company_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Settings table
CREATE TABLE public.settings (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    company_name VARCHAR(255) NULL,
    contact_detail_1 VARCHAR(100) NULL,
    contact_detail_2 VARCHAR(100) NULL,
    contact_detail_3 VARCHAR(100) NULL,
    ntn VARCHAR(100) NULL,
    str VARCHAR(100) NULL,
    email_1 VARCHAR(255) NULL,
    email_2 VARCHAR(255) NULL,
    company_address TEXT NULL,
    logo_url TEXT NULL,
    signature_url TEXT NULL,
    owner_picture_url TEXT NULL,
    payment_reminder JSONB NULL DEFAULT '{"once_a_day": false, "once_a_week": false, "once_a_month": false, "once_credit_limit_up": false}'::jsonb,
    notification_method JSONB NULL DEFAULT '{"sms": false, "email": false, "whatsapp": false}'::jsonb,
    send_sms_on_transaction BOOLEAN NULL DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT settings_pkey PRIMARY KEY (id),
    CONSTRAINT settings_user_id_key UNIQUE (user_id),
    CONSTRAINT settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE TRIGGER update_settings_timestamp
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_settings_updated_at();

-- Customer Ledger table
CREATE TABLE public.customer_ledger (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    customer_id INTEGER NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type VARCHAR(50) NOT NULL,
    reference_id INTEGER NULL,
    reference_no VARCHAR(100) NULL,
    debit NUMERIC(15, 2) NULL DEFAULT 0,
    credit NUMERIC(15, 2) NULL DEFAULT 0,
    balance NUMERIC(15, 2) NULL DEFAULT 0,
    description TEXT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_ledger_pkey PRIMARY KEY (id),
    CONSTRAINT customer_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT customer_ledger_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_customer_ledger_user_id ON public.customer_ledger USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_id ON public.customer_ledger USING btree (customer_id) TABLESPACE pg_default;

-- Supplier Ledger table
CREATE TABLE public.supplier_ledger (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    supplier_id INTEGER NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type VARCHAR(50) NOT NULL,
    reference_id INTEGER NULL,
    reference_no VARCHAR(100) NULL,
    debit NUMERIC(15, 2) NULL DEFAULT 0,
    credit NUMERIC(15, 2) NULL DEFAULT 0,
    balance NUMERIC(15, 2) NULL DEFAULT 0,
    description TEXT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT supplier_ledger_pkey PRIMARY KEY (id),
    CONSTRAINT supplier_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT supplier_ledger_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_supplier_ledger_user_id ON public.supplier_ledger USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier_id ON public.supplier_ledger USING btree (supplier_id) TABLESPACE pg_default;

-- Expenses table
CREATE TABLE public.expenses (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    category_id INTEGER NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(15, 2) NOT NULL,
    description TEXT NULL,
    notes TEXT NULL,
    created_by INTEGER NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT expenses_pkey PRIMARY KEY (id),
    CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES expense_categories (id) ON DELETE SET NULL,
    CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses USING btree (user_id) TABLESPACE pg_default;

-- Payments In table
CREATE TABLE public.payments_in (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    customer_id INTEGER NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    denomination_500 INTEGER NULL DEFAULT 0,
    denomination_1000 INTEGER NULL DEFAULT 0,
    denomination_5000 INTEGER NULL DEFAULT 0,
    online_reference VARCHAR(255) NULL,
    cheque_image_url TEXT NULL,
    customer_balance NUMERIC(15, 2) NULL DEFAULT 0,
    notes TEXT NULL,
    created_by INTEGER NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payments_in_pkey PRIMARY KEY (id),
    CONSTRAINT payments_in_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT payments_in_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
    CONSTRAINT payments_in_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_payments_in_user_id ON public.payments_in USING btree (user_id) TABLESPACE pg_default;

-- Payments Out table
CREATE TABLE public.payments_out (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    supplier_id INTEGER NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    denomination_500 INTEGER NULL DEFAULT 0,
    denomination_1000 INTEGER NULL DEFAULT 0,
    denomination_5000 INTEGER NULL DEFAULT 0,
    online_reference VARCHAR(255) NULL,
    cheque_image_url TEXT NULL,
    supplier_balance NUMERIC(15, 2) NULL DEFAULT 0,
    notes TEXT NULL,
    created_by INTEGER NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payments_out_pkey PRIMARY KEY (id),
    CONSTRAINT payments_out_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT payments_out_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL,
    CONSTRAINT payments_out_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_payments_out_user_id ON public.payments_out USING btree (user_id) TABLESPACE pg_default;

-- Sales Invoices table
CREATE TABLE public.sales_invoices (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    invoice_no VARCHAR(100) NOT NULL,
    customer_id INTEGER NULL,
    customer_po VARCHAR(100) NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE NULL,
    subtotal NUMERIC(15, 2) NULL DEFAULT 0,
    gst_percentage NUMERIC(5, 2) NULL DEFAULT 18,
    gst_amount NUMERIC(15, 2) NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NULL DEFAULT 0,
    previous_balance NUMERIC(15, 2) NULL DEFAULT 0,
    final_balance NUMERIC(15, 2) NULL DEFAULT 0,
    status VARCHAR(50) NULL DEFAULT 'draft',
    bill_situation VARCHAR(50) NULL DEFAULT 'pending',
    notes TEXT NULL,
    created_by INTEGER NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sales_invoices_pkey PRIMARY KEY (id),
    CONSTRAINT sales_invoices_user_id_invoice_no_key UNIQUE (user_id, invoice_no),
    CONSTRAINT sales_invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT sales_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
    CONSTRAINT sales_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_user_id ON public.sales_invoices USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_no ON public.sales_invoices USING btree (invoice_no) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales_invoices USING btree (customer_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales_invoices USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_date ON public.sales_invoices USING btree (invoice_date DESC) TABLESPACE pg_default;

CREATE TRIGGER update_sales_updated_at
    BEFORE UPDATE ON sales_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sales Invoice Items table
CREATE TABLE public.sales_invoice_items (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    invoice_id INTEGER NULL,
    product_id INTEGER NULL,
    product_name VARCHAR(255) NULL,
    description TEXT NULL,
    quantity NUMERIC(15, 2) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    total_price NUMERIC(15, 2) NOT NULL,
    weight NUMERIC(10, 2) NULL,
    cartons INTEGER NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sales_invoice_items_pkey PRIMARY KEY (id),
    CONSTRAINT sales_invoice_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT sales_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES sales_invoices (id) ON DELETE CASCADE,
    CONSTRAINT sales_invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_user_id ON public.sales_invoice_items USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_invoice_id ON public.sales_invoice_items USING btree (invoice_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_product_id ON public.sales_invoice_items USING btree (product_id) TABLESPACE pg_default;

-- Sale Orders table
CREATE TABLE public.sale_orders (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    order_no VARCHAR(100) NOT NULL,
    customer_id INTEGER NULL,
    customer_po VARCHAR(100) NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE NULL,
    subtotal NUMERIC(15, 2) NULL DEFAULT 0,
    gst_percentage NUMERIC(5, 2) NULL DEFAULT 18,
    gst_amount NUMERIC(15, 2) NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NULL DEFAULT 0,
    previous_balance NUMERIC(15, 2) NULL DEFAULT 0,
    final_balance NUMERIC(15, 2) NULL DEFAULT 0,
    status VARCHAR(50) NULL DEFAULT 'draft',
    order_status VARCHAR(50) NULL DEFAULT 'pending',
    notes TEXT NULL,
    created_by INTEGER NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sale_orders_pkey PRIMARY KEY (id),
    CONSTRAINT sale_orders_user_id_order_no_key UNIQUE (user_id, order_no),
    CONSTRAINT sale_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT sale_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
    CONSTRAINT sale_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_sale_orders_user_id ON public.sale_orders USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_order_no ON public.sale_orders USING btree (order_no) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_order_customer ON public.sale_orders USING btree (customer_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_order_status ON public.sale_orders USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_order_date ON public.sale_orders USING btree (order_date DESC) TABLESPACE pg_default;

CREATE TRIGGER update_sale_orders_updated_at
    BEFORE UPDATE ON sale_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sale Order Items table
CREATE TABLE public.sale_order_items (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    order_id INTEGER NULL,
    product_id INTEGER NULL,
    product_name VARCHAR(255) NULL,
    description TEXT NULL,
    quantity NUMERIC(15, 2) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    total_price NUMERIC(15, 2) NOT NULL,
    weight NUMERIC(10, 2) NULL,
    cartons INTEGER NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sale_order_items_pkey PRIMARY KEY (id),
    CONSTRAINT sale_order_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT sale_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES sale_orders (id) ON DELETE CASCADE,
    CONSTRAINT sale_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_sale_order_items_user_id ON public.sale_order_items USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_order_items_order_id ON public.sale_order_items USING btree (order_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_order_items_product_id ON public.sale_order_items USING btree (product_id) TABLESPACE pg_default;

-- Purchase Orders table
CREATE TABLE public.purchase_orders (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    po_no VARCHAR(100) NOT NULL,
    supplier_id INTEGER NULL,
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal NUMERIC(15, 2) NULL DEFAULT 0,
    is_gst BOOLEAN NULL DEFAULT false,
    gst_percentage NUMERIC(5, 2) NULL DEFAULT 0,
    gst_amount NUMERIC(15, 2) NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NULL DEFAULT 0,
    previous_balance NUMERIC(15, 2) NULL DEFAULT 0,
    final_payable NUMERIC(15, 2) NULL DEFAULT 0,
    status VARCHAR(50) NULL DEFAULT 'pending',
    notes TEXT NULL,
    created_by INTEGER NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_orders_user_id_po_no_key UNIQUE (user_id, po_no),
    CONSTRAINT purchase_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL,
    CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id ON public.purchase_orders USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_purchase_po_no ON public.purchase_orders USING btree (po_no) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_purchase_supplier ON public.purchase_orders USING btree (supplier_id) TABLESPACE pg_default;

CREATE TRIGGER update_purchase_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Purchase Order Items table
CREATE TABLE public.purchase_order_items (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    po_id INTEGER NULL,
    product_id INTEGER NULL,
    product_name VARCHAR(255) NULL,
    quantity NUMERIC(15, 2) NOT NULL,
    received_quantity NUMERIC(15, 2) NULL DEFAULT 0,
    unit_price NUMERIC(15, 2) NOT NULL,
    total_price NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_order_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES purchase_orders (id) ON DELETE CASCADE,
    CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_user_id ON public.purchase_order_items USING btree (user_id) TABLESPACE pg_default;

-- Receiving Records table
CREATE TABLE public.receiving_records (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    po_id INTEGER NULL,
    po_item_id INTEGER NULL,
    warehouse_id INTEGER NULL,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_quantity NUMERIC(15, 2) NOT NULL,
    remarks TEXT NULL,
    created_by INTEGER NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT receiving_records_pkey PRIMARY KEY (id),
    CONSTRAINT receiving_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT receiving_records_po_id_fkey FOREIGN KEY (po_id) REFERENCES purchase_orders (id) ON DELETE SET NULL,
    CONSTRAINT receiving_records_po_item_id_fkey FOREIGN KEY (po_item_id) REFERENCES purchase_order_items (id) ON DELETE SET NULL,
    CONSTRAINT receiving_records_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL,
    CONSTRAINT receiving_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_receiving_records_user_id ON public.receiving_records USING btree (user_id) TABLESPACE pg_default;

-- Stock In table
CREATE TABLE public.stock_in (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    product_id INTEGER NULL,
    supplier_id INTEGER NULL,
    warehouse_id INTEGER NULL,
    buying_source VARCHAR(50) NULL DEFAULT 'Pakistan',
    quantity NUMERIC(15, 2) NOT NULL,
    old_quantity NUMERIC(15, 2) NULL DEFAULT 0,
    new_quantity NUMERIC(15, 2) NULL DEFAULT 0,
    unit_cost NUMERIC(15, 2) NULL DEFAULT 0,
    total_cost NUMERIC(15, 2) NULL DEFAULT 0,
    notes TEXT NULL,
    created_by INTEGER NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT stock_in_pkey PRIMARY KEY (id),
    CONSTRAINT stock_in_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT stock_in_product_id_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
    CONSTRAINT stock_in_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL,
    CONSTRAINT stock_in_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL,
    CONSTRAINT stock_in_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_stock_in_user_id ON public.stock_in USING btree (user_id) TABLESPACE pg_default;

-- Stock Out table
CREATE TABLE public.stock_out (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    product_id INTEGER NULL,
    customer_id INTEGER NULL,
    sale_order_id INTEGER NULL,
    warehouse_id INTEGER NULL,
    quantity NUMERIC(15, 2) NOT NULL,
    old_quantity NUMERIC(15, 2) NULL DEFAULT 0,
    new_quantity NUMERIC(15, 2) NULL DEFAULT 0,
    notes TEXT NULL,
    created_by INTEGER NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT stock_out_pkey PRIMARY KEY (id),
    CONSTRAINT stock_out_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT stock_out_product_id_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
    CONSTRAINT stock_out_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
    CONSTRAINT stock_out_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL,
    CONSTRAINT stock_out_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_stock_out_user_id ON public.stock_out USING btree (user_id) TABLESPACE pg_default;

-- =====================================================
-- INSERT SAMPLE DATA
-- =====================================================

-- Insert sample users (passwords are hashed versions of 'password123')
INSERT INTO users (username, password_hash, full_name, email, phone, role, is_active) VALUES
('admin', 'admin', 'System Administrator', 'admin@company.com', '0300-1234567', 'admin', true),
('admin1', 'admin1', 'John Smith', 'john@business.com', '0301-2345678', 'admin', true),
('admin2', 'admin2', 'Sara Ahmed', 'sara@store.com', '0302-3456789', 'user', true);

-- Insert sample units for each user
INSERT INTO units (user_id, name, symbol) VALUES
(1, 'Pieces', 'pcs'),
(1, 'Kilograms', 'kg'),
(1, 'Meters', 'm'),
(1, 'Liters', 'L'),
(1, 'Boxes', 'box'),
(2, 'Pieces', 'pcs'),
(2, 'Kilograms', 'kg'),
(2, 'Meters', 'm'),
(3, 'Pieces', 'pcs'),
(3, 'Cartons', 'ctn');

-- Insert sample categories for each user
INSERT INTO categories (user_id, name, description) VALUES
(1, 'Electronics', 'Electronic devices and accessories'),
(1, 'Clothing', 'Apparel and garments'),
(1, 'Food', 'Food and beverages'),
(1, 'Furniture', 'Office and home furniture'),
(2, 'Hardware', 'Hardware tools and equipment'),
(2, 'Stationery', 'Office stationery items'),
(3, 'Textiles', 'Fabric and textile products'),
(3, 'Accessories', 'Fashion accessories');

-- Insert sample expense categories
INSERT INTO expense_categories (user_id, name, description) VALUES
(1, 'Utilities', 'Electricity, gas, water bills'),
(1, 'Rent', 'Office/warehouse rent'),
(1, 'Transportation', 'Fuel and vehicle expenses'),
(1, 'Salaries', 'Employee salaries and wages'),
(2, 'Office Supplies', 'Stationery and office items'),
(2, 'Marketing', 'Advertising and promotion'),
(3, 'Utilities', 'Monthly bills'),
(3, 'Maintenance', 'Equipment maintenance');

-- Insert sample warehouses
INSERT INTO warehouses (user_id, name, location, is_active) VALUES
(1, 'Main Warehouse', 'Industrial Area, Karachi', true),
(1, 'Secondary Store', 'DHA Phase 5, Karachi', true),
(2, 'Central Depot', 'Gulberg, Lahore', true),
(3, 'Primary Storage', 'Saddar, Rawalpindi', true);

-- Insert sample customers
INSERT INTO customers (user_id, customer_name, contact_person, mobile_no, whatsapp_no, email, address, ntn, opening_balance, current_balance, is_active) VALUES
(1, 'ABC Trading Company', 'Ali Hassan', '0321-1234567', '0321-1234567', 'abc@trading.com', '123 Main Street, Karachi', '1234567-8', 0, 0, true),
(1, 'XYZ Enterprises', 'Fatima Khan', '0322-2345678', '0322-2345678', 'xyz@enterprise.com', '456 Business Ave, Karachi', '2345678-9', 5000.00, 5000.00, true),
(1, 'Global Imports Ltd', 'Ahmed Raza', '0323-3456789', '0323-3456789', 'global@imports.com', '789 Trade Center, Karachi', '3456789-0', 0, 0, true),
(2, 'Metro Supplies', 'Bilal Ahmed', '0331-4567890', '0331-4567890', 'metro@supplies.com', '321 Industrial Road, Lahore', '4567890-1', 0, 0, true),
(2, 'City Distributors', 'Zainab Ali', '0332-5678901', '0332-5678901', 'city@dist.com', '654 Market Street, Lahore', '5678901-2', 10000.00, 10000.00, true),
(3, 'North Trading', 'Usman Malik', '0341-6789012', '0341-6789012', 'north@trading.com', '987 Commerce Plaza, Rawalpindi', '6789012-3', 0, 0, true);

-- Insert sample suppliers
INSERT INTO suppliers (user_id, supplier_name, contact_person, mobile_no, whatsapp_no, email, address, ntn, opening_balance, current_balance, is_active) VALUES
(1, 'Prime Suppliers Co', 'Kashif Mahmood', '0345-1111111', '0345-1111111', 'prime@suppliers.com', 'Factory Area, Faisalabad', '1111111-1', 0, 0, true),
(1, 'Quality Materials Ltd', 'Nadia Parveen', '0346-2222222', '0346-2222222', 'quality@materials.com', 'Industrial Estate, Sialkot', '2222222-2', 15000.00, 15000.00, true),
(1, 'National Wholesalers', 'Tariq Aziz', '0347-3333333', '0347-3333333', 'national@wholesale.com', 'Wholesale Market, Multan', '3333333-3', 0, 0, true),
(2, 'Eastern Imports', 'Sana Sheikh', '0355-4444444', '0355-4444444', 'eastern@imports.com', 'Port Area, Karachi', '4444444-4', 0, 0, true),
(3, 'Northern Goods', 'Imran Qureshi', '0361-5555555', '0361-5555555', 'northern@goods.com', 'Main Bazaar, Peshawar', '5555555-5', 0, 0, true);

-- Insert sample products
INSERT INTO products (user_id, name, category_id, unit_id, size_width, size_length, color, weight, unit_price, current_stock, notes, is_active) VALUES
(1, 'LED Monitor 24 inch', 1, 1, 60.00, 40.00, 'Black', 5.50, 25000.00, 50, 'Full HD LED Monitor', true),
(1, 'Wireless Keyboard', 1, 1, 45.00, 15.00, 'White', 0.80, 3500.00, 100, 'Bluetooth keyboard', true),
(1, 'Office Chair Standard', 4, 1, 60.00, 60.00, 'Black', 12.00, 8500.00, 30, 'Ergonomic office chair', true),
(1, 'Cotton T-Shirt', 2, 1, NULL, NULL, 'Blue', 0.25, 800.00, 200, 'Premium cotton t-shirt', true),
(2, 'Power Drill', 5, 6, 30.00, 10.00, 'Yellow', 2.50, 12000.00, 25, 'Heavy duty power drill', true),
(2, 'A4 Paper Ream', 6, 6, NULL, NULL, 'White', 2.50, 850.00, 500, '500 sheets per ream', true),
(3, 'Silk Fabric Roll', 7, 9, NULL, NULL, 'Red', 15.00, 5000.00, 100, 'Premium silk fabric', true),
(3, 'Leather Belt', 8, 9, NULL, NULL, 'Brown', 0.30, 1500.00, 150, 'Genuine leather belt', true);

-- Insert sample product history (tracking initial stock addition)
INSERT INTO product_history (user_id, product_id, action_type, reference_type, quantity_change, old_stock, new_stock, unit_price, total_amount, notes, created_by) VALUES
(1, 1, 'add', 'manual', 50.00, 0, 50.00, 25000.00, 1250000.00, 'Initial stock entry', 1),
(1, 2, 'add', 'manual', 100.00, 0, 100.00, 3500.00, 350000.00, 'Initial stock entry', 1),
(1, 3, 'add', 'manual', 30.00, 0, 30.00, 8500.00, 255000.00, 'Initial stock entry', 1),
(1, 4, 'add', 'manual', 200.00, 0, 200.00, 800.00, 160000.00, 'Initial stock entry', 1),
(2, 5, 'add', 'manual', 25.00, 0, 25.00, 12000.00, 300000.00, 'Initial stock entry', 2),
(2, 6, 'add', 'manual', 500.00, 0, 500.00, 850.00, 425000.00, 'Initial stock entry', 2),
(3, 7, 'add', 'manual', 100.00, 0, 100.00, 5000.00, 500000.00, 'Initial stock entry', 3),
(3, 8, 'add', 'manual', 150.00, 0, 150.00, 1500.00, 225000.00, 'Initial stock entry', 3);

-- Insert sample settings for each user
INSERT INTO settings (user_id, company_name, contact_detail_1, contact_detail_2, ntn, str, email_1, company_address) VALUES
(1, 'Admin Corp', '0300-1234567', '021-1234567', '1234567-1', 'STR-001', 'admin@company.com', 'Head Office, Karachi'),
(2, 'John Business', '0301-2345678', '042-2345678', '2345678-2', 'STR-002', 'john@business.com', 'Main Branch, Lahore'),
(3, 'Sara Store', '0302-3456789', '051-3456789', '3456789-3', 'STR-003', 'sara@store.com', 'Shop #5, Rawalpindi');

-- Insert sample company settings
INSERT INTO company_settings (user_id, company_name, address, email, phone, reminder_enabled, reminder_mode) VALUES
(1, 'Admin Corp', 'Head Office, Karachi', 'admin@company.com', '0300-1234567', true, 'daily'),
(2, 'John Business', 'Main Branch, Lahore', 'john@business.com', '0301-2345678', false, 'weekly'),
(3, 'Sara Store', 'Shop #5, Rawalpindi', 'sara@store.com', '0302-3456789', true, 'monthly');

-- Insert sample sale orders for user 1
INSERT INTO sale_orders (user_id, order_no, customer_id, order_date, delivery_date, subtotal, gst_percentage, gst_amount, total_amount, status, order_status, created_by) VALUES
(1, 'SO-2024-001', 1, '2024-11-01', '2024-11-05', 50000.00, 18, 9000.00, 59000.00, 'confirmed', 'delivered', 1),
(1, 'SO-2024-002', 2, '2024-11-10', '2024-11-15', 75000.00, 18, 13500.00, 88500.00, 'confirmed', 'pending', 1),
(2, 'SO-2024-001', 4, '2024-11-05', '2024-11-08', 24000.00, 18, 4320.00, 28320.00, 'confirmed', 'delivered', 2);

-- Insert sample sale order items
INSERT INTO sale_order_items (user_id, order_id, product_id, product_name, quantity, unit_price, total_price, weight) VALUES
(1, 1, 1, 'LED Monitor 24 inch', 2, 25000.00, 50000.00, 11.00),
(1, 2, 2, 'Wireless Keyboard', 10, 3500.00, 35000.00, 8.00),
(1, 2, 3, 'Office Chair Standard', 4, 8500.00, 34000.00, 48.00),
(2, 3, 5, 'Power Drill', 2, 12000.00, 24000.00, 5.00);

-- Insert sample sales invoices
INSERT INTO sales_invoices (user_id, invoice_no, customer_id, invoice_date, delivery_date, subtotal, gst_percentage, gst_amount, total_amount, status, bill_situation, created_by) VALUES
(1, 'INV-2024-001', 1, '2024-11-01', '2024-11-05', 50000.00, 18, 9000.00, 59000.00, 'approved', 'paid', 1),
(1, 'INV-2024-002', 3, '2024-11-15', '2024-11-18', 32000.00, 18, 5760.00, 37760.00, 'approved', 'pending', 1),
(2, 'INV-2024-001', 4, '2024-11-05', '2024-11-08', 24000.00, 18, 4320.00, 28320.00, 'approved', 'paid', 2);

-- Insert sample sales invoice items
INSERT INTO sales_invoice_items (user_id, invoice_id, product_id, product_name, quantity, unit_price, total_price, weight) VALUES
(1, 1, 1, 'LED Monitor 24 inch', 2, 25000.00, 50000.00, 11.00),
(1, 2, 4, 'Cotton T-Shirt', 40, 800.00, 32000.00, 10.00),
(2, 3, 5, 'Power Drill', 2, 12000.00, 24000.00, 5.00);

-- Insert sample purchase orders
INSERT INTO purchase_orders (user_id, po_no, supplier_id, po_date, subtotal, is_gst, gst_percentage, gst_amount, total_amount, status, created_by) VALUES
(1, 'PO-2024-001', 1, '2024-10-25', 200000.00, true, 18, 36000.00, 236000.00, 'completed', 1),
(1, 'PO-2024-002', 2, '2024-11-01', 150000.00, true, 18, 27000.00, 177000.00, 'pending', 1),
(2, 'PO-2024-001', 4, '2024-11-10', 50000.00, false, 0, 0, 50000.00, 'completed', 2);

-- Insert sample purchase order items
INSERT INTO purchase_order_items (user_id, po_id, product_id, product_name, quantity, received_quantity, unit_price, total_price) VALUES
(1, 1, 1, 'LED Monitor 24 inch', 20, 20, 20000.00, 400000.00),
(1, 2, 2, 'Wireless Keyboard', 50, 0, 3000.00, 150000.00),
(2, 3, 6, 'A4 Paper Ream', 100, 100, 500.00, 50000.00);

-- Insert sample stock in records
INSERT INTO stock_in (user_id, product_id, supplier_id, warehouse_id, buying_source, quantity, old_quantity, new_quantity, unit_cost, total_cost, created_by) VALUES
(1, 1, 1, 1, 'Pakistan', 20, 30, 50, 20000.00, 400000.00, 1),
(1, 2, 2, 1, 'China', 50, 50, 100, 3000.00, 150000.00, 1),
(2, 6, 4, 3, 'Pakistan', 100, 400, 500, 500.00, 50000.00, 2);

-- Insert sample stock out records
INSERT INTO stock_out (user_id, product_id, customer_id, sale_order_id, warehouse_id, quantity, old_quantity, new_quantity, created_by) VALUES
(1, 1, 1, 1, 1, 2, 52, 50, 1),
(1, 2, 2, 2, 1, 10, 110, 100, 1),
(2, 5, 4, 3, 3, 2, 27, 25, 2);

-- Insert sample product history for sales
INSERT INTO product_history (user_id, product_id, action_type, reference_type, reference_id, reference_no, quantity_change, old_stock, new_stock, unit_price, total_amount, customer_id, notes, created_by) VALUES
(1, 1, 'sell', 'sales_invoice', 1, 'INV-2024-001', -2.00, 52.00, 50.00, 25000.00, 50000.00, 1, 'Sold via invoice', 1),
(1, 4, 'sell', 'sales_invoice', 2, 'INV-2024-002', -40.00, 240.00, 200.00, 800.00, 32000.00, 3, 'Sold via invoice', 1),
(2, 5, 'sell', 'sales_invoice', 3, 'INV-2024-001', -2.00, 27.00, 25.00, 12000.00, 24000.00, 4, 'Sold via invoice', 2);

-- Insert sample product history for purchases
INSERT INTO product_history (user_id, product_id, action_type, reference_type, reference_id, reference_no, quantity_change, old_stock, new_stock, unit_price, total_amount, supplier_id, notes, created_by) VALUES
(1, 1, 'purchase', 'purchase_order', 1, 'PO-2024-001', 20.00, 30.00, 50.00, 20000.00, 400000.00, 1, 'Purchased from supplier', 1),
(2, 6, 'purchase', 'purchase_order', 3, 'PO-2024-001', 100.00, 400.00, 500.00, 500.00, 50000.00, 4, 'Purchased from supplier', 2);

-- Insert sample payments in
INSERT INTO payments_in (user_id, customer_id, payment_date, payment_method, amount, customer_balance, notes, created_by) VALUES
(1, 1, '2024-11-03', 'cash', 59000.00, 0, 'Full payment for INV-2024-001', 1),
(1, 2, '2024-11-12', 'online', 50000.00, 38500.00, 'Partial payment', 1),
(2, 4, '2024-11-06', 'cash', 28320.00, 0, 'Full payment for INV-2024-001', 2);

-- Insert sample payments out
INSERT INTO payments_out (user_id, supplier_id, payment_date, payment_method, amount, supplier_balance, notes, created_by) VALUES
(1, 1, '2024-10-28', 'cheque', 236000.00, 0, 'Payment for PO-2024-001', 1),
(2, 4, '2024-11-12', 'online', 50000.00, 0, 'Payment for PO-2024-001', 2);

-- Insert sample customer ledger entries
INSERT INTO customer_ledger (user_id, customer_id, transaction_date, transaction_type, reference_no, debit, credit, balance, description) VALUES
(1, 1, '2024-11-01', 'invoice', 'INV-2024-001', 59000.00, 0, 59000.00, 'Sales Invoice'),
(1, 1, '2024-11-03', 'payment', 'PAY-001', 0, 59000.00, 0, 'Payment received'),
(1, 2, '2024-11-10', 'order', 'SO-2024-002', 88500.00, 0, 93500.00, 'Sale Order'),
(1, 2, '2024-11-12', 'payment', 'PAY-002', 0, 50000.00, 43500.00, 'Partial payment');

-- Insert sample supplier ledger entries
INSERT INTO supplier_ledger (user_id, supplier_id, transaction_date, transaction_type, reference_no, debit, credit, balance, description) VALUES
(1, 1, '2024-10-25', 'purchase', 'PO-2024-001', 0, 236000.00, 236000.00, 'Purchase Order'),
(1, 1, '2024-10-28', 'payment', 'PAY-OUT-001', 236000.00, 0, 0, 'Payment made'),
(1, 2, '2024-11-01', 'purchase', 'PO-2024-002', 0, 177000.00, 192000.00, 'Purchase Order');

-- Insert sample expenses
INSERT INTO expenses (user_id, category_id, expense_date, amount, description, notes, created_by) VALUES
(1, 1, '2024-11-01', 15000.00, 'Electricity bill for November', 'Monthly utility bill', 1),
(1, 2, '2024-11-01', 50000.00, 'Office rent for November', 'Monthly rent payment', 1),
(1, 3, '2024-11-10', 8000.00, 'Fuel expenses', 'Delivery vehicle fuel', 1),
(2, 5, '2024-11-05', 5000.00, 'Office supplies', 'Stationery and supplies', 2);

-- =====================================================
-- HELPFUL VIEWS FOR QUERYING
-- =====================================================

-- View to get product history with all details
CREATE OR REPLACE VIEW v_product_history_details AS
SELECT
    ph.id,
    ph.user_id,
    ph.product_id,
    p.name as product_name,
    ph.action_type,
    ph.reference_type,
    ph.reference_id,
    ph.reference_no,
    ph.quantity_change,
    ph.old_stock,
    ph.new_stock,
    ph.old_unit_price,
    ph.new_unit_price,
    ph.unit_price,
    ph.total_amount,
    c.customer_name,
    s.supplier_name,
    w.name as warehouse_name,
    ph.notes,
    ph.changed_fields,
    u.full_name as created_by_name,
    ph.created_at
FROM product_history ph
LEFT JOIN products p ON ph.product_id = p.id
LEFT JOIN customers c ON ph.customer_id = c.id
LEFT JOIN suppliers s ON ph.supplier_id = s.id
LEFT JOIN warehouses w ON ph.warehouse_id = w.id
LEFT JOIN users u ON ph.created_by = u.id
ORDER BY ph.created_at DESC;

-- =====================================================
-- END OF SCHEMA
-- =====================================================