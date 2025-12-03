-- Add available_stock column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS available_stock NUMERIC(15, 2) DEFAULT 0;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_products_available_stock ON products(available_stock);

-- Create or replace the trigger function for stock_in
CREATE OR REPLACE FUNCTION update_product_stock_on_stock_in()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the current stock
  SELECT COALESCE(available_stock, 0) INTO NEW.old_quantity
  FROM products
  WHERE id = NEW.product_id;

  -- Calculate new quantity
  NEW.new_quantity := NEW.old_quantity + NEW.quantity;

  -- Update product available_stock
  UPDATE products
  SET available_stock = NEW.new_quantity
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger function for stock_out
CREATE OR REPLACE FUNCTION update_product_stock_on_stock_out()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the current stock
  SELECT COALESCE(available_stock, 0) INTO NEW.old_quantity
  FROM products
  WHERE id = NEW.product_id;

  -- Calculate new quantity
  NEW.new_quantity := NEW.old_quantity - NEW.quantity;

  -- Prevent negative stock (optional - remove if you want to allow negative stock)
  IF NEW.new_quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', NEW.old_quantity, NEW.quantity;
  END IF;

  -- Update product available_stock
  UPDATE products
  SET available_stock = NEW.new_quantity
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers to ensure they're using the latest functions
DROP TRIGGER IF EXISTS trigger_update_stock_on_stock_in ON stock_in;
CREATE TRIGGER trigger_update_stock_on_stock_in
  BEFORE INSERT ON stock_in
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock_on_stock_in();

DROP TRIGGER IF EXISTS trigger_update_stock_on_stock_out ON stock_out;
CREATE TRIGGER trigger_update_stock_on_stock_out
  BEFORE INSERT ON stock_out
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock_on_stock_out();

-- Calculate and update available_stock for existing products based on stock_in and stock_out
UPDATE products p
SET available_stock = COALESCE(
  (SELECT SUM(quantity) FROM stock_in WHERE product_id = p.id AND user_id = p.user_id), 0
) - COALESCE(
  (SELECT SUM(quantity) FROM stock_out WHERE product_id = p.id AND user_id = p.user_id), 0
)
WHERE p.available_stock IS NULL OR p.available_stock = 0;

-- Add comment to the column
COMMENT ON COLUMN products.available_stock IS 'Current available stock quantity for the product';
