'use client';

import { useAuth } from '@/lib/AuthContext';

/**
 * Hook to get the correct user_id for data queries
 * For superadmins: returns their own ID
 * For staff: returns their parent user's ID (user_id from staff table)
 *
 * This ensures staff members see and modify the same data as their parent account
 */
export function useDataUserId() {
  const { user, loading } = useAuth();

  // Return the parentUserId which is set correctly in AuthContext:
  // - For superadmins: parentUserId = their own ID
  // - For staff: parentUserId = user_id from staff table (parent account)
  const dataUserId = user?.parentUserId || null;

  return {
    dataUserId,
    loading,
    user
  };
}
