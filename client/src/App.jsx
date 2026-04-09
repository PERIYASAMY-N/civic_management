import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import OTPVerification from './pages/OTPVerification';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import DashboardLayout from './components/DashboardLayout';
import Home from './pages/Home';
import ApprovalPending from './pages/ApprovalPending';
import PublicDashboard from './pages/PublicDashboard';
import { NotificationProvider } from './context/NotificationContext';
import { hasRole, isApproved, normalizeUser } from './utils/userAccess';

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

  return (
    <NotificationProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/public-dashboard" element={<PublicDashboard />} />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<OTPVerification />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/approval-pending" element={
            user ? <ApprovalPending user={user} setUser={setUser} /> : <Navigate to="/login" />
          } />
          <Route path="/dashboard/*" element={
            user ? (
              (hasRole(user.role, ['public', 'admin']) || isApproved(user.status))
                ? <DashboardLayout user={user} setUser={setUser} /> 
                : <Navigate to="/approval-pending" />
            ) : <Navigate to="/login" />
          } />
        </Routes>
      </Router>
    </NotificationProvider>
  );
}

export default App;
