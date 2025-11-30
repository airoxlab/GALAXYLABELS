-- =====================================================
-- Staff Management and Permissions System
-- =====================================================
-- This SQL file creates the necessary tables and triggers for managing
-- staff users with granular permissions.
--
-- Superadmins (from users table) can create staff members and assign
-- specific permissions to control what features they can access.
-- =====================================================

-- =====================================================
-- Staff Table
-- =====================================================
-- This table stores staff users who have limited access to the system
-- Staff are different from superadmin users (stored in the users table)

CREATE TABLE public.staff (
  id SERIAL NOT NULL,
  user_id INTEGER NOT NULL, -- References the superadmin who created this staff
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  password_hash VARCHAR(255) NOT NULL,
  other_details TEXT NULL,
  notes TEXT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT staff_pkey PRIMARY KEY (id),
  CONSTRAINT staff_email_key UNIQUE (email),
  CONSTRAINT staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff USING btree (email) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_staff_is_active ON public.staff USING btree (is_active) TABLESPACE pg_default;

-- =====================================================
-- Staff Permissions Table
-- =====================================================
-- This table stores granular permissions for each staff member
-- Each permission controls access to specific features and actions

CREATE TABLE public.staff_permissions (
  id SERIAL NOT NULL,
  staff_id INTEGER NOT NULL,

  -- Sales Order Permissions (/sales/sale-order)
  sales_order_view BOOLEAN DEFAULT FALSE,
  sales_order_add BOOLEAN DEFAULT FALSE,

  -- Sales Invoice Permissions (/sales)
  sales_invoice_view BOOLEAN DEFAULT FALSE,
  sales_invoice_edit BOOLEAN DEFAULT FALSE,
  sales_invoice_delete BOOLEAN DEFAULT FALSE,

  -- Purchase Order Permissions (/purchases/purchase-order)
  purchase_order_view BOOLEAN DEFAULT FALSE,
  purchase_order_add BOOLEAN DEFAULT FALSE,

  -- Purchase Permissions (/purchases)
  purchase_view BOOLEAN DEFAULT FALSE,
  purchase_edit BOOLEAN DEFAULT FALSE,
  purchase_delete BOOLEAN DEFAULT FALSE,

  -- Product Permissions (/products)
  products_view BOOLEAN DEFAULT FALSE,
  products_add BOOLEAN DEFAULT FALSE,
  products_edit BOOLEAN DEFAULT FALSE,
  products_delete BOOLEAN DEFAULT FALSE,

  -- Customer Permissions (/customers)
  customers_view BOOLEAN DEFAULT FALSE,
  customers_add BOOLEAN DEFAULT FALSE,
  customers_edit BOOLEAN DEFAULT FALSE,
  customers_delete BOOLEAN DEFAULT FALSE,

  -- Supplier Permissions (/suppliers)
  suppliers_view BOOLEAN DEFAULT FALSE,
  suppliers_add BOOLEAN DEFAULT FALSE,
  suppliers_edit BOOLEAN DEFAULT FALSE,
  suppliers_delete BOOLEAN DEFAULT FALSE,

  -- Stock In Permissions (/stock/in)
  stock_in_view BOOLEAN DEFAULT FALSE,
  stock_in_add BOOLEAN DEFAULT FALSE,

  -- Stock Out Permissions (/stock/out)
  stock_out_view BOOLEAN DEFAULT FALSE,
  stock_out_add BOOLEAN DEFAULT FALSE,

  -- Stock Availability Permissions (/stock/availability)
  stock_availability_view BOOLEAN DEFAULT FALSE,
  stock_availability_stock_in BOOLEAN DEFAULT FALSE,

  -- Low Stock Permissions (/stock/low-stock)
  low_stock_view BOOLEAN DEFAULT FALSE,
  low_stock_restock BOOLEAN DEFAULT FALSE,

  -- Warehouse Permissions (/warehouses)
  warehouses_view BOOLEAN DEFAULT FALSE,
  warehouses_add BOOLEAN DEFAULT FALSE,
  warehouses_edit BOOLEAN DEFAULT FALSE,
  warehouses_delete BOOLEAN DEFAULT FALSE,

  -- Payment In Permissions (/payments/in)
  payment_in_view BOOLEAN DEFAULT FALSE,
  payment_in_add BOOLEAN DEFAULT FALSE,

  -- Payment Out Permissions (/payments/out)
  payment_out_view BOOLEAN DEFAULT FALSE,
  payment_out_add BOOLEAN DEFAULT FALSE,

  -- Payment History Permissions (/payments/history)
  payment_history_view BOOLEAN DEFAULT FALSE,
  payment_history_edit BOOLEAN DEFAULT FALSE,
  payment_history_delete BOOLEAN DEFAULT FALSE,

  -- Customer Ledger Permissions (/ledgers/customer)
  customer_ledger_view BOOLEAN DEFAULT FALSE,

  -- Supplier Ledger Permissions (/ledgers/supplier)
  supplier_ledger_view BOOLEAN DEFAULT FALSE,

  -- Expense Permissions (/expenses)
  expenses_view BOOLEAN DEFAULT FALSE,
  expenses_add BOOLEAN DEFAULT FALSE,
  expenses_edit BOOLEAN DEFAULT FALSE,
  expenses_delete BOOLEAN DEFAULT FALSE,

  -- Reports Permissions (/reports)
  reports_view BOOLEAN DEFAULT FALSE,
  reports_download BOOLEAN DEFAULT FALSE,

  -- Settings Permissions (/settings)
  settings_view BOOLEAN DEFAULT FALSE,
  settings_edit BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT staff_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT staff_permissions_staff_id_key UNIQUE (staff_id),
  CONSTRAINT staff_permissions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_staff_permissions_staff_id ON public.staff_permissions USING btree (staff_id) TABLESPACE pg_default;

-- =====================================================
-- Trigger Functions
-- =====================================================

-- Function to update updated_at timestamp for staff table
CREATE OR REPLACE FUNCTION update_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for staff table
DROP TRIGGER IF EXISTS update_staff_timestamp ON staff;
CREATE TRIGGER update_staff_timestamp
BEFORE UPDATE ON staff
FOR EACH ROW
EXECUTE FUNCTION update_staff_updated_at();

-- Function to update updated_at timestamp for staff_permissions table
CREATE OR REPLACE FUNCTION update_staff_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for staff_permissions table
DROP TRIGGER IF EXISTS update_staff_permissions_timestamp ON staff_permissions;
CREATE TRIGGER update_staff_permissions_timestamp
BEFORE UPDATE ON staff_permissions
FOR EACH ROW
EXECUTE FUNCTION update_staff_permissions_updated_at();

-- Function to automatically create permissions record when staff is created
CREATE OR REPLACE FUNCTION create_staff_permissions()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO staff_permissions (staff_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create permissions when staff is created
DROP TRIGGER IF EXISTS create_staff_permissions_trigger ON staff;
CREATE TRIGGER create_staff_permissions_trigger
AFTER INSERT ON staff
FOR EACH ROW
EXECUTE FUNCTION create_staff_permissions();

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE staff IS 'Stores staff users with limited permissions, managed by superadmin users';
COMMENT ON TABLE staff_permissions IS 'Stores granular permissions for each staff member to control access to features';

COMMENT ON COLUMN staff.user_id IS 'References the superadmin (from users table) who created this staff member';
COMMENT ON COLUMN staff.password_hash IS 'Bcrypt hashed password for staff authentication';
COMMENT ON COLUMN staff.is_active IS 'Whether the staff account is active and can login';

COMMENT ON COLUMN staff_permissions.sales_order_view IS 'Permission to view sales order page (/sales/sale-order)';
COMMENT ON COLUMN staff_permissions.sales_order_add IS 'Permission to add new sales orders';
COMMENT ON COLUMN staff_permissions.sales_invoice_view IS 'Permission to view sales invoices page (/sales)';
COMMENT ON COLUMN staff_permissions.sales_invoice_edit IS 'Permission to edit sales invoices';
COMMENT ON COLUMN staff_permissions.sales_invoice_delete IS 'Permission to delete sales invoices';
COMMENT ON COLUMN staff_permissions.purchase_order_view IS 'Permission to view purchase order page (/purchases/purchase-order)';
COMMENT ON COLUMN staff_permissions.purchase_order_add IS 'Permission to add new purchase orders';
COMMENT ON COLUMN staff_permissions.purchase_view IS 'Permission to view purchases page (/purchases)';
COMMENT ON COLUMN staff_permissions.purchase_edit IS 'Permission to edit purchases';
COMMENT ON COLUMN staff_permissions.purchase_delete IS 'Permission to delete purchases';
COMMENT ON COLUMN staff_permissions.products_view IS 'Permission to view products page (/products)';
COMMENT ON COLUMN staff_permissions.products_add IS 'Permission to add new products';
COMMENT ON COLUMN staff_permissions.products_edit IS 'Permission to edit products';
COMMENT ON COLUMN staff_permissions.products_delete IS 'Permission to delete products';
COMMENT ON COLUMN staff_permissions.customers_view IS 'Permission to view customers page (/customers)';
COMMENT ON COLUMN staff_permissions.customers_add IS 'Permission to add new customers';
COMMENT ON COLUMN staff_permissions.customers_edit IS 'Permission to edit customers';
COMMENT ON COLUMN staff_permissions.customers_delete IS 'Permission to delete customers';
COMMENT ON COLUMN staff_permissions.suppliers_view IS 'Permission to view suppliers page (/suppliers)';
COMMENT ON COLUMN staff_permissions.suppliers_add IS 'Permission to add new suppliers';
COMMENT ON COLUMN staff_permissions.suppliers_edit IS 'Permission to edit suppliers';
COMMENT ON COLUMN staff_permissions.suppliers_delete IS 'Permission to delete suppliers';
COMMENT ON COLUMN staff_permissions.stock_in_view IS 'Permission to view stock in page (/stock/in)';
COMMENT ON COLUMN staff_permissions.stock_in_add IS 'Permission to add stock in';
COMMENT ON COLUMN staff_permissions.stock_out_view IS 'Permission to view stock out page (/stock/out)';
COMMENT ON COLUMN staff_permissions.stock_out_add IS 'Permission to add stock out';
COMMENT ON COLUMN staff_permissions.stock_availability_view IS 'Permission to view stock availability page (/stock/availability)';
COMMENT ON COLUMN staff_permissions.stock_availability_stock_in IS 'Permission to stock in from availability page';
COMMENT ON COLUMN staff_permissions.low_stock_view IS 'Permission to view low stock page (/stock/low-stock)';
COMMENT ON COLUMN staff_permissions.low_stock_restock IS 'Permission to restock from low stock page';
COMMENT ON COLUMN staff_permissions.warehouses_view IS 'Permission to view warehouses page (/warehouses)';
COMMENT ON COLUMN staff_permissions.warehouses_add IS 'Permission to add warehouses';
COMMENT ON COLUMN staff_permissions.warehouses_edit IS 'Permission to edit warehouses';
COMMENT ON COLUMN staff_permissions.warehouses_delete IS 'Permission to delete warehouses';
COMMENT ON COLUMN staff_permissions.payment_in_view IS 'Permission to view payment in page (/payments/in)';
COMMENT ON COLUMN staff_permissions.payment_in_add IS 'Permission to add payment in';
COMMENT ON COLUMN staff_permissions.payment_out_view IS 'Permission to view payment out page (/payments/out)';
COMMENT ON COLUMN staff_permissions.payment_out_add IS 'Permission to add payment out';
COMMENT ON COLUMN staff_permissions.payment_history_view IS 'Permission to view payment history page (/payments/history)';
COMMENT ON COLUMN staff_permissions.payment_history_edit IS 'Permission to edit payment history';
COMMENT ON COLUMN staff_permissions.payment_history_delete IS 'Permission to delete payment history';
COMMENT ON COLUMN staff_permissions.customer_ledger_view IS 'Permission to view customer ledger page (/ledgers/customer)';
COMMENT ON COLUMN staff_permissions.supplier_ledger_view IS 'Permission to view supplier ledger page (/ledgers/supplier)';
COMMENT ON COLUMN staff_permissions.expenses_view IS 'Permission to view expenses page (/expenses)';
COMMENT ON COLUMN staff_permissions.expenses_add IS 'Permission to add expenses';
COMMENT ON COLUMN staff_permissions.expenses_edit IS 'Permission to edit expenses';
COMMENT ON COLUMN staff_permissions.expenses_delete IS 'Permission to delete expenses';
COMMENT ON COLUMN staff_permissions.reports_view IS 'Permission to view reports page (/reports)';
COMMENT ON COLUMN staff_permissions.reports_download IS 'Permission to download reports';
COMMENT ON COLUMN staff_permissions.settings_view IS 'Permission to view settings page (/settings)';
COMMENT ON COLUMN staff_permissions.settings_edit IS 'Permission to edit settings';

-- =====================================================
-- End of SQL File
-- =====================================================
