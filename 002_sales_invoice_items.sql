-- Drop existing sales_invoice_items table if exists
DROP TABLE IF EXISTS public.sales_invoice_items CASCADE;

-- Create sales_invoice_items table
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
