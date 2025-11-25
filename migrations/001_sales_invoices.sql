-- =====================================================
-- Sales Invoices Table Migration
-- Created: 2025-11-20
-- Description: Create sales_invoices table for storing invoices
-- =====================================================

-- Create sales_invoices table
CREATE TABLE IF NOT EXISTS public.sales_invoices (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    invoice_no VARCHAR(50) NOT NULL,
    order_id INTEGER NULL,
    customer_id INTEGER NULL,
    customer_po VARCHAR(100) NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE NULL,
    subtotal DECIMAL(15, 2) NULL DEFAULT 0,
    gst_percentage DECIMAL(5, 2) NULL DEFAULT 0,
    gst_amount DECIMAL(15, 2) NULL DEFAULT 0,
    total_amount DECIMAL(15, 2) NULL DEFAULT 0,
    previous_balance DECIMAL(15, 2) NULL DEFAULT 0,
    final_balance DECIMAL(15, 2) NULL DEFAULT 0,
    status VARCHAR(20) NULL DEFAULT 'draft',
    bill_situation VARCHAR(50) NULL DEFAULT 'pending',
    notes TEXT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT sales_invoices_pkey PRIMARY KEY (id),
    CONSTRAINT sales_invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT sales_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
    CONSTRAINT sales_invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES sale_orders (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_invoices_user_id ON public.sales_invoices USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_id ON public.sales_invoices USING btree (customer_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_order_id ON public.sales_invoices USING btree (order_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_invoice_no ON public.sales_invoices USING btree (invoice_no) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_invoice_date ON public.sales_invoices USING btree (invoice_date) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON public.sales_invoices USING btree (status) TABLESPACE pg_default;

-- Create trigger for auto-updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_sales_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sales_invoices_timestamp ON sales_invoices;
CREATE TRIGGER update_sales_invoices_timestamp
    BEFORE UPDATE ON sales_invoices
    FOR EACH ROW EXECUTE FUNCTION update_sales_invoices_updated_at();

-- =====================================================
-- END OF MIGRATION
-- =====================================================
