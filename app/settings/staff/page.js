'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  Plus,
  Search,
  UserPlus,
  Shield,
  Edit,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function StaffManagementPage() {
  const router = useRouter();
  const { isSuperadmin, user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    other_details: '',
    notes: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Redirect if not superadmin
  useEffect(() => {
    if (!isSuperadmin) {
      router.push('/settings');
    }
  }, [isSuperadmin, router]);

  useEffect(() => {
    if (isSuperadmin && currentUser) {
      loadStaff();
    }
  }, [isSuperadmin, currentUser]);

  async function loadStaff() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('staff')
        .select(`
          *,
          staff_permissions (*)
        `)
        .eq('user_id', currentUser.parentUserId || currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setStaff(data || []);
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Error loading staff', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredStaff = staff.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    setSaving(true);

    try {
      // Insert staff member - use parentUserId for data queries
      const { data: newStaff, error } = await supabase
        .from('staff')
        .insert([{
          user_id: currentUser.parentUserId || currentUser.id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          password_hash: formData.password, // In production, hash this properly
          other_details: formData.other_details || null,
          notes: formData.notes || null,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Staff member added successfully', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        other_details: '',
        notes: '',
      });
      setShowAddModal(false);
      loadStaff();
    } catch (error) {
      console.error('Error adding staff:', error);
      toast.error('Error: ' + error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;

    setSaving(true);

    try {
      const updateData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        other_details: formData.other_details || null,
        notes: formData.notes || null,
      };

      // Only update password if it's been changed
      if (formData.password) {
        updateData.password_hash = formData.password;
      }

      const { error } = await supabase
        .from('staff')
        .update(updateData)
        .eq('id', selectedStaff.id);

      if (error) throw error;

      toast.success('Staff member updated successfully', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      setShowEditModal(false);
      setSelectedStaff(null);
      loadStaff();
    } catch (error) {
      console.error('Error updating staff:', error);
      toast.error('Error: ' + error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async (id) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;

    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Staff member deleted', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      loadStaff();
    } catch (error) {
      console.error('Error deleting staff:', error);
      toast.error('Error deleting staff', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      loadStaff();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const openEditModal = (staffMember) => {
    setSelectedStaff(staffMember);
    setFormData({
      name: staffMember.name,
      email: staffMember.email,
      phone: staffMember.phone || '',
      password: '',
      other_details: staffMember.other_details || '',
      notes: staffMember.notes || '',
    });
    setShowEditModal(true);
  };

  const openPermissionsModal = (staffMember) => {
    setSelectedStaff(staffMember);
    setShowPermissionsModal(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/settings')}
              className={cn(
                "p-2 rounded-lg",
                "hover:bg-neutral-100",
                "transition-all duration-200"
              )}
            >
              <ChevronLeft className="w-4 h-4 text-neutral-600" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">Staff Management</h1>
              <p className="text-xs text-neutral-500">Manage staff members and their permissions</p>
            </div>
          </div>

          <button
            onClick={() => {
              setFormData({
                name: '',
                email: '',
                phone: '',
                password: '',
                other_details: '',
                notes: '',
              });
              setShowAddModal(true);
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg",
              "bg-neutral-900 text-white",
              "text-xs font-medium",
              "hover:bg-neutral-800",
              "transition-all duration-200"
            )}
          >
            <UserPlus className="w-4 h-4" />
            Add Staff Member
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search staff by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full pl-9 pr-3 py-2.5",
              "bg-white border border-neutral-200/60 rounded-lg",
              "text-sm placeholder:text-neutral-400",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>

        {/* Staff List */}
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-xl",
          "border border-neutral-200/60",
          "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
          "overflow-hidden"
        )}>
          {filteredStaff.length === 0 ? (
            <div className="p-12 text-center">
              <UserPlus className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-neutral-900 mb-1">No staff members</h3>
              <p className="text-xs text-neutral-500">
                {searchQuery ? 'No staff members match your search' : 'Add your first staff member to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50/80 border-b border-neutral-200/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">Email</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">Phone</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60">
                  {filteredStaff.map((staffMember) => (
                    <tr key={staffMember.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-neutral-900">{staffMember.name}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{staffMember.email}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{staffMember.phone || '-'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(staffMember.id, staffMember.is_active)}
                          className={cn(
                            "px-2 py-1 rounded text-[10px] font-medium",
                            staffMember.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          )}
                        >
                          {staffMember.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openPermissionsModal(staffMember)}
                            className={cn(
                              "p-1.5 rounded-lg",
                              "text-blue-600 hover:bg-blue-50",
                              "transition-all duration-200"
                            )}
                            title="Manage Permissions"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(staffMember)}
                            className={cn(
                              "p-1.5 rounded-lg",
                              "text-neutral-600 hover:bg-neutral-100",
                              "transition-all duration-200"
                            )}
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(staffMember.id)}
                            className={cn(
                              "p-1.5 rounded-lg",
                              "text-red-600 hover:bg-red-50",
                              "transition-all duration-200"
                            )}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <StaffFormModal
          title="Add Staff Member"
          formData={formData}
          setFormData={setFormData}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          onSubmit={handleAddStaff}
          onClose={() => setShowAddModal(false)}
          saving={saving}
          isEdit={false}
        />
      )}

      {/* Edit Staff Modal */}
      {showEditModal && (
        <StaffFormModal
          title="Edit Staff Member"
          formData={formData}
          setFormData={setFormData}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          onSubmit={handleUpdateStaff}
          onClose={() => {
            setShowEditModal(false);
            setSelectedStaff(null);
          }}
          saving={saving}
          isEdit={true}
        />
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedStaff && (
        <PermissionsModal
          staff={selectedStaff}
          onClose={() => {
            setShowPermissionsModal(false);
            setSelectedStaff(null);
          }}
          onUpdate={loadStaff}
        />
      )}
    </DashboardLayout>
  );
}

// Staff Form Modal Component
function StaffFormModal({ title, formData, setFormData, showPassword, setShowPassword, onSubmit, onClose, saving, isEdit }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={cn(
        "bg-white rounded-xl shadow-xl",
        "w-full max-w-md",
        "max-h-[90vh] overflow-y-auto"
      )}>
        <div className="sticky top-0 bg-white border-b border-neutral-200/60 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4 text-neutral-600" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-3" autoComplete="off">
          <div>
            <label className="block text-[10px] font-medium text-neutral-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={cn(
                "w-full px-3 py-2",
                "bg-white border border-neutral-200/60 rounded-lg",
                "text-sm placeholder:text-neutral-400",
                "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
              )}
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-neutral-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className={cn(
                "w-full px-3 py-2",
                "bg-white border border-neutral-200/60 rounded-lg",
                "text-sm placeholder:text-neutral-400",
                "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
              )}
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-neutral-700 mb-1">
              Phone
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className={cn(
                "w-full px-3 py-2",
                "bg-white border border-neutral-200/60 rounded-lg",
                "text-sm placeholder:text-neutral-400",
                "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
              )}
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-neutral-700 mb-1">
              Password {!isEdit && '*'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={!isEdit}
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder={isEdit ? 'Leave blank to keep current password' : ''}
                className={cn(
                  "w-full px-3 py-2 pr-10",
                  "bg-white border border-neutral-200/60 rounded-lg",
                  "text-sm placeholder:text-neutral-400",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-neutral-700 mb-1">
              Other Details
            </label>
            <textarea
              value={formData.other_details}
              onChange={(e) => setFormData(prev => ({ ...prev, other_details: e.target.value }))}
              rows={2}
              className={cn(
                "w-full px-3 py-2",
                "bg-white border border-neutral-200/60 rounded-lg",
                "text-sm placeholder:text-neutral-400",
                "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                "resize-none"
              )}
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-neutral-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className={cn(
                "w-full px-3 py-2",
                "bg-white border border-neutral-200/60 rounded-lg",
                "text-sm placeholder:text-neutral-400",
                "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                "resize-none"
              )}
            />
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg",
                "bg-neutral-100 text-neutral-700",
                "text-xs font-medium",
                "hover:bg-neutral-200",
                "transition-all duration-200"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg",
                "bg-neutral-900 text-white",
                "text-xs font-medium",
                "hover:bg-neutral-800",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {saving ? 'Saving...' : (isEdit ? 'Update' : 'Add Staff')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Permissions Modal Component
function PermissionsModal({ staff, onClose, onUpdate }) {
  const [permissions, setPermissions] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPermissions();
  }, []);

  async function loadPermissions() {
    try {
      const { data, error } = await supabase
        .from('staff_permissions')
        .select('*')
        .eq('staff_id', staff.id)
        .single();

      if (error) throw error;

      setPermissions(data || {});
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async () => {
    setSaving(true);

    try {
      const { error } = await supabase
        .from('staff_permissions')
        .update(permissions)
        .eq('staff_id', staff.id);

      if (error) throw error;

      toast.success('Permissions updated successfully', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Error saving permissions', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (key) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Permission groups
  const permissionGroups = [
    {
      title: 'Sales Orders',
      permissions: [
        { key: 'sales_order_view', label: 'View' },
        { key: 'sales_order_add', label: 'Add' },
      ]
    },
    {
      title: 'Sales Invoices',
      permissions: [
        { key: 'sales_invoice_view', label: 'View' },
        { key: 'sales_invoice_edit', label: 'Edit' },
        { key: 'sales_invoice_delete', label: 'Delete' },
      ]
    },
    {
      title: 'Purchase Orders',
      permissions: [
        { key: 'purchase_order_view', label: 'View' },
        { key: 'purchase_order_add', label: 'Add' },
      ]
    },
    {
      title: 'Purchases',
      permissions: [
        { key: 'purchase_view', label: 'View' },
        { key: 'purchase_edit', label: 'Edit' },
        { key: 'purchase_delete', label: 'Delete' },
      ]
    },
    {
      title: 'Products',
      permissions: [
        { key: 'products_view', label: 'View' },
        { key: 'products_add', label: 'Add' },
        { key: 'products_edit', label: 'Edit' },
        { key: 'products_delete', label: 'Delete' },
      ]
    },
    {
      title: 'Customers',
      permissions: [
        { key: 'customers_view', label: 'View' },
        { key: 'customers_add', label: 'Add' },
        { key: 'customers_edit', label: 'Edit' },
        { key: 'customers_delete', label: 'Delete' },
      ]
    },
    {
      title: 'Suppliers',
      permissions: [
        { key: 'suppliers_view', label: 'View' },
        { key: 'suppliers_add', label: 'Add' },
        { key: 'suppliers_edit', label: 'Edit' },
        { key: 'suppliers_delete', label: 'Delete' },
      ]
    },
    {
      title: 'Stock In',
      permissions: [
        { key: 'stock_in_view', label: 'View' },
        { key: 'stock_in_add', label: 'Add' },
      ]
    },
    {
      title: 'Stock Out',
      permissions: [
        { key: 'stock_out_view', label: 'View' },
        { key: 'stock_out_add', label: 'Add' },
      ]
    },
    {
      title: 'Stock Availability',
      permissions: [
        { key: 'stock_availability_view', label: 'View' },
        { key: 'stock_availability_stock_in', label: 'Stock In' },
      ]
    },
    {
      title: 'Low Stock',
      permissions: [
        { key: 'low_stock_view', label: 'View' },
        { key: 'low_stock_restock', label: 'Restock' },
      ]
    },
    {
      title: 'Warehouses',
      permissions: [
        { key: 'warehouses_view', label: 'View' },
        { key: 'warehouses_add', label: 'Add' },
        { key: 'warehouses_edit', label: 'Edit' },
        { key: 'warehouses_delete', label: 'Delete' },
      ]
    },
    {
      title: 'Payment In',
      permissions: [
        { key: 'payment_in_view', label: 'View' },
        { key: 'payment_in_add', label: 'Add' },
      ]
    },
    {
      title: 'Payment Out',
      permissions: [
        { key: 'payment_out_view', label: 'View' },
        { key: 'payment_out_add', label: 'Add' },
      ]
    },
    {
      title: 'Payment History',
      permissions: [
        { key: 'payment_history_view', label: 'View' },
        { key: 'payment_history_edit', label: 'Edit' },
        { key: 'payment_history_delete', label: 'Delete' },
      ]
    },
    {
      title: 'Customer Ledger',
      permissions: [
        { key: 'customer_ledger_view', label: 'View' },
      ]
    },
    {
      title: 'Supplier Ledger',
      permissions: [
        { key: 'supplier_ledger_view', label: 'View' },
      ]
    },
    {
      title: 'Expenses',
      permissions: [
        { key: 'expenses_view', label: 'View' },
        { key: 'expenses_add', label: 'Add' },
        { key: 'expenses_edit', label: 'Edit' },
        { key: 'expenses_delete', label: 'Delete' },
      ]
    },
    {
      title: 'Reports',
      permissions: [
        { key: 'reports_view', label: 'View' },
        { key: 'reports_download', label: 'Download' },
      ]
    },
    {
      title: 'Settings',
      permissions: [
        { key: 'settings_view', label: 'View' },
        { key: 'settings_edit', label: 'Edit' },
      ]
    },
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="text-center">Loading permissions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={cn(
        "bg-white rounded-xl shadow-xl",
        "w-full max-w-4xl",
        "max-h-[90vh] overflow-y-auto"
      )}>
        <div className="sticky top-0 bg-white border-b border-neutral-200/60 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Manage Permissions</h2>
            <p className="text-[10px] text-neutral-500">{staff.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4 text-neutral-600" />
          </button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {permissionGroups.map((group) => (
              <div key={group.title} className={cn(
                "p-3 rounded-lg",
                "bg-neutral-50/80 border border-neutral-200/60"
              )}>
                <h3 className="text-xs font-semibold text-neutral-900 mb-2">{group.title}</h3>
                <div className="space-y-1.5">
                  {group.permissions.map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions[perm.key] || false}
                        onChange={() => togglePermission(perm.key)}
                        className="w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900/10"
                      />
                      <span className="text-xs text-neutral-700">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4 mt-4 border-t border-neutral-200/60">
            <button
              onClick={onClose}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg",
                "bg-neutral-100 text-neutral-700",
                "text-xs font-medium",
                "hover:bg-neutral-200",
                "transition-all duration-200"
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg",
                "bg-neutral-900 text-white",
                "text-xs font-medium",
                "hover:bg-neutral-800",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {saving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
