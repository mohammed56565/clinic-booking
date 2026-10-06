import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { landing, useAuth } from "./context";
import { ErrorBox, Field, Icon, PageHeading, useToast } from "./ui";
import { Logo } from "./shell";
import { send } from "./api";
export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, login } = useAuth(),
    navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (user) return <Navigate to={landing(user)} replace />;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await login(
        String(form.get("email")),
        String(form.get("password")),
        register ? String(form.get("name")) : undefined,
      );
      navigate(landing(result));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Logo />
        <div className="auth-story-content">
          <span className="eyebrow">WELCOME TO CLEARWELL</span>
          <h1>
            Your next step
            <br />
            to feeling better.
          </h1>
          <p>
            Find the right doctor. Choose a time that works. We’ll take it from
            there.
          </p>
          <div className="auth-benefit">
            <Icon name="calendar" />
            <span>Appointments that fit your day</span>
          </div>
          <div className="auth-benefit">
            <Icon name="shield" />
            <span>A private space for your bookings</span>
          </div>
        </div>
        <span className="auth-footnote">
          Clearwell Clinic · Patient & care team portal
        </span>
      </section>
      <section className="auth-form-side">
        <div className="auth-form">
          <span className="auth-mobile-brand">
            <Logo />
          </span>
          <span className="eyebrow">
            {register ? "YOUR CARE STARTS HERE" : "GOOD TO SEE YOU"}
          </span>
          <h2>{register ? "Create your account" : "Welcome back"}</h2>
          <p className="muted">
            {register
              ? "Join the patient portal to book your first appointment."
              : "Sign in to manage your appointments."}
          </p>
          <form onSubmit={submit}>
            {register && (
              <Field label="Full name">
                <input
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Your full name"
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                name="email"
                required
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>
            <Field
              label="Password"
              hint={register ? "Use at least 8 characters." : undefined}
            >
              <input
                name="password"
                required
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="Enter your password"
              />
            </Field>
            {error && <ErrorBox message={error} />}
            <button className="button full" disabled={busy}>
              {busy
                ? "Please wait…"
                : register
                  ? "Create patient account"
                  : "Sign in"}
              <Icon name="arrow" size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to Clearwell?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="auth-help">
            Doctor accounts are provided by the clinic administrator.
          </p>
        </div>
      </section>
    </div>
  );
}
export function ProfilePage() {
  const { user, updateUser } = useAuth(),
    toast = useToast();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT"
        title="My profile"
        description="Keep your basic account details up to date."
      />
      <section className="panel narrow">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              updateUser(
                await send(
                  "/profile",
                  { name: String(data.get("name")) },
                  "PATCH",
                ),
              );
              toast("Profile updated.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Full name">
            <input
              defaultValue={user!.name}
              name="name"
              required
              maxLength={100}
            />
          </Field>
          <Field label="Email address">
            <input value={user!.email} readOnly />
          </Field>
          <Field label="Account role">
            <input
              value={user!.role[0] + user!.role.slice(1).toLowerCase()}
              readOnly
            />
          </Field>
          {error && <ErrorBox message={error} />}
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>
    </>
  );
}
