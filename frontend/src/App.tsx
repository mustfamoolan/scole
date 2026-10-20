import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { RegisterInstitutePage } from './pages/RegisterInstitutePage';
import { PlatformLoginPage } from './pages/PlatformLoginPage';
import { InstituteLoginPage } from './pages/InstituteLoginPage';
import { PlatformDashboard } from './pages/PlatformDashboard';
import { TenantDashboard } from './pages/TenantDashboard';
import { StudentMobileApp } from './components/portal/StudentMobileApp';
import { GuardianMobileApp } from './components/portal/GuardianMobileApp';
import { TeacherMobileApp } from './components/portal/TeacherMobileApp';
import { LoadingSpinner } from './components/common';
import { getCurrentTenantSubdomain } from './lib/tenant';

const ProtectedRoute: React.FC<{
  children: React.ReactElement;
  requiredRole?: 'platform_admin' | 'institute_admin';
}> = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="جاري التحقق من الجلسة..." />;
  }

  if (!user) {
    const isTenantDomain = !!getCurrentTenantSubdomain();
    if (isTenantDomain) {
      return <Navigate to="/login" replace />;
    }
    return <Navigate to="/platform/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole && !(requiredRole === 'institute_admin' && user.role === 'staff')) {
    if (user.role === 'platform_admin') {
      return <Navigate to="/platform" replace />;
    }
    return <Navigate to="/tenant" replace />;
  }

  return children;
};

export default function App() {
  const { user, loading } = useAuth();
  const tenantSubdomain = getCurrentTenantSubdomain();

  if (loading) {
    return <LoadingSpinner message="جاري تهيئة المنصة..." />;
  }

  // A. إذا كان الزائر يتصفح رابط/دومين معهد محدد (Subdomain أو Custom Domain):
  // تفتح حصراً صفحة المعهد الخاصة به لتسجيل الدخول ولوحة تحكم معهده وبوابات الطلاب وأولياء الأمور
  if (tenantSubdomain) {
    return (
      <Routes>
        <Route path="/student/*" element={<StudentMobileApp />} />
        <Route path="/guardian/*" element={<GuardianMobileApp />} />
        <Route path="/teacher/*" element={<TeacherMobileApp />} />
        <Route path="/login" element={<InstituteLoginPage />} />
        <Route
          path="/tenant"
          element={
            <ProtectedRoute requiredRole="institute_admin">
              <TenantDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            user ? (
              <Navigate to="/tenant" replace />
            ) : (
              <InstituteLoginPage />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // B. النطاق الرئيسي للمنصة (Main Domain):
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/student/*" element={<StudentMobileApp />} />
      <Route path="/guardian/*" element={<GuardianMobileApp />} />
      <Route path="/teacher/*" element={<TeacherMobileApp />} />
      <Route path="/i/:slug/student/*" element={<StudentMobileApp />} />
      <Route path="/i/:slug/guardian/*" element={<GuardianMobileApp />} />
      <Route path="/i/:slug/teacher/*" element={<TeacherMobileApp />} />
      <Route path="/institute/:slug/student/*" element={<StudentMobileApp />} />
      <Route path="/institute/:slug/guardian/*" element={<GuardianMobileApp />} />
      <Route path="/institute/:slug/teacher/*" element={<TeacherMobileApp />} />
      <Route path="/login" element={<InstituteLoginPage />} />
      <Route path="/i/:slug" element={<InstituteLoginPage />} />
      <Route path="/institute/:slug" element={<InstituteLoginPage />} />
      <Route path="/register" element={<RegisterInstitutePage />} />
      <Route path="/platform/login" element={<PlatformLoginPage />} />
      <Route path="/admin/login" element={<Navigate to="/platform/login" replace />} />
      <Route
        path="/platform"
        element={
          <ProtectedRoute requiredRole="platform_admin">
            <PlatformDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tenant"
        element={
          <ProtectedRoute requiredRole="institute_admin">
            <TenantDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

