'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import AddProductModal from '@/components/ui/AddProductModal';
import AddSupplierModal from '@/components/ui/AddSupplierModal';
import AddWarehouseModal from '@/components/ui/AddWarehouseModal';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save, Package } from 'lucide-react';
import QuantityCounter from '@/components/ui/QuantityCounter';

export default function StockInPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [user, setUser] = useState(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductIndex, setAddProductIndex] = useState(null);
  const [addProductInitialName, setAddProductInitialName] = useState('');
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [addSupplierInitialName, setAddSupplierInitialName] = useState('');
  const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
  const [addWarehouseInitialName, setAddWarehouseInitialName] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    warehouse_id: '',
    reference_type: 'purchase',
    reference_no: '',
    supplier_id: '',
    notes: '',
    items: [{ product_id: '', product_name: '', quantity: 1, unit_cost: 0 }],
  });

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        await fetchData(data.user.id);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchData(userId) {
    try {
      const [productsRes, warehousesRes, suppliersRes] = await Promise.all([
        supabase.from('products').select('id, name, current_stock, unit_price').eq('user_id', userId).eq('is_active', true).order('name'),
        supabase.from('warehouses').select('id, name').eq('user_id', userId).eq('is_active', true).order('name'),
        supabase.from('suppliers').select('id, supplier_name').eq('user_id', userId).eq('is_active', true).order('supplier_name'),
      ]);

      setProducts(productsRes.data || []);
      setWarehouses(warehousesRes.data || []);
      setSuppliers(suppliersRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProductChange = (index, productId, productsArray = null) => {
    const newItems = [...formData.items];
    const productsToUse = productsArray || products;
    const product = productsToUse.find(p => p.id === parseInt(productId));
    if (product) {
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        product_name: product.name,
        unit_cost: product.unit_price || 0,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        product_id: '',
        product_name: '',
        unit_cost: 0,
      };
    }
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', product_name: '', quantity: 1, unit_cost: 0 }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const calculateTotals = () => {
    const total = formData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity || 0) * parseFloat(item.unit_cost || 0));
    }, 0);
    return { total };
  };

  const { total } = calculateTotals();

  const handleAddSupplierClick = (initialName = '') => {
    setAddSupplierInitialName(initialName);
    setShowAddSupplierModal(true);
  };

  const handleSupplierAdded = async (newSupplier) => {
    const updatedSuppliers = await fetchSuppliers();
    setFormData(prev => ({ ...prev, supplier_id: newSupplier.id.toString() }));
    setAddSupplierInitialName('');
  };

  async function fetchSuppliers() {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, supplier_name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('supplier_name');

      if (error) throw error;
      setSuppliers(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      return [];
    }
  }

  const handleAddWarehouseClick = (initialName = '') => {
    setAddWarehouseInitialName(initialName);
    setShowAddWarehouseModal(true);
  };

  const handleWarehouseAdded = async (newWarehouse) => {
    const updatedWarehouses = await fetchWarehouses();
    setFormData(prev => ({ ...prev, warehouse_id: newWarehouse.id.toString() }));
    setAddWarehouseInitialName('');
  };

  async function fetchWarehouses() {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setWarehouses(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      return [];
    }
  }

  const handleAddProductClick = (index, initialName = '') => {
    setAddProductIndex(index);
    setAddProductInitialName(initialName);
    setShowAddProductModal(true);
  };

  const handleProductAdded = async (newProduct) => {
    const updatedProducts = await fetchProducts();

    // Pass the fresh products array directly to handleProductChange
    if (addProductIndex !== null) {
      handleProductChange(addProductIndex, newProduct.id.toString(), updatedProducts);
    }
    setAddProductIndex(null);
    setAddProductInitialName('');
  };

  async function fetchProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          unit_price,
          current_stock,
          category_id,
          categories (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return;

    const validItems = formData.items.filter(item => item.product_id);
    if (validItems.length === 0) {
      toast.error('Please add at least one product', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    setSaving(true);

    try {
      const stockInRecords = validItems.map(item => ({
        user_id: user.id,
        date: formData.date,
        product_id: parseInt(item.product_id),
        warehouse_id: formData.warehouse_id ? parseInt(formData.warehouse_id) : null,
        quantity: parseFloat(item.quantity),
        unit_cost: parseFloat(item.unit_cost) || 0,
        total_cost: parseFloat(item.quantity) * parseFloat(item.unit_cost) || 0,
        reference_type: formData.reference_type,
        reference_no: formData.reference_no,
        supplier_id: formData.supplier_id ? parseInt(formData.supplier_id) : null,
        notes: formData.notes,
        created_by: user.id,
      }));

      const { error } = await supabase.from('stock_in').insert(stockInRecords);
      if (error) throw error;

      toast.success(`${validItems.length} item(s) stocked in successfully!`, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      resetForm();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      warehouse_id: '',
      reference_type: 'purchase',
      reference_no: '',
      supplier_id: '',
      notes: '',
      items: [{ product_id: '', product_name: '', quantity: 1, unit_cost: 0 }],
    });
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
  };

  const supplierOptions = suppliers.map(s => ({ value: s.id.toString(), label: s.supplier_name }));
  const warehouseOptions = warehouses.map(w => ({ value: w.id.toString(), label: w.name }));
  const productOptions = products.map(p => ({ value: p.id.toString(), label: `${p.name} (Stock: ${p.current_stock || 0})` }));

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Stock In</h1>
          <p className="text-sm text-neutral-500">Add stock to inventory</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={cn(
            "bg-white rounded-xl",
            "border border-neutral-200",
            "shadow-sm",
            "p-5"
          )}>
            {/* Form Fields */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2 text-sm",
                    "bg-white border border-neutral-300 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                  )}
                  required
                />
              </div>

              <div>
                <SearchableDropdown
                  label={<span className="text-sm font-medium text-neutral-700">Supplier</span>}
                  options={supplierOptions}
                  value={formData.supplier_id}
                  onChange={(val) => setFormData(prev => ({ ...prev, supplier_id: val }))}
                  placeholder="Select Supplier"
                  onOpenAddModal={(searchQuery) => handleAddSupplierClick(searchQuery)}
                  addModalLabel="Add New Supplier"
                />
              </div>

              <div>
                <SearchableDropdown
                  label={<span className="text-sm font-medium text-neutral-700">Warehouse</span>}
                  options={warehouseOptions}
                  value={formData.warehouse_id}
                  onChange={(val) => setFormData(prev => ({ ...prev, warehouse_id: val }))}
                  placeholder="Select Warehouse"
                  onOpenAddModal={(searchQuery) => handleAddWarehouseClick(searchQuery)}
                  addModalLabel="Add New Warehouse"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Reference Type</label>
                <select
                  name="reference_type"
                  value={formData.reference_type}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2 text-sm",
                    "bg-white border border-neutral-300 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                  )}
                >
                  <option value="purchase">Purchase Order</option>
                  <option value="production">Production</option>
                  <option value="return">Sales Return</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Reference #</label>
                <input
                  type="text"
                  name="reference_no"
                  value={formData.reference_no}
                  onChange={handleChange}
                  placeholder="e.g., PO-001"
                  className={cn(
                    "w-full px-3 py-2 text-sm",
                    "bg-white border border-neutral-300 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                  )}
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-5">
              <div className="rounded-lg border border-neutral-200 overflow-hidden" style={{ overflow: 'visible' }}>
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-sm font-semibold text-neutral-700 w-10">#</th>
                      <th className="px-3 py-3 text-left text-sm font-semibold text-neutral-700">Product</th>
                      <th className="px-3 py-3 text-center text-sm font-semibold text-neutral-700 w-24">QTY</th>
                      <th className="px-3 py-3 text-center text-sm font-semibold text-neutral-700 w-32">Unit Cost</th>
                      <th className="px-3 py-3 text-right text-sm font-semibold text-neutral-700 w-32">Total</th>
                      <th className="px-2 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {formData.items.map((item, index) => (
                      <tr key={index} className="hover:bg-neutral-50">
                        <td className="px-3 py-2 text-sm text-neutral-500">{index + 1}</td>
                        <td className="px-2 py-2" style={{ overflow: 'visible' }}>
                          <SearchableDropdown
                            options={productOptions}
                            value={item.product_id}
                            onChange={(val) => handleProductChange(index, val)}
                            placeholder="Select Product"
                            onOpenAddModal={(searchQuery) => handleAddProductClick(index, searchQuery)}
                            addModalLabel="Add New Product"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <QuantityCounter
                            value={item.quantity}
                            onChange={(val) => handleItemChange(index, 'quantity', val)}
                            min={1}
                            step={1}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={item.unit_cost}
                            readOnly
                            className={cn(
                              "w-full px-3 py-2 text-sm text-center",
                              "bg-neutral-50 border border-neutral-200 rounded-lg",
                              "text-neutral-600 cursor-not-allowed"
                            )}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-sm font-semibold text-neutral-900">
                            {formatCurrency(item.quantity * item.unit_cost)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            disabled={formData.items.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={addItem}
                className={cn(
                  "mt-3 px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-neutral-100 text-neutral-700",
                  "hover:bg-neutral-200",
                  "flex items-center gap-2 transition-colors"
                )}
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            {/* Notes and Total Section */}
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className={cn(
                    "w-full px-3 py-2 text-sm",
                    "bg-white border border-neutral-300 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900",
                    "resize-none"
                  )}
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-neutral-900 rounded-xl px-6 py-4 text-center min-w-[160px]">
                  <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">Grand Total</div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(total)}</div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className={cn(
                    "px-6 py-4 rounded-xl font-semibold text-sm",
                    "bg-neutral-900 text-white",
                    "hover:bg-neutral-800",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center gap-2 transition-colors",
                    "min-w-[160px] justify-center"
                  )}
                >
                  <Package className="w-5 h-5" />
                  {saving ? 'Saving...' : 'Record Stock In'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => {
          setShowAddProductModal(false);
          setAddProductIndex(null);
          setAddProductInitialName('');
        }}
        onProductAdded={handleProductAdded}
        userId={user?.id}
        initialName={addProductInitialName}
      />

      {/* Add Supplier Modal */}
      <AddSupplierModal
        isOpen={showAddSupplierModal}
        onClose={() => {
          setShowAddSupplierModal(false);
          setAddSupplierInitialName('');
        }}
        onSupplierAdded={handleSupplierAdded}
        userId={user?.id}
        initialName={addSupplierInitialName}
      />

      {/* Add Warehouse Modal */}
      <AddWarehouseModal
        isOpen={showAddWarehouseModal}
        onClose={() => {
          setShowAddWarehouseModal(false);
          setAddWarehouseInitialName('');
        }}
        onWarehouseAdded={handleWarehouseAdded}
        userId={user?.id}
        initialName={addWarehouseInitialName}
      />
    </DashboardLayout>
  );
}
