'use client';

import { useAuth } from '@/lib/AuthContext';
import { useCallback } from 'react';

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
  const hasPermission = useCallback((permissionKey) => {
    // Simple logic: superadmin from users table = all permissions
    if (userType === 'superadmin') {
      return true;
    }

    // Staff from staff table = check specific permission
    if (userType === 'staff' && permissions) {
      return permissions[permissionKey] === true;
    }

    // Not logged in or no permissions loaded
    return false;
  }, [userType, permissions]);

  /**
   * Check if user has any of the specified permissions
   * @param {string[]} permissionKeys - Array of permission keys
   * @returns {boolean} - True if user has at least one permission
   */
  const hasAnyPermission = useCallback((permissionKeys) => {
    if (isSuperadmin) {
      return true;
    }

    if (isStaff && permissions) {
      return permissionKeys.some(key => permissions[key] === true);
    }

    return false;
  }, [isSuperadmin, isStaff, permissions]);

  /**
   * Check if user has all of the specified permissions
   * @param {string[]} permissionKeys - Array of permission keys
   * @returns {boolean} - True if user has all permissions
   */
  const hasAllPermissions = useCallback((permissionKeys) => {
    if (isSuperadmin) {
      return true;
    }

    if (isStaff && permissions) {
      return permissionKeys.every(key => permissions[key] === true);
    }

    return false;
  }, [isSuperadmin, isStaff, permissions]);

  /**
   * Check if user can view a specific page/feature
   * @param {string} feature - Feature name (e.g., 'sales_invoice', 'products')
   * @returns {boolean}
   */
  const canView = useCallback((feature) => {
    return hasPermission(`${feature}_view`);
  }, [hasPermission]);

  /**
   * Check if user can add to a specific feature
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  const canAdd = useCallback((feature) => {
    return hasPermission(`${feature}_add`);
  }, [hasPermission]);

  /**
   * Check if user can edit a specific feature
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  const canEdit = useCallback((feature) => {
    return hasPermission(`${feature}_edit`);
  }, [hasPermission]);

  /**
   * Check if user can delete from a specific feature
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  const canDelete = useCallback((feature) => {
    return hasPermission(`${feature}_delete`);
  }, [hasPermission]);

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
