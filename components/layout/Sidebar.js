"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Home,
  Receipt,
  ShoppingCart,
  Package,
  Users,
  Building2,
  Archive,
  Warehouse,
  DollarSign,
  CreditCard,
  Settings,
  FileText,
  ClipboardList,
  History,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  AlertTriangle,
  BookOpen,
} from "lucide-react";

// Icon mapping for consistent rendering
const menuIcons = {
  Dashboard: <LayoutDashboard className="w-5 h-5" />,
  Sales: <Receipt className="w-5 h-5" />,
  Purchases: <ShoppingCart className="w-5 h-5" />,
  Products: <Package className="w-5 h-5" />,
  Customers: <Users className="w-5 h-5" />,
  Suppliers: <Building2 className="w-5 h-5" />,
  Stock: <Archive className="w-5 h-5" />,
  Warehouses: <Warehouse className="w-5 h-5" />,
  Payments: <DollarSign className="w-5 h-5" />,
  Ledgers: <BookOpen className="w-5 h-5" />,
  Expenses: <CreditCard className="w-5 h-5" />,
  Reports: <FileText className="w-5 h-5" />,
  Settings: <Settings className="w-5 h-5" />,
};

const subMenuIcons = {
  "New Sale Order": <Receipt className="w-4 h-4" />,
  "Sales Order History": <ClipboardList className="w-4 h-4" />,
  "New Purchase Order": <Plus className="w-4 h-4" />,
  "Purchase History": <ClipboardList className="w-4 h-4" />,
  "Stock In": <ArrowDownToLine className="w-4 h-4" />,
  "Stock Out": <ArrowUpFromLine className="w-4 h-4" />,
  "Stock Availability": <BarChart3 className="w-4 h-4" />,
  "Low Stock": <AlertTriangle className="w-4 h-4" />,
  "Payment In": <ArrowDownRight className="w-4 h-4" />,
  "Payment Out": <ArrowUpRight className="w-4 h-4" />,
  "Payment History": <History className="w-4 h-4" />,
  "Customer Ledger": <Users className="w-4 h-4" />,
  "Supplier Ledger": <Building2 className="w-4 h-4" />,
};

// Menu items with permission requirements
const getMenuItems = (hasPermission) => [
  {
    title: "Dashboard",
    icon: menuIcons.Dashboard,
    href: "/dashboard",
    // Dashboard is always visible
  },
  {
    title: "Sales",
    icon: <Receipt className="w-5 h-5" />,
    href: "/sales",
    permission: () => hasPermission('sales_order_view') || hasPermission('sales_invoice_view'),
    subItems: [
      {
        title: "New Sale Order",
        href: "/sales/sale-order",
        icon: <Receipt className="w-4 h-4" />,
        permission: () => hasPermission('sales_order_view')
      },
      {
        title: "Sales Order History",
        href: "/sales",
        icon: <ClipboardList className="w-4 h-4" />,
        permission: () => hasPermission('sales_invoice_view')
      },
    ],
  },
  {
    title: "Purchases",
    icon: <ShoppingCart className="w-5 h-5" />,
    href: "/purchases",
    permission: () => hasPermission('purchase_order_view') || hasPermission('purchase_view'),
    subItems: [
      {
        title: "New Purchase Order",
        href: "/purchases/purchase-order",
        icon: <Plus className="w-4 h-4" />,
        permission: () => hasPermission('purchase_order_view')
      },
      {
        title: "Purchase History",
        href: "/purchases",
        icon: <ClipboardList className="w-4 h-4" />,
        permission: () => hasPermission('purchase_view')
      },
    ],
  },
  {
    title: "Products",
    icon: <Package className="w-5 h-5" />,
    href: "/products",
    permission: () => hasPermission('products_view'),
  },
  {
    title: "Customers",
    icon: <Users className="w-5 h-5" />,
    href: "/customers",
    permission: () => hasPermission('customers_view'),
  },
  {
    title: "Suppliers",
    icon: <Building2 className="w-5 h-5" />,
    href: "/suppliers",
    permission: () => hasPermission('suppliers_view'),
  },
  {
    title: "Stock",
    icon: <Archive className="w-5 h-5" />,
    href: "/stock",
    permission: () => hasPermission('stock_in_view') || hasPermission('stock_out_view') || hasPermission('stock_availability_view') || hasPermission('low_stock_view'),
    subItems: [
      {
        title: "Stock In",
        href: "/stock/in",
        icon: <ArrowDownToLine className="w-4 h-4" />,
        permission: () => hasPermission('stock_in_view')
      },
      {
        title: "Stock Out",
        href: "/stock/out",
        icon: <ArrowUpFromLine className="w-4 h-4" />,
        permission: () => hasPermission('stock_out_view')
      },
      {
        title: "Stock Availability",
        href: "/stock/availability",
        icon: <BarChart3 className="w-4 h-4" />,
        permission: () => hasPermission('stock_availability_view')
      },
      {
        title: "Low Stock",
        href: "/stock/low-stock",
        icon: <AlertTriangle className="w-4 h-4" />,
        permission: () => hasPermission('low_stock_view')
      },
    ],
  },
  {
    title: "Warehouses",
    icon: <Warehouse className="w-5 h-5" />,
    href: "/warehouses",
    permission: () => hasPermission('warehouses_view'),
  },
  {
    title: "Payments",
    icon: <DollarSign className="w-5 h-5" />,
    href: "/payments",
    permission: () => hasPermission('payment_in_view') || hasPermission('payment_out_view') || hasPermission('payment_history_view'),
    subItems: [
      {
        title: "Payment In",
        href: "/payments/in",
        icon: <ArrowDownRight className="w-4 h-4" />,
        permission: () => hasPermission('payment_in_view')
      },
      {
        title: "Payment Out",
        href: "/payments/out",
        icon: <ArrowUpRight className="w-4 h-4" />,
        permission: () => hasPermission('payment_out_view')
      },
      {
        title: "Payment History",
        href: "/payments/history",
        icon: <History className="w-4 h-4" />,
        permission: () => hasPermission('payment_history_view')
      },
    ],
  },
  {
    title: "Ledgers",
    icon: <BookOpen className="w-5 h-5" />,
    href: "/ledgers",
    permission: () => hasPermission('customer_ledger_view') || hasPermission('supplier_ledger_view'),
    subItems: [
      {
        title: "Customer Ledger",
        href: "/ledgers/customer",
        icon: <Users className="w-4 h-4" />,
        permission: () => hasPermission('customer_ledger_view')
      },
      {
        title: "Supplier Ledger",
        href: "/ledgers/supplier",
        icon: <Building2 className="w-4 h-4" />,
        permission: () => hasPermission('supplier_ledger_view')
      },
    ],
  },
  {
    title: "Expenses",
    icon: <CreditCard className="w-5 h-5" />,
    href: "/expenses",
    permission: () => hasPermission('expenses_view'),
  },
  {
    title: "Reports",
    icon: <FileText className="w-5 h-5" />,
    href: "/reports",
    permission: () => hasPermission('reports_view'),
  },
  {
    title: "Settings",
    icon: <Settings className="w-5 h-5" />,
    href: "/settings",
    permission: () => hasPermission('settings_view'),
  },
];

