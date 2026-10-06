import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Avatar, Icon, useToast } from "./ui";
import { useAuth, today, formatDate } from "./context";
export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">✚</span>
      <span>
        clearwell<span className="logo-period">.</span>
      </span>
    </span>
  );
}
export function Shell() {
  const { user, zone, logout } = useAuth(),
    [open, setOpen] = useState(false),
    location = useLocation(),
    navigate = useNavigate(),
    toast = useToast();
  const patientLinks = [
    ["/doctors", "Find a doctor", "search"],
    ["/my-appointments", "My appointments", "calendar"],
  ];
  const doctorLinks = [
    ["/doctor/dashboard", "Overview", "grid"],
    ["/doctor/calendar", "My calendar", "calendar"],
    ["/doctor/availability", "Availability", "clock"],
  ];
  const adminLinks = [
    ["/admin/dashboard", "Overview", "grid"],
    ["/admin/appointments", "Appointments", "calendar"],
    ["/admin/doctors", "Doctors", "people"],
    ["/admin/specialties", "Specialties", "heart"],
    ["/admin/appointment-types", "Appointment types", "clock"],
    ["/admin/users", "User accounts", "user"],
  ];
  const links =
    user!.role === "PATIENT"
      ? patientLinks
      : user!.role === "DOCTOR"
        ? doctorLinks
        : adminLinks;
  const current =
    links.find((l) => location.pathname.startsWith(l[0]))?.[1] ||
    (location.pathname.startsWith("/book")
      ? "Book an appointment"
      : location.pathname === "/profile"
        ? "My profile"
        : "Appointment details");
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {open && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link to={links[0][0]} className="brand" aria-label="Clearwell home">
          <Logo />
        </Link>
        <div className="workspace-label">
          {user!.role === "PATIENT"
            ? "PATIENT PORTAL"
            : user!.role === "DOCTOR"
              ? "DOCTOR WORKSPACE"
              : "CLINIC ADMINISTRATION"}
        </div>
        <nav aria-label="Main navigation">
          {links.map(([to, text, icon]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>
              <Icon name={icon} />
              {text}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="clinic-note">
            <span className="clinic-note-icon">
              <Icon name="pin" />
            </span>
            <strong>One clinic. Your care.</strong>
            <span>
              All times shown in
              <br />
              {zone.replace("_", " ")}
            </span>
          </div>
          <NavLink
            className="profile-nav"
            to="/profile"
            onClick={() => setOpen(false)}
          >
            <Avatar name={user!.name} />
            <span>
              <strong>{user!.name}</strong>
              <small>
                {user!.role === "PATIENT"
                  ? "Patient account"
                  : user!.role === "DOCTOR"
                    ? "Doctor account"
                    : "Administrator"}
              </small>
            </span>
          </NavLink>
          <button
            className="logout"
            onClick={async () => {
              await logout().catch(() => toast("Signed out on this device."));
              navigate("/login");
            }}
          >
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <span>Clearwell Clinic</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{current}</strong>
          </div>
          <div className="topbar-date">
            <Icon name="calendar" size={16} />
            {formatDate(today(zone), zone, "ccc, d LLL yyyy")}
          </div>
        </header>
        <main id="main">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Clearwell Clinic</span>
          <span>Thoughtful care, simply scheduled.</span>
        </footer>
      </div>
    </div>
  );
}
