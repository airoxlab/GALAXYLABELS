-- Drop existing sale_order_items table if exists
DROP TABLE IF EXISTS public.sale_order_items CASCADE;

-- Create sale_order_items table
CREATE TABLE public.sale_order_items (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    product_id INTEGER NULL,
    product_name VARCHAR(255) NULL,
    quantity NUMERIC(15, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sale_order_items_pkey PRIMARY KEY (id),
    CONSTRAINT sale_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES sale_orders (id) ON DELETE CASCADE,
    CONSTRAINT sale_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
    CONSTRAINT sale_order_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_sale_order_items_user_id ON public.sale_order_items USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_order_items_order_id ON public.sale_order_items USING btree (order_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_order_items_product_id ON public.sale_order_items USING btree (product_id) TABLESPACE pg_default;
