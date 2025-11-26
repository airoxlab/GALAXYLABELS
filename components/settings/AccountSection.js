'use client';

import { cn } from '@/lib/utils';
import { Save, RefreshCw, Eye, EyeOff } from 'lucide-react';

export default function AccountSection({
  accountData,
  passwordData,
  showCurrentPassword,
  showNewPassword,
  showConfirmPassword,
  savingAccount,
  savingPassword,
  onAccountChange,
  onPasswordChange,
  onSaveAccount,
  onChangePassword,
  onToggleCurrentPassword,
  onToggleNewPassword,
  onToggleConfirmPassword,
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Profile Information</h2>
        <p className="text-xs text-neutral-500 mt-1">Update your account details</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Username</label>
          <input
            type="text"
            value={accountData.username}
            onChange={(e) => onAccountChange('username', e.target.value)}
            placeholder="Username"
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Full Name</label>
          <input
            type="text"
            value={accountData.full_name}
            onChange={(e) => onAccountChange('full_name', e.target.value)}
            placeholder="Full Name"
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Email</label>
          <input
            type="email"
            value={accountData.email}
            onChange={(e) => onAccountChange('email', e.target.value)}
            placeholder="email@example.com"
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Phone</label>
          <input
            type="text"
            value={accountData.phone}
            onChange={(e) => onAccountChange('phone', e.target.value)}
            placeholder="Phone number"
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onSaveAccount}
        disabled={savingAccount}
        className={cn(
          "px-4 py-2 rounded-lg",
          "bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
          "shadow-lg shadow-blue-500/20",
          "text-xs font-medium",
          "hover:from-blue-600 hover:to-indigo-700",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "flex items-center gap-2"
        )}
      >
        {savingAccount ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-3.5 h-3.5" />
            Update Profile
          </>
        )}
      </button>

      {/* Change Password Section */}
      <div className="pt-6 border-t border-neutral-200/60">
        <h2 className="text-sm font-semibold text-neutral-900">Change Password</h2>
        <p className="text-xs text-neutral-500 mt-1">Update your password to keep your account secure</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Current Password</label>
          <div className="relative">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              value={passwordData.current_password}
              onChange={(e) => onPasswordChange('current_password', e.target.value)}
              placeholder="Enter current password"
              className={cn(
                "w-full px-3 py-2 pr-10 text-xs",
                "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                "transition-all duration-200"
              )}
            />
            <button
              type="button"
              onClick={onToggleCurrentPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
            >
              {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">New Password</label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={passwordData.new_password}
              onChange={(e) => onPasswordChange('new_password', e.target.value)}
              placeholder="Enter new password"
              className={cn(
                "w-full px-3 py-2 pr-10 text-xs",
                "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                "transition-all duration-200"
              )}
            />
            <button
              type="button"
              onClick={onToggleNewPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
            >
              {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={passwordData.confirm_password}
              onChange={(e) => onPasswordChange('confirm_password', e.target.value)}
              placeholder="Confirm new password"
              className={cn(
                "w-full px-3 py-2 pr-10 text-xs",
                "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                "transition-all duration-200"
              )}
            />
            <button
              type="button"
              onClick={onToggleConfirmPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
            >
              {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onChangePassword}
        disabled={savingPassword}
        className={cn(
          "px-4 py-2 rounded-lg",
          "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
          "shadow-lg shadow-amber-500/20",
          "text-xs font-medium",
          "hover:from-amber-600 hover:to-orange-700",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "flex items-center gap-2"
        )}
      >
        {savingPassword ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Changing...
          </>
        ) : (
          <>
            <Save className="w-3.5 h-3.5" />
            Change Password
          </>
        )}
      </button>
    </div>
  );
}
