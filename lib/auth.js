import { supabase } from './supabase';

// Compare password (plain text comparison)
export async function comparePassword(password, storedPassword) {
  return password === storedPassword;
}

// Login user - checks both users (superadmin) and staff tables
export async function loginUser(username, password) {
  try {
    console.log('loginUser called with username:', username);

    // First, try to login as superadmin (from users table)
    const { data: superadmin, error: superadminError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (superadmin && !superadminError) {
      console.log('Superadmin found, checking password');

      // Compare password (plain text)
      const isValid = await comparePassword(password, superadmin.password_hash);

      if (isValid) {
        console.log('Superadmin login successful');
        return {
          success: true,
          user: {
            id: superadmin.id,
            username: superadmin.username,
            full_name: superadmin.full_name,
            email: superadmin.email,
            phone: superadmin.phone,
            role: superadmin.role,
            userType: 'superadmin',
          },
        };
      }
    }

    // If not superadmin, try to login as staff (from staff table)
    // Staff can login with email as username
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('email', username)
      .eq('is_active', true)
      .single();

    if (staff && !staffError) {
      console.log('Staff found, checking password');

      // Compare password (plain text)
      const isValid = await comparePassword(password, staff.password_hash);

      if (isValid) {
        console.log('Staff login successful, parent user_id:', staff.user_id);
        return {
          success: true,
          user: {
            id: staff.id,
            user_id: staff.user_id, // Parent account ID - used for all data queries
            username: staff.email, // Use email as username for staff
            full_name: staff.name,
            email: staff.email,
            phone: staff.phone,
            role: 'staff',
            userType: 'staff',
          },
        };
      }
    }

    console.log('Invalid credentials');
    return { success: false, error: 'Invalid username or password' };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'An error occurred during login' };
  }
}

// Get user by ID from database - queries the correct table based on userType
export async function getUserById(userId, userType) {
  try {
    console.log('getUserById: Looking for user with id:', userId, 'type:', userType);

    // Query the correct table based on userType
    if (userType === 'staff') {
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id, name, email, phone, user_id')
        .eq('id', parseInt(userId))
        .eq('is_active', true)
        .single();

      console.log('getUserById: Staff query result:', { staff, staffError });

      if (staff && !staffError) {
        console.log('getUserById: Staff found with ID:', staff.id, 'parent user_id:', staff.user_id);
        return {
          id: staff.id,
          user_id: staff.user_id, // Parent account ID - used for all data queries
          username: staff.email,
          full_name: staff.name,
          email: staff.email,
          phone: staff.phone,
          role: 'staff',
          userType: 'staff',
        };
      }
    } else if (userType === 'superadmin') {
      const { data: superadmin, error: superadminError } = await supabase
        .from('users')
        .select('id, username, full_name, email, phone, role')
        .eq('id', parseInt(userId))
        .eq('is_active', true)
        .single();

      console.log('getUserById: Superadmin query result:', { superadmin, superadminError });

      if (superadmin && !superadminError) {
        console.log('getUserById: Superadmin found with ID:', superadmin.id);
        return {
          ...superadmin,
          userType: 'superadmin',
        };
      }
    }

    console.log('getUserById: User not found');
    return null;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}
