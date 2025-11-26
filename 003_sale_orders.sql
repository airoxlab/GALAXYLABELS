-- Drop existing sale_orders table if exists
DROP TABLE IF EXISTS public.sale_orders CASCADE;

-- Create sale_orders table
CREATE TABLE public.sale_orders (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    order_no VARCHAR(50) NOT NULL,
    customer_id INTEGER NULL,
    customer_po VARCHAR(100) NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE NULL,
    subtotal NUMERIC(15, 2) NULL DEFAULT 0,
    gst_percentage NUMERIC(5, 2) NULL DEFAULT 0,
    gst_amount NUMERIC(15, 2) NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NULL DEFAULT 0,
    status VARCHAR(20) NULL DEFAULT 'draft',
    bill_situation VARCHAR(50) NULL DEFAULT 'pending',
    notes TEXT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sale_orders_pkey PRIMARY KEY (id),
    CONSTRAINT sale_orders_user_id_order_no_key UNIQUE (user_id, order_no),
    CONSTRAINT sale_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
    CONSTRAINT sale_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_sale_orders_user_id ON public.sale_orders USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_orders_customer_id ON public.sale_orders USING btree (customer_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_orders_order_no ON public.sale_orders USING btree (order_no) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_orders_order_date ON public.sale_orders USING btree (order_date) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_orders_status ON public.sale_orders USING btree (status) TABLESPACE pg_default;
