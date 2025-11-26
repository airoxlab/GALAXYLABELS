-- =====================================================
-- HAMZA.SQL - Stock Management System Database Updates
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add stock restriction setting to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS restrict_negative_stock boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.settings.restrict_negative_stock IS 'If true, prevents transactions when insufficient stock';

-- 2. Add unit_cost to stock_in table for better tracking
ALTER TABLE public.stock_in
ADD COLUMN IF NOT EXISTS unit_cost numeric(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost numeric(15, 2) DEFAULT 0;

-- 3. Update stock_in table to include old and new stock values
ALTER TABLE public.stock_in
ADD COLUMN IF NOT EXISTS old_quantity numeric(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_quantity numeric(15, 2) DEFAULT 0;

-- 4. Update stock_out table to include old and new stock values
ALTER TABLE public.stock_out
ADD COLUMN IF NOT EXISTS old_quantity numeric(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_quantity numeric(15, 2) DEFAULT 0;

-- 5. Add buying_source to stock_in if not exists
ALTER TABLE public.stock_in
ADD COLUMN IF NOT EXISTS buying_source character varying(50) DEFAULT 'Pakistan';

-- 5b. Add missing columns to stock_in table
ALTER TABLE public.stock_in
ADD COLUMN IF NOT EXISTS reference_type character varying(50) DEFAULT 'purchase',
ADD COLUMN IF NOT EXISTS reference_no character varying(100),
ADD COLUMN IF NOT EXISTS supplier_id integer,
ADD COLUMN IF NOT EXISTS warehouse_id integer,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS created_by integer,
ADD COLUMN IF NOT EXISTS date date DEFAULT CURRENT_DATE;

-- 5c. Add missing columns to stock_out table
ALTER TABLE public.stock_out
ADD COLUMN IF NOT EXISTS reference_type character varying(50) DEFAULT 'sale',
ADD COLUMN IF NOT EXISTS reference_no character varying(100),
ADD COLUMN IF NOT EXISTS customer_id integer,
ADD COLUMN IF NOT EXISTS warehouse_id integer,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS created_by integer,
ADD COLUMN IF NOT EXISTS date date DEFAULT CURRENT_DATE;

-- 6. Create index for faster stock queries
CREATE INDEX IF NOT EXISTS idx_stock_in_product_id ON public.stock_in USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_product_id ON public.stock_out USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_in_created_at ON public.stock_in USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_out_created_at ON public.stock_out USING btree (created_at DESC);

-- 7. Create a view for current stock by product (calculated from stock_in and stock_out)
CREATE OR REPLACE VIEW public.product_stock_summary AS
SELECT
    p.id as product_id,
    p.user_id,
    p.name as product_name,
    p.current_stock,
    p.unit_price,
    u.symbol as unit_symbol,
    c.name as category_name,
    COALESCE(si.total_in, 0) as total_stock_in,
    COALESCE(so.total_out, 0) as total_stock_out,
    COALESCE(si.total_in, 0) - COALESCE(so.total_out, 0) as calculated_stock
FROM products p
LEFT JOIN units u ON p.unit_id = u.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN (
    SELECT product_id, SUM(quantity) as total_in
    FROM stock_in
    GROUP BY product_id
) si ON p.id = si.product_id
LEFT JOIN (
    SELECT product_id, SUM(quantity) as total_out
    FROM stock_out
    GROUP BY product_id
) so ON p.id = so.product_id
WHERE p.is_active = true;

-- 8. Create function to update product stock after stock_in
CREATE OR REPLACE FUNCTION update_product_stock_on_stock_in()
RETURNS TRIGGER AS $$
BEGIN
    -- Get current stock
    SELECT current_stock INTO NEW.old_quantity
    FROM products
    WHERE id = NEW.product_id;

    -- Calculate new stock
    NEW.new_quantity := COALESCE(NEW.old_quantity, 0) + NEW.quantity;

    -- Update product current_stock
    UPDATE products
    SET current_stock = NEW.new_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.product_id;

    -- Insert into product_history
    INSERT INTO product_history (
        user_id,
        product_id,
        action_type,
        reference_type,
        reference_id,
        reference_no,
        quantity_change,
        old_stock,
        new_stock,
        unit_price,
        total_amount,
        supplier_id,
        warehouse_id,
        notes,
        created_by,
        created_at
    ) VALUES (
        NEW.user_id,
        NEW.product_id,
        'stock_in',
        NEW.reference_type,
        NEW.id,
        NEW.reference_no,
        NEW.quantity,
        NEW.old_quantity,
        NEW.new_quantity,
        NEW.unit_cost,
        NEW.total_cost,
        NEW.supplier_id,
        NEW.warehouse_id,
        NEW.notes,
        NEW.created_by,
        CURRENT_TIMESTAMP
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger for stock_in
DROP TRIGGER IF EXISTS trigger_update_stock_on_stock_in ON public.stock_in;
CREATE TRIGGER trigger_update_stock_on_stock_in
    BEFORE INSERT ON public.stock_in
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock_on_stock_in();

-- 10. Create function to update product stock after stock_out
CREATE OR REPLACE FUNCTION update_product_stock_on_stock_out()
RETURNS TRIGGER AS $$
BEGIN
    -- Get current stock
    SELECT current_stock INTO NEW.old_quantity
    FROM products
    WHERE id = NEW.product_id;

    -- Calculate new stock
    NEW.new_quantity := COALESCE(NEW.old_quantity, 0) - NEW.quantity;

    -- Update product current_stock
    UPDATE products
    SET current_stock = NEW.new_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.product_id;

    -- Insert into product_history
    INSERT INTO product_history (
        user_id,
        product_id,
        action_type,
        reference_type,
        reference_id,
        reference_no,
        quantity_change,
        old_stock,
        new_stock,
        customer_id,
        warehouse_id,
        notes,
        created_by,
        created_at
    ) VALUES (
        NEW.user_id,
        NEW.product_id,
        'stock_out',
        NEW.reference_type,
        NEW.id,
        NEW.reference_no,
        -NEW.quantity,
        NEW.old_quantity,
        NEW.new_quantity,
        NEW.customer_id,
        NEW.warehouse_id,
        NEW.notes,
        NEW.created_by,
        CURRENT_TIMESTAMP
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger for stock_out
DROP TRIGGER IF EXISTS trigger_update_stock_on_stock_out ON public.stock_out;
CREATE TRIGGER trigger_update_stock_on_stock_out
    BEFORE INSERT ON public.stock_out
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock_on_stock_out();

-- 12. Add low_stock_threshold to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS low_stock_threshold numeric(15, 2) DEFAULT 10;

-- 13. Create view for low stock products
CREATE OR REPLACE VIEW public.low_stock_products AS
SELECT
    p.id,
    p.user_id,
    p.name,
    p.current_stock,
    p.low_stock_threshold,
    p.unit_price,
    u.symbol as unit_symbol,
    c.name as category_name
FROM products p
LEFT JOIN units u ON p.unit_id = u.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.is_active = true
AND p.current_stock < p.low_stock_threshold;

-- 14. Create comprehensive stock transactions view
CREATE OR REPLACE VIEW public.stock_transactions AS
SELECT
    'in' as transaction_type,
    si.id,
    si.user_id,
    si.product_id,
    p.name as product_name,
    si.quantity,
    si.unit_cost,
    si.total_cost,
    si.old_quantity as old_stock,
    si.new_quantity as new_stock,
    si.reference_type,
    si.reference_no,
    si.warehouse_id,
    w.name as warehouse_name,
    si.supplier_id,
    s.supplier_name,
    NULL as customer_id,
    NULL as customer_name,
    si.notes,
    si.created_at,
    si.created_by
FROM stock_in si
LEFT JOIN products p ON si.product_id = p.id
LEFT JOIN warehouses w ON si.warehouse_id = w.id
LEFT JOIN suppliers s ON si.supplier_id = s.id

UNION ALL

SELECT
    'out' as transaction_type,
    so.id,
    so.user_id,
    so.product_id,
    p.name as product_name,
    so.quantity,
    0 as unit_cost,
    0 as total_cost,
    so.old_quantity as old_stock,
    so.new_quantity as new_stock,
    so.reference_type,
    so.reference_no,
    so.warehouse_id,
    w.name as warehouse_name,
    NULL as supplier_id,
    NULL as supplier_name,
    so.customer_id,
    c.customer_name,
    so.notes,
    so.created_at,
    so.created_by
FROM stock_out so
LEFT JOIN products p ON so.product_id = p.id
LEFT JOIN warehouses w ON so.warehouse_id = w.id
LEFT JOIN customers c ON so.customer_id = c.id
ORDER BY created_at DESC;

-- 15. Grant permissions on views
GRANT SELECT ON public.product_stock_summary TO authenticated;
GRANT SELECT ON public.low_stock_products TO authenticated;
GRANT SELECT ON public.stock_transactions TO authenticated;

-- 16. Update existing products to have default low_stock_threshold if NULL
UPDATE public.products
SET low_stock_threshold = 10
WHERE low_stock_threshold IS NULL;

-- =====================================================
-- DONE!
-- The following features are now supported:
-- 1. Automatic stock updates when stock_in/stock_out is recorded
-- 2. Product history tracking for all stock movements
-- 3. Low stock threshold per product
-- 4. Stock restriction setting (restrict_negative_stock)
-- 5. Views for stock summary, low stock, and transactions
-- =====================================================
