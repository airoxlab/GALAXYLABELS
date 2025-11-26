-- =====================================================
-- Sales Invoice Items Table Migration
-- Created: 2025-11-20
-- Description: Create sales_invoice_items table for storing invoice line items
-- =====================================================

-- Create sales_invoice_items table
CREATE TABLE IF NOT EXISTS public.sales_invoice_items (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER NULL,
    product_name VARCHAR(255) NULL,
    quantity DECIMAL(15, 2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT sales_invoice_items_pkey PRIMARY KEY (id),
    CONSTRAINT sales_invoice_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT sales_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES sales_invoices (id) ON DELETE CASCADE,
    CONSTRAINT sales_invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_user_id ON public.sales_invoice_items USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_invoice_id ON public.sales_invoice_items USING btree (invoice_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_product_id ON public.sales_invoice_items USING btree (product_id) TABLESPACE pg_default;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
