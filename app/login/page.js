'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { User, Lock, LogIn, Package } from 'lucide-react';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = validateForm();

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (formData.rememberMe) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        window.location.href = '/dashboard';
      } else {
        setErrors({ submit: data.error || 'Login failed' });
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ submit: 'An error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-4">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-2xl p-8",
          "border border-neutral-200/60",
          "shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
        )}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center shadow-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
              TextileERP
            </h1>
            <p className="text-sm text-neutral-500 mt-1">Sign in to your account</p>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className={cn(
              "mb-6 px-4 py-3 rounded-xl",
              "bg-red-50 border border-red-200/60",
              "text-sm text-red-600"
            )}>
              {errors.submit}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <User className="w-5 h-5 text-neutral-400" />
                </div>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5",
                    "bg-white/80 backdrop-blur-sm border rounded-xl",
                    "text-sm placeholder:text-neutral-400",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                    "transition-all duration-200",
                    errors.username
                      ? "border-red-300 focus:ring-red-500/20"
                      : "border-neutral-200/60 hover:border-neutral-300"
                  )}
                />
              </div>
              {errors.username && (
                <p className="mt-1.5 text-xs text-red-500">{errors.username}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Lock className="w-5 h-5 text-neutral-400" />
                </div>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5",
                    "bg-white/80 backdrop-blur-sm border rounded-xl",
                    "text-sm placeholder:text-neutral-400",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                    "transition-all duration-200",
                    errors.password
                      ? "border-red-300 focus:ring-red-500/20"
                      : "border-neutral-200/60 hover:border-neutral-300"
                  )}
                />
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                checked={formData.rememberMe}
                onChange={handleChange}
                className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-neutral-900"
              />
              <label
                htmlFor="rememberMe"
                className="ml-2 text-sm text-neutral-600"
              >
                Remember me
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2.5",
                "bg-neutral-900 text-white rounded-xl",
                "text-sm font-medium",
                "shadow-lg shadow-neutral-900/20",
                "transition-all duration-200",
                "hover:bg-neutral-800 hover:-translate-y-[1px] hover:shadow-xl",
                "active:translate-y-0",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              )}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Default Credentials */}
         
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-neutral-500 mt-6">
          TextileERP Management System - 2030 Edition
        </p>
      </div>
    </div>
  );
}