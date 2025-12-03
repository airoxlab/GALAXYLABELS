'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { Plus, Trash2 } from 'lucide-react';

export default function PurchaseForm({ purchase, suppliers = [], products = [], settings, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    po_no: '',
    supplier_id: '',
    po_date: new Date().toISOString().split('T')[0],
    receiving_date: '',
    currency_code: 'PKR',
    gst_percentage: 0,
    previous_balance: 0,
    status: 'pending',
    notes: '',
  });

  const [items, setItems] = useState([{
    product_id: '',
    quantity: 1,
    unit_price: 0,
    total: 0
  }]);

  // Get currencies - now passed from parent which fetches from user_currencies table
  // Fallback to PKR if no currencies available
  const userCurrencies = settings?.user_currencies || [{ code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee', rate_to_pkr: 1, is_default: true }];
  const defaultCurrency = userCurrencies.find(c => c.is_default)?.code || 'PKR';
  const currencyInfo = userCurrencies.find(c => c.code === (formData.currency_code || defaultCurrency)) || { code: 'PKR', symbol: 'Rs' };

  useEffect(() => {
    if (purchase) {
      setFormData({
        po_no: purchase.po_no || '',
        supplier_id: purchase.supplier_id?.toString() || '',
        po_date: purchase.po_date || new Date().toISOString().split('T')[0],
        receiving_date: purchase.receiving_date || '',
        currency_code: purchase.currency_code || defaultCurrency,
        gst_percentage: purchase.gst_percentage || 0,
        previous_balance: purchase.previous_balance || 0,
        status: purchase.status || 'pending',
        notes: purchase.notes || '',
      });
      if (purchase.purchase_order_items && purchase.purchase_order_items.length > 0) {
        setItems(purchase.purchase_order_items.map(item => ({
          product_id: item.product_id?.toString() || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total: item.total_price || (item.quantity * item.unit_price)
        })));
      }
    } else {
      generatePONumber();
      setFormData(prev => ({ ...prev, currency_code: defaultCurrency }));
    }
  }, [purchase, defaultCurrency]);

  useEffect(() => {
    if (formData.supplier_id) {
      const selectedSupplier = suppliers.find(s => s.id === parseInt(formData.supplier_id));
      if (selectedSupplier) {
        setFormData(prev => ({ ...prev, previous_balance: selectedSupplier.current_balance || 0 }));
      }
    }
  }, [formData.supplier_id, suppliers]);

  async function generatePONumber() {
    const prefix = settings?.po_prefix || 'PO';
    const nextNumber = settings?.next_po_number || 1;
    const paddedNumber = String(nextNumber).padStart(4, '0');
    setFormData(prev => ({ ...prev, po_no: `${prefix}-${paddedNumber}` }));
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProductChange = (index, productId) => {
    const newItems = [...items];
    const product = products.find(p => String(p.id) === String(productId));
    if (product) {
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        unit_price: product.unit_price || 0,
        total: newItems[index].quantity * (product.unit_price || 0)
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        product_id: '',
        unit_price: 0,
        total: 0
      };
    }
    setItems(newItems);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = parseFloat(newItems[index].quantity || 0) * parseFloat(newItems[index].unit_price || 0);
    }

    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { product_id: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
  };

  const calculateGSTAmount = () => {
    return (calculateSubtotal() * (parseFloat(formData.gst_percentage) || 0)) / 100;
  };

  const calculateTotalAmount = () => {
    return calculateSubtotal() + calculateGSTAmount();
  };

  const calculateFinalPayable = () => {
    return calculateTotalAmount() + parseFloat(formData.previous_balance || 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const validItems = items.filter(item => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      alert('Please add at least one product item');
      return;
    }

    if (!formData.supplier_id) {
      alert('Please select a supplier');
      return;
    }

    const purchaseData = {
      ...formData,
      is_gst: formData.gst_percentage > 0,
      subtotal: calculateSubtotal(),
      gst_amount: calculateGSTAmount(),
      total_amount: calculateTotalAmount(),
      final_payable: calculateFinalPayable(),
      items: validItems
    };

    onSubmit(purchaseData);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const supplierOptions = (suppliers || []).map(s => ({
    value: s.id.toString(),
    label: `${s.supplier_name}${s.mobile_no ? ` - ${s.mobile_no}` : ''}`
  }));

  const productOptions = (products || []).map(p => ({
    value: p.id.toString(),
    label: p.name || 'Unnamed Product'
  }));

  // Debug: Log products to help identify why dropdown might be empty
  useEffect(() => {
    console.log('PurchaseForm - Products received:', products?.length || 0, products);
    console.log('PurchaseForm - Product options:', productOptions);
  }, [products]);

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {/* Row 1: PO Number, Supplier */}
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="block text-[9px] font-medium text-neutral-500 mb-0.5">PO # (Auto)</label>
          <input
            type="text"
            name="po_no"
            value={formData.po_no}
            readOnly
            className={cn(
              "w-full px-2 py-1 text-[11px]",
              "bg-neutral-100 border border-neutral-200 rounded",
              "text-neutral-600"
            )}
          />
        </div>
        <div>
          <label className="block text-[9px] font-medium text-neutral-500 mb-0.5">Supplier Name *</label>
          <SearchableDropdown
            options={supplierOptions}
            value={formData.supplier_id}
            onChange={(val) => setFormData(prev => ({ ...prev, supplier_id: val }))}
            placeholder="Select Supplier"
            compact={true}
          />
        </div>
      </div>

      {/* Row 2: Currency, Order Date, Receiving Date, Status */}
      <div className="grid grid-cols-4 gap-1.5">
        <div>
          <label className="block text-[9px] font-medium text-neutral-500 mb-0.5">Currency</label>
          <SearchableDropdown
            options={userCurrencies.map(c => ({
              value: c.code,
              label: `${c.code} (${c.symbol})`
            }))}
            value={formData.currency_code || defaultCurrency}
            onChange={(val) => setFormData(prev => ({ ...prev, currency_code: val }))}
            placeholder="Select Currency"
            compact={true}
          />
        </div>
        <div>
          <label className="block text-[9px] font-medium text-neutral-500 mb-0.5">Order Date *</label>
          <input
            type="date"
            name="po_date"
            value={formData.po_date}
            onChange={handleChange}
            required
            className={cn(
              "w-full px-2 py-1 text-[11px]",
              "bg-neutral-50 border border-neutral-200 rounded",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
            )}
          />
        </div>
        <div>
          <label className="block text-[9px] font-medium text-neutral-500 mb-0.5">Receiving Date</label>
          <input
            type="date"
            name="receiving_date"
            value={formData.receiving_date}
            onChange={handleChange}
            className={cn(
              "w-full px-2 py-1 text-[11px]",
              "bg-neutral-50 border border-neutral-200 rounded",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
            )}
          />
        </div>
        <div>
          <label className="block text-[9px] font-medium text-neutral-500 mb-0.5">PO Status</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className={cn(
              "w-full px-2 py-1 text-[11px]",
              "bg-neutral-50 border border-neutral-200 rounded",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
            )}
          >
            <option value="pending">Pending</option>
            <option value="received">Received</option>
            <option value="partial">Partial</option>
          </select>
        </div>
      </div>

      {/* Row 3: GST %, Previous Balance */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className="col-span-2"></div>
        <div>
          <label className="block text-[9px] font-medium text-neutral-500 mb-0.5">GST %</label>
          <input
            type="number"
            name="gst_percentage"
            value={formData.gst_percentage}
            onChange={handleChange}
            step="0.01"
            className={cn(
              "w-full px-2 py-1 text-[11px]",
              "bg-neutral-50 border border-neutral-200 rounded",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
            )}
          />
        </div>
        <div>
          <label className="block text-[9px] font-medium text-neutral-500 mb-0.5">Previous Balance</label>
          <input
            type="text"
            value={`${currencyInfo.symbol || 'Rs'} ${formatCurrency(formData.previous_balance)}`}
            readOnly
            className={cn(
              "w-full px-2 py-1 text-[11px]",
              "bg-neutral-100 border border-neutral-200 rounded",
              "text-neutral-600"
            )}
          />
        </div>
      </div>

      {/* Product Items */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[9px] font-medium text-neutral-500">Product Items</label>
          <button
            type="button"
            onClick={handleAddItem}
            className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-medium",
              "bg-neutral-100 text-neutral-600",
              "hover:bg-neutral-200",
              "flex items-center gap-0.5"
            )}
          >
            <Plus className="w-2.5 h-2.5" />
            Add
          </button>
        </div>

        <div className="rounded border border-neutral-200">
          <table className="w-full text-[9px]">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-1 py-0.5 text-left font-medium text-neutral-500 w-5">S#</th>
                <th className="px-1 py-0.5 text-left font-medium text-neutral-500">Product Name</th>
                <th className="px-1 py-0.5 text-center font-medium text-neutral-500 w-12">Qty</th>
                <th className="px-1 py-0.5 text-center font-medium text-neutral-500 w-16">@ Price</th>
                <th className="px-1 py-0.5 text-right font-medium text-neutral-500 w-20">Amount</th>
                <th className="px-0.5 py-0.5 w-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-neutral-50/50">
                  <td className="px-1 py-0.5 text-neutral-400">{index + 1}</td>
                  <td className="px-0.5 py-0.5">
                    <SearchableDropdown
                      options={productOptions}
                      value={item.product_id}
                      onChange={(val) => handleProductChange(index, val)}
                      placeholder="Select Product"
                      compact={true}
                    />
                  </td>
                  <td className="px-0.5 py-0.5">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      min="1"
                      className={cn(
                        "w-full px-1 py-0.5 text-[9px] text-center",
                        "bg-white border border-neutral-200 rounded",
                        "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                      )}
                    />
                  </td>
                  <td className="px-0.5 py-0.5">
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                      step="0.01"
                      className={cn(
                        "w-full px-1 py-0.5 text-[9px] text-center",
                        "bg-white border border-neutral-200 rounded",
                        "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                      )}
                    />
                  </td>
                  <td className="px-1 py-0.5 text-right font-medium text-neutral-900 text-[9px]">
                    {currencyInfo.symbol || 'Rs'} {formatCurrency(item.total)}
                  </td>
                  <td className="px-0.5 py-0.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      disabled={items.length === 1}
                      className="p-0.5 text-neutral-400 hover:text-neutral-700 rounded disabled:opacity-30"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-neutral-50 rounded p-1.5 border border-neutral-200">
        <div className="grid grid-cols-5 gap-1 text-center">
          <div>
            <div className="text-[8px] text-neutral-500 uppercase">Subtotal</div>
            <div className="text-[9px] font-semibold">{currencyInfo.symbol || 'Rs'} {formatCurrency(calculateSubtotal())}</div>
          </div>
          <div>
            <div className="text-[8px] text-neutral-500 uppercase">GST</div>
            <div className="text-[9px] font-semibold">{currencyInfo.symbol || 'Rs'} {formatCurrency(calculateGSTAmount())}</div>
          </div>
          <div className="bg-neutral-900 rounded py-0.5">
            <div className="text-[8px] text-neutral-400 uppercase">Total</div>
            <div className="text-[9px] font-semibold text-white">{currencyInfo.symbol || 'Rs'} {formatCurrency(calculateTotalAmount())}</div>
          </div>
          <div>
            <div className="text-[8px] text-neutral-500 uppercase">Previous</div>
            <div className="text-[9px] font-semibold">{currencyInfo.symbol || 'Rs'} {formatCurrency(formData.previous_balance)}</div>
          </div>
          <div>
            <div className="text-[8px] text-neutral-500 uppercase">Payable</div>
            <div className="text-[9px] font-bold text-neutral-900">{currencyInfo.symbol || 'Rs'} {formatCurrency(calculateFinalPayable())}</div>
          </div>
        </div>
      </div>

      {/* Special Note - Moved to bottom */}
      <div>
        <label className="block text-[9px] font-medium text-neutral-500 mb-0.5">Special Note</label>
        <input
          type="text"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Enter special note..."
          className={cn(
            "w-full px-2 py-1 text-[11px]",
            "bg-neutral-50 border border-neutral-200 rounded",
            "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
          )}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-1.5 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className={cn(
            "flex-1 px-2 py-1 rounded text-[11px] font-medium",
            "bg-neutral-100 text-neutral-700",
            "hover:bg-neutral-200",
            "disabled:opacity-50"
          )}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "flex-1 px-2 py-1 rounded text-[11px] font-medium",
            "bg-neutral-900 text-white",
            "hover:bg-neutral-800",
            "disabled:opacity-50",
            "flex items-center justify-center gap-1"
          )}
        >
          {isLoading ? 'Saving...' : purchase ? 'Update' : 'Save Purchase'}
        </button>
      </div>
    </form>
  );
}
