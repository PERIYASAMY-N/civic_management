import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import OTPVerification from './pages/OTPVerification';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MainLayout from './components/MainLayout';
import Home from './pages/Home';
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
      return '/issues';
    case 'DEPT_HEAD':
      return '/assigned-tasks';
    case 'WORKER':
      return '/tasks';
    case 'VOLUNTEER':
      return '/volunteer';
    case 'PUBLIC':
    default:
      return '/public-dashboard';
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
          <Route path="/" element={<Home />} />
          <Route
            path="/public-dashboard"
            element={
              canUseAuthenticatedLayout
                ? (
                  <MainLayout user={user} setUser={setUser}>
                    <PublicDashboard />
                  </MainLayout>
                )
                : <PublicDashboard />
            }
          />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<OTPVerification />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/approval-pending" element={
            user ? <ApprovalPending user={user} setUser={setUser} /> : <Navigate to="/login" />
          } />
          <Route element={
            user ? (
              canUseAuthenticatedLayout
                ? <MainLayout user={user} setUser={setUser} />
                : <Navigate to="/approval-pending" />
            ) : <Navigate to="/login" />
          }>
            <Route path="/issues" element={<AllIssues user={user} />} />
            <Route path="/issues/:id" element={<ComplaintDetails />} />
            <Route path="/report" element={<ReportIssue user={user} />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/tasks" element={<WorkerTasks />} />
            <Route path="/assigned-tasks" element={<DepartmentAssignments user={user} />} />
            <Route path="/volunteer" element={<VolunteerDashboard user={user} />} />
            <Route path="/approvals" element={<AdminOperations />} />
            <Route path="/settings" element={<Settings user={user} setUser={setUser} />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>
          <Route path="*" element={<Navigate to={user ? getDefaultRouteForRole(user.role) : '/'} />} />
        </Routes>
      </Router>
    </NotificationProvider>
  );
}

export default App;
