'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProductDrawer from '@/components/products/ProductDrawer';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { notify, useConfirm } from '@/components/ui/Notifications';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  Plus,
  Search,
  Package,
  Edit3,
  Trash2,
  X,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Layers,
  Tag,
  DollarSign
} from 'lucide-react';

export default function ProductsPage() {
  const router = useRouter();
  const { confirmState, showDeleteConfirm, hideConfirm } = useConfirm();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.user) {
        setUserId(data.user.id);
        fetchProducts(data.user.id);
        fetchCategories(data.user.id);
        fetchUnits(data.user.id);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  async function fetchProducts(uid) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories (
            name
          ),
          units (
            name,
            symbol
          )
        `)
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }

  async function fetchCategories(uid) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', uid)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }

  async function fetchUnits(uid) {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('user_id', uid)
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  }

  async function handleSubmit(formData) {
    if (!userId) return;
    setIsLoading(true);
    try {
      const productData = {
        user_id: userId,
        name: formData.name,
        category_id: formData.category_id || null,
        unit_id: formData.unit_id || null,
        size_width: parseFloat(formData.size_width) || null,
        size_length: parseFloat(formData.size_length) || null,
        color: formData.color || null,
        weight: parseFloat(formData.weight) || null,
        unit_price: parseFloat(formData.unit_price) || 0,
        notes: formData.notes || null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)
          .eq('user_id', userId);

        if (error) throw error;
        notify.success('Product updated successfully!');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        notify.success('Product created successfully!');
      }

      setEditingProduct(null);
      setIsDrawerOpen(false);
      await fetchProducts(userId);
    } catch (error) {
      console.error('Error saving product:', error);
      notify.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleDelete(id) {
    showDeleteConfirm(
      'Delete Product',
      'Are you sure you want to delete this product? This action cannot be undone.',
      async () => {
        if (!userId) return;

        try {
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

          if (error) throw error;
          notify.success('Product deleted successfully!');
          fetchProducts(userId);
        } catch (error) {
          console.error('Error deleting product:', error);
          notify.error(error.message);
        }
      }
    );
  }

  function handleEdit(product) {
    setEditingProduct(product);
    setIsDrawerOpen(true);
  }

  function handleAddNew() {
    setEditingProduct(null);
    setIsDrawerOpen(true);
  }

  function handleCancel() {
    setEditingProduct(null);
    setIsDrawerOpen(false);
  }

  async function handleAddCategory(categoryName) {
    if (!userId || !categoryName.trim()) return null;

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          user_id: userId,
          name: categoryName.trim(),
        }])
        .select()
        .single();

      if (error) throw error;

      notify.success('Category added successfully!');
      await fetchCategories(userId);
      return data;
    } catch (error) {
      console.error('Error adding category:', error);
      notify.error('Failed to add category: ' + error.message);
      return null;
    }
  }

  async function handleAddUnit(unitName) {
    if (!userId || !unitName.trim()) return null;

    try {
      const { data, error } = await supabase
        .from('units')
        .insert([{
          user_id: userId,
          name: unitName.trim(),
          symbol: '',
        }])
        .select()
        .single();

      if (error) throw error;

      notify.success('Unit added successfully!');
      await fetchUnits(userId);
      return data;
    } catch (error) {
      console.error('Error adding unit:', error);
      notify.error('Failed to add unit: ' + error.message);
      return null;
    }
  }

  function handleClearFilters() {
    setSearchQuery('');
    setFilterCategory('all');
    setCurrentPage(1);
  }

  function handleView(product) {
    setSelectedProduct(product);
    setShowViewModal(true);
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.color?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.categories?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      filterCategory === 'all' || product.category_id === parseInt(filterCategory);

    return matchesSearch && matchesCategory;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Calculate stats
  const totalPrice = products.reduce((sum, p) => sum + (p.unit_price || 0), 0);
  const avgPrice = products.length > 0 ? totalPrice / products.length : 0;

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className={cn(
                "p-2 rounded-lg transition-all flex-shrink-0",
                "hover:bg-neutral-100"
              )}
            >
              <ChevronLeft className="w-5 h-5 text-neutral-600" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                Products
              </h1>
              <p className="text-sm text-neutral-500">
                Manage your product catalog
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNew}
              className={cn(
                "px-4 py-2 rounded-xl font-medium text-sm",
                "bg-gradient-to-br from-violet-500 to-purple-600 text-white",
                "shadow-lg shadow-violet-500/20",
                "hover:from-violet-600 hover:to-purple-700",
                "transition-all duration-200",
                "flex items-center gap-2"
              )}
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
        </div>

        {/* Summary Cards - Colorful */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Products</p>
                <p className="text-xl font-bold text-blue-900">{products.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-xl border border-emerald-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Categories</p>
                <p className="text-xl font-bold text-emerald-900">{categories.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Layers className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-purple-100 rounded-xl border border-violet-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-violet-600 font-medium">Avg. Price</p>
                <p className="text-xl font-bold text-violet-900">{formatCurrency(avgPrice)}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-neutral-200 p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, color, category, or price..."
                className={cn(
                  "w-full pl-10 pr-4 py-2 text-sm rounded-lg transition-all",
                  "bg-white border border-neutral-300",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                )}
              />
            </div>

            {/* Category Filter */}
            <div className="w-48">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 text-sm rounded-lg transition-all",
                  "bg-white border border-neutral-300",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                )}
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || filterCategory !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className={cn(
          "bg-white rounded-xl",
          "border border-neutral-200",
          "overflow-hidden"
        )}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-neutral-700">
                    Product
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-neutral-700">
                    Category
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-neutral-700">
                    Unit
                  </th>
                  <th className="py-3 px-4 text-right text-sm font-semibold text-neutral-700">
                    Price
                  </th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-neutral-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {currentProducts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
                          <Package className="w-8 h-8 text-neutral-400" />
                        </div>
                        <h3 className="text-base font-medium text-neutral-900 mb-1">No products found</h3>
                        <p className="text-sm text-neutral-500">
                          {searchQuery || filterCategory !== 'all'
                            ? 'Try adjusting your filters'
                            : 'Get started by adding your first product'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <div className="text-sm font-medium text-neutral-900">{product.name}</div>
                          {(product.size_width || product.color) && (
                            <div className="text-xs text-neutral-500">
                              {product.size_width && product.size_length && `${product.size_width} × ${product.size_length}`}
                              {product.size_width && product.size_length && product.color && ' • '}
                              {product.color}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-neutral-700">{product.categories?.name || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-neutral-700">
                          {product.units?.name || '-'}
                          {product.units?.symbol && (
                            <span className="text-xs text-neutral-400 ml-1">({product.units.symbol})</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-semibold text-neutral-900">{formatCurrency(product.unit_price)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleView(product)}
                            className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-1.5 text-neutral-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Edit product"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-neutral-200/60 flex items-center justify-between">
              <div className="text-sm text-neutral-500">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} results
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    currentPage === 1
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    currentPage === 1
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-neutral-400">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                        currentPage === page
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-600 hover:bg-neutral-100"
                      )}
                    >
                      {page}
                    </button>
                  )
                ))}

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    currentPage === totalPages
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    currentPage === totalPages
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Drawer */}
      <ProductDrawer
        isOpen={isDrawerOpen}
        onClose={handleCancel}
        product={editingProduct}
        categories={categories}
        units={units}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        onAddCategory={handleAddCategory}
        onAddUnit={handleAddUnit}
        userId={userId}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={hideConfirm}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Product View Modal */}
      {showViewModal && selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowViewModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-neutral-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">Product Details</h2>
                    <p className="text-sm text-neutral-500">{selectedProduct.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-600" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-3">
                    <p className="text-xs text-blue-600 font-medium">Category</p>
                    <p className="text-sm font-semibold text-blue-900">{selectedProduct.categories?.name || '-'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-xl p-3">
                    <p className="text-xs text-emerald-600 font-medium">Unit</p>
                    <p className="text-sm font-semibold text-emerald-900">
                      {selectedProduct.units?.name || '-'}
                      {selectedProduct.units?.symbol && ` (${selectedProduct.units.symbol})`}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl p-3">
                    <p className="text-xs text-amber-600 font-medium">Unit Price</p>
                    <p className="text-sm font-semibold text-amber-900">{formatCurrency(selectedProduct.unit_price)}</p>
                  </div>
                </div>

                {(selectedProduct.size_width || selectedProduct.size_length) && (
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <p className="text-xs text-neutral-600 font-medium mb-1">Dimensions</p>
                    <p className="text-sm text-neutral-900">
                      {selectedProduct.size_width} × {selectedProduct.size_length}
                    </p>
                  </div>
                )}

                {selectedProduct.color && (
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <p className="text-xs text-neutral-600 font-medium mb-1">Color</p>
                    <p className="text-sm text-neutral-900">{selectedProduct.color}</p>
                  </div>
                )}

                {selectedProduct.weight && (
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <p className="text-xs text-neutral-600 font-medium mb-1">Weight</p>
                    <p className="text-sm text-neutral-900">{selectedProduct.weight}</p>
                  </div>
                )}

                {selectedProduct.notes && (
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <p className="text-xs text-neutral-600 font-medium mb-1">Notes</p>
                    <p className="text-sm text-neutral-900">{selectedProduct.notes}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 p-4 border-t border-neutral-200">
                <button
                  onClick={() => setShowViewModal(false)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-white border border-neutral-200 text-neutral-700",
                    "hover:bg-neutral-50 transition-all"
                  )}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(selectedProduct);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
                    "hover:from-amber-600 hover:to-orange-700 transition-all",
                    "flex items-center gap-2"
                  )}
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
