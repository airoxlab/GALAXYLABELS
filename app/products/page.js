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
  Filter,
  Edit3,
  Trash2,
  X,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
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

  function handleClearFilters() {
    setSearchQuery('');
    setFilterCategory('all');
    setCurrentPage(1);
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
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className={cn(
                "p-1.5 rounded-lg transition-all flex-shrink-0",
                "hover:bg-neutral-100"
              )}
            >
              <ChevronLeft className="w-4 h-4 text-neutral-600" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-neutral-900 tracking-tight">
                Products
              </h1>
              <p className="text-[10px] text-neutral-500">
                Manage your product catalog
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNew}
              className={cn(
                "px-3 py-1.5 rounded-lg font-medium text-xs",
                "bg-neutral-900 text-white",
                "shadow-md shadow-neutral-900/20",
                "hover:bg-neutral-800",
                "transition-all duration-200",
                "flex items-center gap-1.5"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Product
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-xl p-3",
          "border border-neutral-200/60",
          "shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
        )}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-medium text-neutral-500 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, color, category..."
                  className={cn(
                    "w-full pl-8 pr-3 py-1.5",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "text-xs placeholder:text-neutral-400",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                    "transition-all duration-200"
                  )}
                />
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-[10px] font-medium text-neutral-500 mb-1">
                Category
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className={cn(
                  "w-full px-2.5 py-1.5",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "text-xs",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
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
          </div>

          {/* Clear Filters Button */}
          {(searchQuery || filterCategory !== 'all') && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleClearFilters}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-medium",
                  "text-neutral-600 hover:text-neutral-900",
                  "hover:bg-neutral-100",
                  "transition-all duration-200",
                  "flex items-center gap-1"
                )}
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-xl px-3 py-2",
            "border border-neutral-200/60"
          )}>
            <div className="text-[10px] text-neutral-500">Total Products</div>
            <div className="text-sm font-semibold text-neutral-900">{products.length}</div>
          </div>
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-xl px-3 py-2",
            "border border-neutral-200/60"
          )}>
            <div className="text-[10px] text-neutral-500">Categories</div>
            <div className="text-sm font-semibold text-neutral-900">{categories.length}</div>
          </div>
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-xl px-3 py-2",
            "border border-neutral-200/60"
          )}>
            <div className="text-[10px] text-neutral-500">Filtered Results</div>
            <div className="text-sm font-semibold text-neutral-900">{filteredProducts.length}</div>
          </div>
        </div>

        {/* Table */}
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-xl",
          "border border-neutral-200/60",
          "shadow-[0_2px_10px_rgba(0,0,0,0.03)]",
          "overflow-hidden"
        )}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50/80 border-b border-neutral-200/60">
                <tr>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Color
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60">
                {currentProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center">
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
                    <tr key={product.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] font-medium text-neutral-900">{product.name}</div>
                        {product.notes && (
                          <div className="text-[9px] text-neutral-400">
                            {product.notes.substring(0, 50)}{product.notes.length > 50 ? '...' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] text-neutral-600">{product.categories?.name || '-'}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] text-neutral-600">
                          {product.units?.name || '-'}
                          {product.units?.symbol && (
                            <span className="text-[9px] text-neutral-400 ml-1">({product.units.symbol})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] text-neutral-600">
                          {product.size_width && product.size_length
                            ? `${product.size_width} × ${product.size_length}`
                            : '-'}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] text-neutral-600">{product.color || '-'}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] font-medium text-neutral-900">{formatCurrency(product.unit_price)}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] text-neutral-600">{product.current_stock || 0}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-end gap-0">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Edit product"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Delete product"
                          >
                            <Trash2 className="w-3 h-3" />
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
    </DashboardLayout>
  );
}
