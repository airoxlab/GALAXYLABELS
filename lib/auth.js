import { supabase } from './supabase';

// Compare password (plain text comparison)
export async function comparePassword(password, storedPassword) {
  return password === storedPassword;
}

// Login user
export async function loginUser(username, password) {
  try {
    console.log('loginUser called with username:', username);

    // Get user from database by username
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    console.log('Database query result:', {
      hasUser: !!user,
      error: error?.message,
      userExists: user ? 'yes' : 'no'
    });

    if (error || !user) {
      console.log('User not found or error:', error);
      return { success: false, error: 'Invalid username or password' };
    }

    console.log('User found, checking password. Stored password:', user.password_hash);

    // Compare password (plain text)
    const isValid = await comparePassword(password, user.password_hash);
    console.log('Password comparison result:', isValid);

    if (!isValid) {
      console.log('Password invalid');
      return { success: false, error: 'Invalid username or password' };
    }

    console.log('Password valid, proceeding with login');

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'An error occurred during login' };
  }
}

// Get user by ID from database
export async function getUserById(userId) {
  try {
    console.log('getUserById: Looking for user with id:', userId);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, email, phone, role')
      .eq('id', parseInt(userId))
      .eq('is_active', true)
      .single();

    console.log('getUserById: Query result:', { user: user ? 'found' : 'not found', error: error?.message });

    if (error || !user) {
      console.log('getUserById: User not found or error:', error?.message);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}
