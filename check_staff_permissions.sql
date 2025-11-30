-- Check staff table
SELECT id, user_id, name, email FROM staff WHERE is_active = true;

-- Check staff_permissions table structure and data
SELECT * FROM staff_permissions;

-- Check if there's a relationship issue
SELECT 
  s.id as staff_id,
  s.name,
  s.email,
  sp.sales_order_view,
  sp.sales_order_add,
  sp.expenses_view
FROM staff s
LEFT JOIN staff_permissions sp ON sp.staff_id = s.id
WHERE s.is_active = true;
