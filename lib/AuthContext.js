'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'superadmin' or 'staff'
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      // Only set loading on initial check
      if (!user) {
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
        return;
      }

      const userId = data.user.id;
      const receivedUserType = data.user.userType;
      console.log('AuthContext - User ID:', userId, 'UserType from API:', receivedUserType);

      // If staff, fetch full staff data with permissions
      if (receivedUserType === 'staff') {
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select(`
            *,
            staff_permissions (*)
          `)
          .eq('id', userId)
          .eq('is_active', true)
          .single();

        console.log('AuthContext - Staff query:', { data: staffData, error: staffError });

        if (staffData && !staffError) {
          console.log('AuthContext - Setting staff user');
          console.log('AuthContext - Staff permissions:', staffData.staff_permissions);
          setUser(staffData);
          setUserType('staff');
          setPermissions(staffData.staff_permissions?.[0] || null);
        } else {
          console.log('AuthContext - Staff not found, using API data');
          setUser(data.user);
          setUserType('staff');
          setPermissions(null);
        }
        setLoading(false);
        return;
      }

      // If superadmin, use the data from API directly
      if (receivedUserType === 'superadmin') {
        console.log('AuthContext - Setting superadmin user from API');
        setUser(data.user);
        setUserType('superadmin');
        setPermissions(null); // Superadmins have all permissions
        setLoading(false);
        return;
      }

      // Unknown userType
      console.log('AuthContext - Unknown userType:', receivedUserType);
      setUser(null);
      setUserType(null);
      setPermissions(null);
      setLoading(false);
    } catch (error) {
      console.error('Error checking user:', error);
      setUser(null);
      setUserType(null);
      setPermissions(null);
      setLoading(false);
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
