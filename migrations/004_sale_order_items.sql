-- =====================================================
-- Sale Order Items Table Migration
-- Created: 2025-11-20
-- Description: Create sale_order_items table for storing order line items
-- =====================================================

-- Create sale_order_items table
CREATE TABLE IF NOT EXISTS public.sale_order_items (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    product_id INTEGER NULL,
    product_name VARCHAR(255) NULL,
    quantity DECIMAL(15, 2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT sale_order_items_pkey PRIMARY KEY (id),
    CONSTRAINT sale_order_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT sale_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES sale_orders (id) ON DELETE CASCADE,
    CONSTRAINT sale_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sale_order_items_user_id ON public.sale_order_items USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_order_items_order_id ON public.sale_order_items USING btree (order_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_order_items_product_id ON public.sale_order_items USING btree (product_id) TABLESPACE pg_default;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
