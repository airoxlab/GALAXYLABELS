'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import ToastProvider from '@/components/ui/ToastProvider';
import { Menu } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [companySettings, setCompanySettings] = useState(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('companySettings');
      return cached ? JSON.parse(cached) : null;
    }
    return null;
  });

  // Check if we're on the settings page to hide the sidebar completely
  // Use useMemo to ensure consistent value during SSR and client render
  const isSettingsPage = useMemo(() => pathname?.startsWith('/settings'), [pathname]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        // Only fetch settings if not cached
        const cachedSettings = localStorage.getItem('companySettings');
        if (!cachedSettings) {
          const { data: settings } = await supabase
            .from('settings')
            .select('company_name, email_1')
            .eq('user_id', data.user.id)
            .single();

          if (settings) {
            setCompanySettings(settings);
            localStorage.setItem('companySettings', JSON.stringify(settings));
          }
        }
      } else {
        router.push('/login');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <ToastProvider />

      {/* Only render sidebar if NOT on settings page, or if sidebar is open */}
      {(!isSettingsPage || isSidebarOpen) && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          companySettings={companySettings}
          isCollapsed={false}
          isHiddenOnDesktop={isSettingsPage}
        />
      )}

      {/* Main Content Area */}
      <div className={cn(
        "min-h-screen transition-all duration-300",
        // No left margin on settings page since sidebar is hidden
        isSettingsPage ? "lg:ml-0" : "lg:ml-64"
      )}>
        {/* Header with hamburger - shows on mobile always, and on desktop for settings page */}
        <div className={cn(
          "sticky top-0 z-30 px-4 py-3 bg-white/80 backdrop-blur-xl border-b border-neutral-200/60",
          // On settings page, always show the header. Otherwise, only on mobile
          isSettingsPage ? "block" : "lg:hidden"
        )}>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"
          >
            <Menu className="w-5 h-5 text-neutral-700" />
          </button>
        </div>

        {/* Page Content */}
        <main className="p-3 lg:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
