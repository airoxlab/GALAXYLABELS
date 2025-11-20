import jwt from 'jsonwebtoken';
import { supabase } from './supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// Hash password (plain text - no hashing)
export async function hashPassword(password) {
  return password;
}

// Compare password (plain text comparison)
export async function comparePassword(password, storedPassword) {
  return password === storedPassword;
}

// Generate JWT token
export function generateToken(user) {
  console.log('Generating token with JWT_SECRET:', JWT_SECRET);
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  console.log('Token generated:', token.substring(0, 20) + '...');
  return token;
}

// Verify JWT token
export function verifyToken(token) {
  try {
    console.log('verifyToken called with token:', token ? token.substring(0, 20) + '...' : 'null');
    console.log('JWT_SECRET being used:', JWT_SECRET);
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token verified successfully:', decoded);
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

// Login user
export async function loginUser(username, password) {
  try {
    console.log('loginUser called with username:', username);

    // Get user from database
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

    // Compare password
    const isValid = await comparePassword(password, user.password_hash);
    console.log('Password comparison result:', isValid);

    if (!isValid) {
      console.log('Password invalid');
      return { success: false, error: 'Invalid username or password' };
    }

    console.log('Password valid, proceeding with login');

    // Get user permissions
    const { data: permissions } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Generate token
    const token = generateToken(user);

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        permissions: permissions || {},
      },
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'An error occurred during login' };
  }
}

// Get user from token
export async function getUserFromToken(token) {
  const decoded = verifyToken(token);

  if (!decoded) {
    return null;
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, email, role')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return null;
    }

    // Get permissions
    const { data: permissions } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    return {
      ...user,
      permissions: permissions || {},
    };
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}
