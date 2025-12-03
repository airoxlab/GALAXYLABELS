'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * ProtectedRoute component - Protects pages based on user permissions
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render if authorized
 * @param {string|string[]} props.requiredPermission - Single permission or array of permissions (OR logic)
 * @param {string} props.redirectTo - Where to redirect if unauthorized (default: /dashboard)
 * @param {boolean} props.showUnauthorized - Show unauthorized message instead of redirect (default: false)
 */
export default function ProtectedRoute({
  children,
  requiredPermission,
  redirectTo = '/dashboard',
  showUnauthorized = false
}) {
  const router = useRouter();
  const { user, userType, loading } = useAuth();
  const { hasPermission, hasAnyPermission, isSuperadmin } = usePermissions();
  const [isAuthorized, setIsAuthorized] = useState(null);

  useEffect(() => {
    if (loading) return;

    // Not logged in
    if (!user) {
      router.push('/login');
      return;
    }

    // Superadmin always has access
    if (isSuperadmin) {
      setIsAuthorized(true);
      return;
    }

    // Check permissions
    let authorized = false;
    if (Array.isArray(requiredPermission)) {
      authorized = hasAnyPermission(requiredPermission);
    } else if (requiredPermission) {
      authorized = hasPermission(requiredPermission);
    } else {
      // No specific permission required, just need to be logged in
      authorized = true;
    }

    setIsAuthorized(authorized);

    if (!authorized && !showUnauthorized) {
      router.push(redirectTo);
    }
  }, [user, userType, loading, requiredPermission, isSuperadmin]);

  // Still loading
  if (loading || isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-neutral-900"></div>
      </div>
    );
  }

  // Not authorized - show message
  if (!isAuthorized && showUnauthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-neutral-200 max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Access Denied</h2>
          <p className="text-neutral-600 mb-6">You don't have permission to access this page.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2.5 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Authorized - render children
  return children;
}

/**
 * Hook to check if user can perform an action
 * Use this for protecting individual buttons/actions within a page
 */
export function useCanPerformAction(permissionKey) {
  const { hasPermission, isSuperadmin } = usePermissions();

  if (isSuperadmin) return true;
  return hasPermission(permissionKey);
}
