import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, School, Shield, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, tenant, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg flex items-center justify-center">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900 leading-tight">منصة إدارة المعاهد</h1>
            {tenant ? (
              <span className="text-xs text-indigo-600 font-medium">{tenant.name}</span>
            ) : user?.role === 'platform_admin' ? (
              <span className="text-xs text-emerald-600 font-medium">لوحة التحكم المركزية للمنصة</span>
            ) : null}
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-xs text-slate-700">
              {user.role === 'platform_admin' ? (
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span className="font-semibold">{user.name}</span>
              <span className="text-slate-400">|</span>
              <span>{user.role === 'platform_admin' ? 'مدير المنصة' : 'مدير معهد'}</span>
            </div>

            <button
              onClick={async () => {
                const isPlatform = user.role === 'platform_admin';
                const tenantSlug = tenant?.slug;
                await logout();
                if (isPlatform) {
                  window.location.href = '/platform/login';
                } else if (tenantSlug) {
                  window.location.href = `/login?slug=${tenantSlug}`;
                } else {
                  window.location.href = '/login';
                }
              }}
              className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium transition"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'جاري التحميل...' }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
    <p className="mt-4 text-sm font-medium text-slate-600">{message}</p>
  </div>
);

export const ErrorAlert: React.FC<{ message: string; requestId?: string; onDismiss?: () => void }> = ({
  message,
  requestId,
  onDismiss,
}) => (
  <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start justify-between gap-3 my-4">
    <div>
      <h3 className="font-semibold text-sm">حدث خطأ</h3>
      <p className="text-sm mt-0.5">{message}</p>
      {requestId && (
        <p className="text-xs text-red-500 mt-1 font-mono">
          معرّف الطلب (Request ID): {requestId}
        </p>
      )}
    </div>
    {onDismiss && (
      <button onClick={onDismiss} className="text-red-400 hover:text-red-600 text-sm font-bold">
        ✕
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{ title: string; description: string; actionLabel?: string; onAction?: () => void }> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="text-center py-12 px-4 bg-white rounded-xl border border-dashed border-slate-300 my-4">
    <div className="mx-auto w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3">
      📁
    </div>
    <h3 className="text-sm font-bold text-slate-800">{title}</h3>
    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export * from './common/DataGrid';
export * from './common/AppModal';