// Default menu items for initial render (all authorized, will be updated after auth loads)
const getDefaultMenuItems = () => getMenuItems(() => true).map(item => ({
  ...item,
  isAuthorized: true,
  visibleSubItems: item.subItems || []
}));

export default function Sidebar({ isOpen, onClose, companySettings }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { hasPermission, isSuperadmin, permissions } = usePermissions();
  const [expandedMenus, setExpandedMenus] = useState({});
  // Initialize with default menu items to prevent flashing empty sidebar
  const [visibleMenuItems, setVisibleMenuItems] = useState(() => {
    // Try to get cached menu from sessionStorage for instant render
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('sidebarMenuCache');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          // Invalid cache, use defaults
        }
      }
    }
    return getDefaultMenuItems();
  });
  const hasInitialized = useRef(false);

  // Calculate menu items when auth state changes
  useEffect(() => {
    // Don't recalculate if still loading, unless we haven't initialized yet
    if (loading && hasInitialized.current) {
      return;
    }

    // Get menu items with permission filtering
    const menuItems = getMenuItems(hasPermission);

    // Process menu items - show all but mark unauthorized ones
    const processedItems = menuItems.map(item => {
      // Always allow Dashboard
      if (!item.permission) {
        return { ...item, isAuthorized: true, visibleSubItems: item.subItems || [] };
      }

      // Check if user has permission
      const isAuthorized = item.permission ? item.permission() : true;

      // If has subitems, filter them
      let visibleSubItems = [];
      if (item.subItems) {
        visibleSubItems = item.subItems.filter(subItem => {
          if (!subItem.permission) return true;
          return subItem.permission();
        });
      }

      return { ...item, isAuthorized, visibleSubItems };
    });

    setVisibleMenuItems(processedItems);
    hasInitialized.current = true;

    // Cache menu items for instant render on next navigation
    if (typeof window !== 'undefined' && !loading) {
      // Store a simplified version (without functions) for caching
      const cacheableItems = processedItems.map(item => ({
        title: item.title,
        href: item.href,
        isAuthorized: item.isAuthorized,
        visibleSubItems: (item.visibleSubItems || []).map(sub => ({
          title: sub.title,
          href: sub.href
        }))
      }));
      sessionStorage.setItem('sidebarMenuCache', JSON.stringify(cacheableItems));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin, permissions, loading]);

  // Auto-expand submenus when a submenu page is active - only run on pathname change
  useEffect(() => {
    // Find which parent menu should be expanded based on current pathname
    const menuItems = getMenuItems(() => true);
    menuItems.forEach((item) => {
      if (item.subItems && item.subItems.length > 0) {
        const isSubItemActive = item.subItems.some(
          (subItem) => pathname === subItem.href || pathname?.startsWith(subItem.href + '/')
        );
        if (isSubItemActive && !expandedMenus[item.title]) {
          setExpandedMenus((prev) => ({ ...prev, [item.title]: true }));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = async () => {
    try {
      // Clear all cached data before logout
      sessionStorage.removeItem('authUserCache');
      sessionStorage.removeItem('authUserTypeCache');
      sessionStorage.removeItem('authPermissionsCache');
      sessionStorage.removeItem('sidebarMenuCache');
      localStorage.removeItem('companySettings');

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        // Force a hard reload to clear all state
        window.location.href = '/login';
      } else {
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect even if there's an error
      window.location.href = '/login';
    }
  };

  const isActive = (href) => {
    if (href === "/dashboard") {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  const toggleMenu = (title) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen transition-all duration-300 lg:translate-x-0 w-64",
          "bg-gradient-to-b from-slate-50 via-white to-slate-50/80 backdrop-blur-xl border-r border-slate-200/60",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col relative overflow-hidden">
          {/* Logo Section */}
          <div className="py-4 px-4 border-b border-slate-200/60 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-neutral-800 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-slate-800 tracking-wide truncate">
                  {companySettings?.company_name || 'Company Name'}
                </h1>
                {user?.email && (
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide">
            <div className="flex flex-col gap-0.5">
              {visibleMenuItems.map((item) => {
                const hasSubItems = item.visibleSubItems && item.visibleSubItems.length > 0;
                const isExpanded = expandedMenus[item.title];
                const isItemActive = isActive(item.href);
                // Always get icon from mapping to handle cached items without icons
                const itemIcon = menuIcons[item.title] || item.icon;

                return (
                  <div key={item.title}>
                    {hasSubItems ? (
                      <button
                        onClick={() => item.isAuthorized && toggleMenu(item.title)}
                        disabled={!item.isAuthorized}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                          !item.isAuthorized && "opacity-60 cursor-not-allowed",
                          isItemActive
                            ? "bg-gradient-to-r from-neutral-800 to-neutral-900 text-white shadow-md shadow-neutral-500/20"
                            : "text-slate-600 hover:bg-slate-100/80"
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className={cn(
                            "transition-colors flex-shrink-0",
                            isItemActive ? "text-white" : "text-slate-400"
                          )}>
                            {itemIcon}
                          </span>
                          <div className="flex flex-col items-start flex-1 min-w-0">
                            <span className="text-sm font-medium">
                              {item.title}
                            </span>
                            {!item.isAuthorized && (
                              <span className="text-xs text-red-500 font-normal">
                                Not Authorized
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 transition-transform duration-200 flex-shrink-0",
                            isExpanded ? "rotate-180" : "",
                            isItemActive ? "text-white" : "text-slate-400"
                          )}
                        />
                      </button>
                    ) : (
                      item.isAuthorized ? (
                        <Link
                          href={item.href}
                          onClick={() => {
                            if (window.innerWidth < 1024) {
                              onClose();
                            }
                          }}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                            isItemActive
                              ? "bg-gradient-to-r from-neutral-800 to-neutral-900 text-white shadow-md shadow-neutral-500/20"
                              : "text-slate-600 hover:bg-slate-100/80"
                          )}
                        >
                          <span className={cn(
                            "transition-colors",
                            isItemActive ? "text-white" : "text-slate-400"
                          )}>
                            {itemIcon}
                          </span>
                          <span className="text-sm font-medium">{item.title}</span>
                        </Link>
                      ) : (
                        <div
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 opacity-60 cursor-not-allowed",
                            "text-slate-600"
                          )}
                        >
                          <span className="transition-colors text-slate-400">
                            {itemIcon}
                          </span>
                          <div className="flex flex-col items-start flex-1">
                            <span className="text-sm font-medium">{item.title}</span>
                            <span className="text-xs text-red-500">
                              Not Authorized
                            </span>
                          </div>
                        </div>
                      )
                    )}

                    {/* Sub-menu items */}
                    {hasSubItems && isExpanded && (
                      <div className="ml-3 mt-0.5 space-y-0.5">
                        {item.visibleSubItems.map((subItem) => {
                          const subIcon = subMenuIcons[subItem.title] || subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 pl-9 rounded-lg text-sm transition-all duration-200",
                                pathname === subItem.href
                                  ? "bg-neutral-100 text-neutral-900 font-medium"
                                  : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-700"
                              )}
                            >
                              {subIcon && <span className={pathname === subItem.href ? "text-neutral-700" : ""}>{subIcon}</span>}
                              {subItem.title}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="px-3 py-3 border-t border-slate-200/60 bg-gradient-to-r from-slate-50/50 to-white">
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg",
                "bg-slate-100/80 hover:bg-rose-50",
                "text-slate-600 hover:text-rose-600",
                "transition-all duration-200",
                "text-sm font-medium"
              )}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}