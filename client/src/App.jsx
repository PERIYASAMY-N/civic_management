import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import OTPVerification from './pages/OTPVerification';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MainLayout from './components/MainLayout';
import PublicLayout from './components/PublicLayout';
import ApprovalPending from './pages/ApprovalPending';
import PublicDashboard from './pages/PublicDashboard';
import AllIssues from './pages/AllIssues';
import ReportIssue from './pages/ReportIssue';
import Analytics from './pages/Analytics';
import WorkerTasks from './pages/WorkerTasks';
import DepartmentAssignments from './pages/DepartmentAssignments';
import VolunteerDashboard from './pages/VolunteerDashboard';
import AdminOperations from './pages/AdminOperations';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import ComplaintDetails from './pages/ComplaintDetails';
import { NotificationProvider } from './context/NotificationContext';
import { hasRole, isApproved, normalizeRole, normalizeUser } from './utils/userAccess';

const getDefaultRouteForRole = (role) => {
  switch (normalizeRole(role)) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'DEPT_HEAD':
      return '/department/dashboard';
    case 'WORKER':
      return '/worker/dashboard';
    case 'VOLUNTEER':
      return '/volunteer/dashboard';
    case 'PUBLIC':
    default:
      return '/public/dashboard';
  }
};

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        return normalizeUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }
    return null;
  });

  const canUseAuthenticatedLayout = user
    && (hasRole(user.role, ['public', 'admin']) || isApproved(user.status));

  return (
    <NotificationProvider>
      <Router>
        <Routes>
          {/* 
            ==================================================
            PUBLIC ROUTING TREE
            ==================================================
            These routes NEVER check user or role. 
            They always render strictly inside PublicLayout.
          */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Login setUser={setUser} />} />
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-otp" element={<OTPVerification />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/public-dashboard" element={<Navigate to="/public/dashboard" replace />} />
            <Route path="/public/dashboard" element={<PublicDashboard />} />
          </Route>

          {/* 
            ==================================================
            PROTECTED ROUTING TREE
            ==================================================
            These routes ALWAYS require authentication.
            If logged in and approved, they render inside MainLayout (ProtectedLayout).
          */}
          <Route element={
            user ? (
              canUseAuthenticatedLayout
                ? <MainLayout user={user} setUser={setUser} />
                : <Navigate to="/approval-pending" />
            ) : (
              <Navigate to="/login" state={{ message: 'Please login to access protected pages.' }} />
            )
          }>
            <Route path="/issues" element={<AllIssues user={user} />} />
            <Route path="/issues/:id" element={<ComplaintDetails />} />
            <Route path="/report-issue" element={<Navigate to="/report" replace />} />
            <Route path="/report" element={<ReportIssue user={user} />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/worker/dashboard" element={<WorkerTasks />} />
            <Route path="/department/dashboard" element={<DepartmentAssignments user={user} />} />
            <Route path="/volunteer/dashboard" element={<VolunteerDashboard user={user} />} />
            <Route path="/admin/dashboard" element={<AdminOperations />} />
            <Route path="/settings" element={<Settings user={user} setUser={setUser} />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>

          {/* Special case: Approval Pending page (no sidebar) */}
          <Route path="/approval-pending" element={
            user ? <ApprovalPending user={user} setUser={setUser} /> : <Navigate to="/login" />
          } />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to={user ? getDefaultRouteForRole(user.role) : '/'} />} />
        </Routes>
      </Router>
    </NotificationProvider>
  );
}

export default App;
