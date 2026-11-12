import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import { AdminDashboard, EmployeeDashboard } from './pages/DashboardPage';
import ComingSoon from './components/ComingSoon';
import NotFoundPage from './pages/NotFoundPage';
import PolicyPage from './pages/PolicyPage';
import UploadPage from './pages/UploadPage';
import DocumentsPage from './pages/DocumentsPage';
import KnowledgePage from './pages/KnowledgePage';
import EmployeesPage from './pages/EmployeesPage';
import AnalysisPage from './pages/AnalysisPage';
import DocumentWorkspacePage from './pages/DocumentWorkspacePage';
import ReviewQueuePage from './pages/ReviewQueuePage';
import InsightsPage from './pages/InsightsPage';
import './styles/global.css';
import './styles/landing.css';
import './styles/app.css';
import './styles/auth.css';
import './styles/workspace.css';
import './styles/analysis.css';

function AppRoutes() {
  return <Routes>
    <Route path="/" element={<LandingPage/>}/>
    <Route path="/signin" element={<AuthPage/>}/>
    <Route path="/signup" element={<AuthPage mode="signup"/>}/>
    <Route element={<ProtectedRoute role="employee"/>}>
      <Route element={<DashboardLayout role="employee"/>}>
        <Route path="/workspace" element={<EmployeeDashboard/>}/>
        <Route path="/workspace/creator" element={<UploadPage/>}/>
        <Route path="/workspace/review" element={<AnalysisPage/>}/>
        <Route path="/workspace/review/:id" element={<DocumentWorkspacePage/>}/>
        <Route path="/workspace/documents" element={<DocumentsPage/>}/>
        <Route path="/workspace/documents/:id" element={<DocumentsPage/>}/>
        <Route path="/workspace/history" element={<ComingSoon title="Review history"/>}/>
        <Route path="/workspace/settings" element={<ComingSoon title="Account settings"/>}/>
      </Route>
    </Route>
    <Route element={<ProtectedRoute role="admin"/>}>
      <Route element={<DashboardLayout role="admin"/>}>
        <Route path="/admin" element={<AdminDashboard/>}/>
        <Route path="/admin/knowledge" element={<KnowledgePage/>}/>
        <Route path="/admin/employees" element={<EmployeesPage/>}/>
        <Route path="/admin/documents" element={<DocumentsPage role="admin"/>}/>
        <Route path="/admin/documents/:id" element={<DocumentsPage role="admin"/>}/>
        <Route path="/admin/queue" element={<ReviewQueuePage/>}/>
        <Route path="/admin/review" element={<AnalysisPage role="admin"/>}/>
        <Route path="/admin/review/:id" element={<DocumentWorkspacePage role="admin"/>}/>
        <Route path="/admin/insights" element={<InsightsPage/>}/>
        <Route path="/admin/settings" element={<ComingSoon title="Organisation settings"/>}/>
      </Route>
    </Route>
    <Route path="/privacy" element={<PolicyPage/>}/>
    <Route path="/terms" element={<PolicyPage/>}/>
    <Route path="/404" element={<NotFoundPage/>}/>
    <Route path="*" element={<NotFoundPage/>}/>
  </Routes>;
}
export default function App() { return <BrowserRouter><AuthProvider><ToastProvider><AppRoutes/></ToastProvider></AuthProvider></BrowserRouter>; }
