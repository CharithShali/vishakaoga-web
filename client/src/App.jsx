import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireRole from './components/RequireRole.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import CommitteePage from './pages/CommitteePage.jsx';
import CardPage from './pages/CardPage.jsx';
import EventsPage from './pages/EventsPage.jsx';
import EventPage from './pages/EventPage.jsx';
import EventFormPage from './pages/EventFormPage.jsx';
import ScanPage from './pages/ScanPage.jsx';
import FundsPage from './pages/FundsPage.jsx';
import RecordMoneyPage from './pages/RecordMoneyPage.jsx';
import FeesPage from './pages/FeesPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import MemberDetailPage from './pages/MemberDetailPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import { ROLES, MANAGE_EVENT_ROLES, CHECKIN_ROLES } from './auth/permissions.js';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="card"
          element={
            <RequireRole>
              <CardPage />
            </RequireRole>
          }
        />
        <Route
          path="committee"
          element={
            <RequireRole roles={ROLES}>
              <CommitteePage />
            </RequireRole>
          }
        />
        <Route path="events" element={<EventsPage />} />
        <Route
          path="events/new"
          element={
            <RequireRole roles={MANAGE_EVENT_ROLES}>
              <EventFormPage />
            </RequireRole>
          }
        />
        <Route path="events/:id" element={<EventPage />} />
        <Route
          path="events/:id/edit"
          element={
            <RequireRole roles={MANAGE_EVENT_ROLES}>
              <EventFormPage />
            </RequireRole>
          }
        />
        <Route
          path="events/:id/scan"
          element={
            <RequireRole roles={CHECKIN_ROLES}>
              <ScanPage />
            </RequireRole>
          }
        />
        <Route
          path="funds"
          element={
            <RequireRole>
              <FundsPage />
            </RequireRole>
          }
        />
        <Route
          path="funds/record"
          element={
            <RequireRole roles={['treasurer']}>
              <RecordMoneyPage />
            </RequireRole>
          }
        />
        <Route
          path="funds/record/:id"
          element={
            <RequireRole roles={['treasurer']}>
              <RecordMoneyPage />
            </RequireRole>
          }
        />
        <Route
          path="committee/fees"
          element={
            <RequireRole roles={['secretary', 'treasurer']}>
              <FeesPage />
            </RequireRole>
          }
        />
        <Route
          path="committee/members/:id"
          element={
            <RequireRole roles={['secretary', 'treasurer']}>
              <MemberDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="notifications"
          element={
            <RequireRole>
              <NotificationsPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
