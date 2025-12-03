'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Try to get cached user from sessionStorage for instant render
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('authUserCache');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          // Invalid cache
        }
      }
    }
    return null;
  });
  const [userType, setUserType] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('authUserTypeCache') || null;
    }
    return null;
  });
  const [permissions, setPermissions] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('authPermissionsCache');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          // Invalid cache
        }
      }
    }
    return null;
  });
  // Only show loading on initial load, not on subsequent navigations
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('authUserCache');
    }
    return true;
  });
  const hasInitialized = useRef(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      // Only set loading on initial check when no cached data exists
      const hasCachedData = typeof window !== 'undefined' && sessionStorage.getItem('authUserCache');
      if (!hasCachedData && !hasInitialized.current) {
        setLoading(true);
      }

      // Use your custom API endpoint to check authentication
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();

      console.log('AuthContext - API response:', data);

      if (!data.success || !data.user) {
        console.log('AuthContext - No user from API');
        setUser(null);
        setUserType(null);
        setPermissions(null);
        setLoading(false);
        // Clear cache on logout
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('authUserCache');
          sessionStorage.removeItem('authUserTypeCache');
          sessionStorage.removeItem('authPermissionsCache');
          sessionStorage.removeItem('sidebarMenuCache');
        }
        return;
      }

      const userId = data.user.id;
      const receivedUserType = data.user.userType;
      console.log('AuthContext - User ID:', userId, 'UserType from API:', receivedUserType);

      // If staff, fetch full staff data with permissions
      if (receivedUserType === 'staff') {
        // First fetch staff data
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('*')
          .eq('id', userId)
          .eq('is_active', true)
          .single();

        console.log('AuthContext - Staff query:', { data: staffData, error: staffError });

        if (staffData && !staffError) {
          // Now fetch permissions separately using staff_id
          const { data: permissionsData, error: permissionsError } = await supabase
            .from('staff_permissions')
            .select('*')
            .eq('staff_id', userId)
            .single();

          console.log('AuthContext - Permissions query:', { data: permissionsData, error: permissionsError });

            console.log('AuthContext - Setting staff user');
          console.log('AuthContext - Staff permissions:', permissionsData);
          console.log('AuthContext - Parent user_id:', staffData.user_id);
          const staffUser = {
            ...staffData,
            parentUserId: staffData.user_id // Parent account ID for all data queries
          };
          setUser(staffUser);
          setUserType('staff');
          setPermissions(permissionsData || null);
          // Cache for instant render on navigation
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('authUserCache', JSON.stringify(staffUser));
            sessionStorage.setItem('authUserTypeCache', 'staff');
            if (permissionsData) {
              sessionStorage.setItem('authPermissionsCache', JSON.stringify(permissionsData));
            }
          }
        } else {
          console.log('AuthContext - Staff not found, using API data');
          const apiUser = {
            ...data.user,
            parentUserId: data.user.user_id // Parent account ID from API
          };
          setUser(apiUser);
          setUserType('staff');
          setPermissions(null);
          // Cache for instant render on navigation
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('authUserCache', JSON.stringify(apiUser));
            sessionStorage.setItem('authUserTypeCache', 'staff');
            sessionStorage.removeItem('authPermissionsCache');
          }
        }
        setLoading(false);
        hasInitialized.current = true;
        return;
      }

      // If superadmin, use the data from API directly
      if (receivedUserType === 'superadmin') {
        console.log('AuthContext - Setting superadmin user from API');
        const superadminUser = {
          ...data.user,
          parentUserId: data.user.id // For superadmin, parentUserId is their own ID
        };
        setUser(superadminUser);
        setUserType('superadmin');
        setPermissions(null); // Superadmins have all permissions
        // Cache for instant render on navigation
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('authUserCache', JSON.stringify(superadminUser));
          sessionStorage.setItem('authUserTypeCache', 'superadmin');
          sessionStorage.removeItem('authPermissionsCache');
        }
        setLoading(false);
        hasInitialized.current = true;
        return;
      }

      // Unknown userType
      console.log('AuthContext - Unknown userType:', receivedUserType);
      setUser(null);
      setUserType(null);
      setPermissions(null);
      setLoading(false);
      // Clear cache
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('authUserCache');
        sessionStorage.removeItem('authUserTypeCache');
        sessionStorage.removeItem('authPermissionsCache');
        sessionStorage.removeItem('sidebarMenuCache');
      }
    } catch (error) {
      console.error('Error checking user:', error);
      setUser(null);
      setUserType(null);
      setPermissions(null);
      setLoading(false);
      // Clear cache on error
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('authUserCache');
        sessionStorage.removeItem('authUserTypeCache');
        sessionStorage.removeItem('authPermissionsCache');
        sessionStorage.removeItem('sidebarMenuCache');
      }
    }
  }

  const value = {
    user,
    userType,
    permissions,
    loading,
    isSuperadmin: userType === 'superadmin',
    isStaff: userType === 'staff',
    refreshUser: checkUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
