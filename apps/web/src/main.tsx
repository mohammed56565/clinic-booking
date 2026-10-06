import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { AuthProvider, landing, useAuth } from "./context";
import { ToastProvider, Empty, Loading } from "./ui";
import { Shell } from "./shell";
import { AuthPage, ProfilePage } from "./auth-pages";
import { BookingPage, DoctorDetail, DoctorsPage } from "./patient";
import { AppointmentDetail, AppointmentsPage, Dashboard } from "./appointments";
import {
  AdminDoctors,
  AvailabilityPage,
  CatalogPage,
  UsersPage,
} from "./admin";
import "./styles.css";
const CalendarPage = lazy(() => import("./calendar"));
function Guard({ roles }: { roles?: string[] }) {
  const { user } = useAuth();
  return !user ? (
    <Navigate to="/login" replace />
  ) : roles && !roles.includes(user.role) ? (
    <Empty title="You do not have permission to access this page" />
  ) : (
    <Outlet />
  );
}
function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? landing(user) : "/login"} replace />;
}
function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage register />} />
            <Route path="/" element={<Home />} />
            <Route element={<Guard />}>
              <Route element={<Shell />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route element={<Guard roles={["PATIENT"]} />}>
                  <Route path="/doctors" element={<DoctorsPage />} />
                  <Route path="/doctors/:id" element={<DoctorDetail />} />
                  <Route path="/book" element={<BookingPage />} />
                  <Route
                    path="/my-appointments"
                    element={<AppointmentsPage />}
                  />
                  <Route
                    path="/my-appointments/:id"
                    element={<AppointmentDetail />}
                  />
                </Route>
                <Route element={<Guard roles={["DOCTOR"]} />}>
                  <Route path="/doctor/dashboard" element={<Dashboard />} />
                  <Route
                    path="/doctor/calendar"
                    element={
                      <Suspense fallback={<Loading text="Loading calendar…" />}>
                        <CalendarPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/doctor/availability"
                    element={<AvailabilityPage />}
                  />
                </Route>
                <Route element={<Guard roles={["ADMIN"]} />}>
                  <Route
                    path="/admin/dashboard"
                    element={<Dashboard admin />}
                  />
                  <Route
                    path="/admin/appointments"
                    element={<AppointmentsPage admin />}
                  />
                  <Route path="/admin/doctors" element={<AdminDoctors />} />
                  <Route
                    path="/admin/doctors/:id/availability"
                    element={<AvailabilityPage />}
                  />
                  <Route path="/admin/specialties" element={<CatalogPage />} />
                  <Route
                    path="/admin/appointment-types"
                    element={<CatalogPage types />}
                  />
                  <Route path="/admin/users" element={<UsersPage />} />
                </Route>
                <Route
                  path="*"
                  element={
                    <Empty title="This page could not be found">
                      <a className="button secondary" href="/">
                        Go to your dashboard
                      </a>
                    </Empty>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
