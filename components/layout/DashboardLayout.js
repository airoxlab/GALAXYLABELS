'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ToastProvider from '@/components/ui/ToastProvider';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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
      } else {
        router.push('/login');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <ToastProvider />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="min-h-screen transition-all duration-300 lg:ml-64">
        {/* Mobile Header - Only shows hamburger menu on mobile */}
        <div className="lg:hidden sticky top-0 z-30 px-4 py-3 bg-white/80 backdrop-blur-xl border-b border-neutral-200/60">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"
          >
            <Menu className="w-5 h-5 text-neutral-700" />
          </button>
        </div>

        {/* Page Content */}
        <main className="p-3 lg:p-4">
          {isLoading ? <PageSkeleton /> : children}
        </main>
      </div>
    </div>
  );
}
