"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
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

const menuItems = [
  {
    title: "Dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
    href: "/dashboard",
  },
  {
    title: "Sales",
    icon: <Receipt className="w-5 h-5" />,
    href: "/sales",
    subItems: [
      { title: "New Sale Order", href: "/sales/sale-order", icon: <Receipt className="w-4 h-4" /> },
      { title: "Sales Order History", href: "/sales", icon: <ClipboardList className="w-4 h-4" /> },
      { title: "Sale Invoice", href: "/sales/sale-invoice", icon: <FileText className="w-4 h-4" /> },
      { title: "Invoice History", href: "/sales/invoice-history", icon: <History className="w-4 h-4" /> },
    ],
  },
  {
    title: "Purchases",
    icon: <ShoppingCart className="w-5 h-5" />,
    href: "/purchases",
    subItems: [
      { title: "New Purchase Order", href: "/purchases/purchase-order", icon: <Plus className="w-4 h-4" /> },
      { title: "Purchase History", href: "/purchases", icon: <ClipboardList className="w-4 h-4" /> },
    ],
  },
  {
    title: "Products",
    icon: <Package className="w-5 h-5" />,
    href: "/products",
  },
  {
    title: "Customers",
    icon: <Users className="w-5 h-5" />,
    href: "/customers",
  },
  {
    title: "Suppliers",
    icon: <Building2 className="w-5 h-5" />,
    href: "/suppliers",
  },
  {
    title: "Stock",
    icon: <Archive className="w-5 h-5" />,
    href: "/stock",
    subItems: [
      { title: "Stock In", href: "/stock/in", icon: <ArrowDownToLine className="w-4 h-4" /> },
      { title: "Stock Out", href: "/stock/out", icon: <ArrowUpFromLine className="w-4 h-4" /> },
      { title: "Stock Availability", href: "/stock/availability", icon: <BarChart3 className="w-4 h-4" /> },
      { title: "Low Stock", href: "/stock/low-stock", icon: <AlertTriangle className="w-4 h-4" /> },
    ],
  },
  {
    title: "Warehouses",
    icon: <Warehouse className="w-5 h-5" />,
    href: "/warehouses",
  },
  {
    title: "Payments",
    icon: <DollarSign className="w-5 h-5" />,
    href: "/payments",
    subItems: [
      { title: "Payment In", href: "/payments/in", icon: <ArrowDownRight className="w-4 h-4" /> },
      { title: "Payment Out", href: "/payments/out", icon: <ArrowUpRight className="w-4 h-4" /> },
      { title: "Payment History", href: "/payments/history", icon: <History className="w-4 h-4" /> },
    ],
  },
  {
    title: "Ledgers",
    icon: <BookOpen className="w-5 h-5" />,
    href: "/ledgers",
    subItems: [
      { title: "Customer Ledger", href: "/ledgers/customer", icon: <Users className="w-4 h-4" /> },
      { title: "Supplier Ledger", href: "/ledgers/supplier", icon: <Building2 className="w-4 h-4" /> },
    ],
  },
  {
    title: "Expenses",
    icon: <CreditCard className="w-5 h-5" />,
    href: "/expenses",
  },
  {
    title: "Reports",
    icon: <FileText className="w-5 h-5" />,
    href: "/reports",
  },
  {
    title: "Settings",
    icon: <Settings className="w-5 h-5" />,
    href: "/settings",
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedMenus, setExpandedMenus] = useState({});

  // Auto-expand submenus when a submenu page is active
  useEffect(() => {
    menuItems.forEach((item) => {
      if (item.subItems) {
        const isSubItemActive = item.subItems.some(
          (subItem) => pathname === subItem.href || pathname?.startsWith(subItem.href + '/')
        );
        if (isSubItemActive) {
          setExpandedMenus((prev) => ({
            ...prev,
            [item.title]: true,
          }));
        }
      }
    });
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login');
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
          "bg-white/70 backdrop-blur-xl border-r border-neutral-200/60",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col relative overflow-hidden">
          {/* Logo Section */}
          <div className="py-6 px-4 border-b border-neutral-200/60">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center shadow-lg">
                  <Package className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-[15px] font-semibold text-neutral-900 tracking-tight">TextileERP</h1>
                <p className="text-xs text-neutral-500">Management System</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide">
            <div className="flex flex-col gap-1">
              {menuItems.map((item) => {
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isExpanded = expandedMenus[item.title];
                const isItemActive = isActive(item.href);

                return (
                  <div key={item.title}>
                    {hasSubItems ? (
                      <button
                        onClick={() => toggleMenu(item.title)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-4 py-2 rounded-xl transition-all duration-200",
                          isItemActive
                            ? "bg-neutral-900 text-white shadow-lg"
                            : "text-neutral-700 hover:bg-neutral-100/70"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "transition-colors",
                            isItemActive ? "text-white" : "text-neutral-500"
                          )}>
                            {item.icon}
                          </span>
                          <span className="text-[15px] font-medium">
                            {item.title}
                          </span>
                        </div>
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 transition-transform duration-200",
                            isExpanded ? "rotate-180" : "",
                            isItemActive ? "text-white" : "text-neutral-400"
                          )}
                        />
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => {
                          if (window.innerWidth < 1024) {
                            onClose();
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200",
                          isItemActive
                            ? "bg-neutral-900 text-white shadow-lg"
                            : "text-neutral-700 hover:bg-neutral-100/70"
                        )}
                      >
                        <span className={cn(
                          "transition-colors",
                          isItemActive ? "text-white" : "text-neutral-500"
                        )}>
                          {item.icon}
                        </span>
                        <span className="text-[15px] font-medium">{item.title}</span>
                      </Link>
                    )}

                    {/* Sub-menu items */}
                    {hasSubItems && isExpanded && (
                      <div className="ml-4 mt-1 space-y-0.5">
                        {item.subItems.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            onClick={() => {
                              if (window.innerWidth < 1024) {
                                onClose();
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 pl-9 rounded-xl text-sm transition-all duration-200",
                              pathname === subItem.href
                                ? "bg-neutral-200/80 text-neutral-900 font-medium"
                                : "text-neutral-500 hover:bg-neutral-100/70 hover:text-neutral-700"
                            )}
                          >
                            {subItem.icon && <span className={pathname === subItem.href ? "text-neutral-700" : ""}>{subItem.icon}</span>}
                            {subItem.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-neutral-200/60">
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl",
                "bg-neutral-100/80 hover:bg-neutral-200/80",
                "text-neutral-600 hover:text-neutral-900",
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