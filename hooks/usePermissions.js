'use client';

import { useAuth } from '@/lib/AuthContext';

/**
 * Hook to check if user has specific permission
 * Superadmins always have all permissions
 * Staff users need explicit permission
 */
export function usePermissions() {
  const { userType, permissions, isSuperadmin, isStaff } = useAuth();

  /**
   * Check if user has a specific permission
   * @param {string} permissionKey - The permission key to check (e.g., 'sales_invoice_view')
   * @returns {boolean} - True if user has permission, false otherwise
   */
  const hasPermission = (permissionKey) => {
    console.log(`hasPermission("${permissionKey}")`, {
      userType,
      isSuperadmin,
      isStaff,
      permissionsExist: !!permissions,
      requestedPermission: permissionKey,
      permissionValue: permissions?.[permissionKey]
    });

    // Simple logic: superadmin from users table = all permissions
    if (userType === 'superadmin') {
      console.log(`  → TRUE (superadmin from users table)`);
      return true;
    }

    // Staff from staff table = check specific permission
    if (userType === 'staff' && permissions) {
      const hasIt = permissions[permissionKey] === true;
      console.log(`  → ${hasIt ? 'TRUE' : 'FALSE'} (staff - ${permissionKey}: ${permissions[permissionKey]})`);
      return hasIt;
    }

    // Not logged in or no permissions loaded
    console.log(`  → FALSE (not authenticated or no permissions)`);
    return false;
  };

  /**
   * Check if user has any of the specified permissions
   * @param {string[]} permissionKeys - Array of permission keys
   * @returns {boolean} - True if user has at least one permission
   */
  const hasAnyPermission = (permissionKeys) => {
    if (isSuperadmin) {
      return true;
    }

    if (isStaff && permissions) {
      return permissionKeys.some(key => permissions[key] === true);
    }

    return false;
  };

  /**
   * Check if user has all of the specified permissions
   * @param {string[]} permissionKeys - Array of permission keys
   * @returns {boolean} - True if user has all permissions
   */
  const hasAllPermissions = (permissionKeys) => {
    if (isSuperadmin) {
      return true;
    }

    if (isStaff && permissions) {
      return permissionKeys.every(key => permissions[key] === true);
    }

    return false;
  };

  /**
   * Check if user can view a specific page/feature
   * @param {string} feature - Feature name (e.g., 'sales_invoice', 'products')
   * @returns {boolean}
   */
  const canView = (feature) => {
    return hasPermission(`${feature}_view`);
  };

  /**
   * Check if user can add to a specific feature
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  const canAdd = (feature) => {
    return hasPermission(`${feature}_add`);
  };

  /**
   * Check if user can edit a specific feature
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  const canEdit = (feature) => {
    return hasPermission(`${feature}_edit`);
  };

  /**
   * Check if user can delete from a specific feature
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  const canDelete = (feature) => {
    return hasPermission(`${feature}_delete`);
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canView,
    canAdd,
    canEdit,
    canDelete,
    isSuperadmin,
    isStaff,
    permissions,
  };
}
