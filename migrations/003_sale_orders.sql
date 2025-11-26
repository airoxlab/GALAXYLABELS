-- =====================================================
-- Sale Orders Table Migration
-- Created: 2025-11-20
-- Description: Create sale_orders table for storing sales orders
-- =====================================================

-- Create sale_orders table
CREATE TABLE IF NOT EXISTS public.sale_orders (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    order_no VARCHAR(50) NOT NULL,
    customer_id INTEGER NULL,
    customer_po VARCHAR(100) NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE NULL,
    subtotal DECIMAL(15, 2) NULL DEFAULT 0,
    gst_percentage DECIMAL(5, 2) NULL DEFAULT 0,
    gst_amount DECIMAL(15, 2) NULL DEFAULT 0,
    total_amount DECIMAL(15, 2) NULL DEFAULT 0,
    status VARCHAR(20) NULL DEFAULT 'draft',
    bill_situation VARCHAR(50) NULL DEFAULT 'pending',
    notes TEXT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT sale_orders_pkey PRIMARY KEY (id),
    CONSTRAINT sale_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT sale_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sale_orders_user_id ON public.sale_orders USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_orders_customer_id ON public.sale_orders USING btree (customer_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_orders_order_no ON public.sale_orders USING btree (order_no) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_orders_order_date ON public.sale_orders USING btree (order_date) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sale_orders_status ON public.sale_orders USING btree (status) TABLESPACE pg_default;

-- Create trigger for auto-updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_sale_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sale_orders_timestamp ON sale_orders;
CREATE TRIGGER update_sale_orders_timestamp
    BEFORE UPDATE ON sale_orders
    FOR EACH ROW EXECUTE FUNCTION update_sale_orders_updated_at();

-- =====================================================
-- END OF MIGRATION
-- =====================================================
