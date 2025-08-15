import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CropEntry from './pages/CropEntry';
import ExpenseEntry from './pages/ExpenseEntry';
import ActivityEntry from './pages/ActivityEntry';
import Settings from './pages/Settings';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import './App.css';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  console.log('PrivateRoute: token =', token);
  if (!token) {
    console.log('PrivateRoute: No token, redirecting to login');
    return <Navigate to="/login" />;
  }
  console.log('PrivateRoute: Token found, rendering children');
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <div className="App">
        <OfflineIndicator />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/crops" 
            element={
              <PrivateRoute>
                <CropEntry />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/expenses" 
            element={
              <PrivateRoute>
                <ExpenseEntry />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/activities" 
            element={
              <PrivateRoute>
                <ActivityEntry />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
        <PWAInstallPrompt />
      </div>
    </Router>
  );
}

export default App;
