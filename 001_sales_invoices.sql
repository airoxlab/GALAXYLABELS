-- Drop existing sales_invoices table if exists
DROP TABLE IF EXISTS public.sales_invoices CASCADE;

-- Create sales_invoices table for actual invoices
CREATE TABLE public.sales_invoices (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    invoice_no VARCHAR(100) NOT NULL,
    order_id INTEGER NULL,  -- Reference to sale_orders if created from order
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
    CONSTRAINT sales_invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES sale_orders (id) ON DELETE SET NULL,
    CONSTRAINT sales_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_user_id ON public.sales_invoices USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_no ON public.sales_invoices USING btree (invoice_no) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales_invoices USING btree (customer_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_order_id ON public.sales_invoices USING btree (order_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales_invoices USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_date ON public.sales_invoices USING btree (invoice_date DESC) TABLESPACE pg_default;
