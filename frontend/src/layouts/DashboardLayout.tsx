import React, { useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LucideIcon, Menu, X, LogOut, Shield, Building2 } from 'lucide-react';

import { buildTenantUrl, getCurrentTenantSubdomain } from '../lib/tenant';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number | string;
  active: boolean;
  onClick: () => void;
}

export interface DashboardLayoutProps {
  brandTitle?: string;
  brandSubtitle?: string;
  brandIcon?: LucideIcon;
  navSectionTitle?: string;
  navItems: DashboardNavItem[];
  currentBreadcrumb: string;
  headerActions?: ReactNode;
  roleBadgeText?: string;
  children: ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  brandTitle = 'منصة FiStudy',
  brandSubtitle = 'الإدارة المركزية',
  brandIcon: BrandIcon = Building2,
  navSectionTitle = 'أقسام المنظومة',
  navItems,
  currentBreadcrumb,
  headerActions,
  roleBadgeText = 'أدمن المنصة',
  children,
}) => {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    const isPlatform = user?.role === 'platform_admin';
    const tenantSlug = tenant?.slug || getCurrentTenantSubdomain();
    try {
      await logout();
    } catch {
      // ignore
    } finally {
      if (isPlatform) {
        navigate('/platform/login');
      } else if (tenantSlug) {
        window.location.href = buildTenantUrl(tenantSlug, '/login');
      } else {
        navigate('/login');
      }
    }
  };

  const SidebarContent = () => (
    <>
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3 min-w-0">
          {tenant?.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={brandTitle}
              className="h-9 w-9 rounded-lg object-cover ring-1 ring-border shadow-xs shrink-0 bg-background"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs shrink-0">
              <BrandIcon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <span className="font-bold text-sm tracking-tight text-foreground block truncate">{brandTitle}</span>
            <span className="text-[11px] font-medium text-muted-foreground block -mt-0.5 truncate">{brandSubtitle}</span>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex flex-1 flex-col gap-1.5 p-3 overflow-y-auto">
        <p className="px-3 pb-1 pt-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">
          {navSectionTitle}
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between rounded-md px-3 py-2.5 text-xs font-semibold transition-all ${
                item.active
                  ? 'bg-secondary font-bold text-primary shadow-xs'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 shrink-0 ${item.active ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && (
                <Badge variant={item.active ? 'default' : 'secondary'} className="text-[10px] h-4.5 px-1.5 font-bold">
                  {item.count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* User Footer Profile */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-md px-3 py-2 bg-secondary/40">
          <Avatar className="h-8 w-8 ring-1 ring-border">
            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-xs font-bold truncate text-foreground">{user?.name || 'مستخدم النظام'}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email || ''}</p>
          </div>
          <button
            onClick={handleLogout}
            title="تسجيل الخروج"
            className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground font-['Cairo',sans-serif]" dir="rtl">
      {/* 1. Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:right-0 lg:w-60 border-l border-border bg-background z-20">
        <SidebarContent />
      </aside>

      {/* 2. Mobile Sidebar Overlay & Drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-64 flex flex-col border-l border-border bg-background transform transition-transform duration-200 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="font-bold text-sm">القائمة الرئيسية</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* 3. Main View Area */}
      <div className="flex flex-1 flex-col min-w-0 lg:pr-60">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur-md px-4 lg:px-6 justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              className="lg:hidden text-muted-foreground hover:text-foreground p-1"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>لوحة التحكم</span>
              <span>/</span>
              <span className="font-bold text-foreground">{currentBreadcrumb}</span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {headerActions}

            {headerActions && <Separator orientation="vertical" className="h-5 hidden sm:block" />}

            {roleBadgeText && (
              <div className="hidden sm:flex items-center gap-2">
                <Badge variant="outline" className="text-[11px] gap-1 font-bold border-primary/20 text-primary bg-primary/5">
                  <Shield className="h-3 w-3" />
                  {roleBadgeText}
                </Badge>
              </div>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 lg:p-6 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
};
