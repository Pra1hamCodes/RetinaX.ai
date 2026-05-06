import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import PageWrapper from "@/components/layout/PageWrapper";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const { user, login, refresh, loading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={redirectTo} replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      await refresh();
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Login failed");
    }
  };

  return (
    <PageWrapper>
      <div className="mx-auto flex max-w-md flex-col gap-6 px-6">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-primary)]">
          Secure access
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">Sign in</h1>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-6">
          <Input
            label="Email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <div className="rounded border border-[var(--color-primary)] bg-[#1a0a0a] px-3 py-2 text-xs text-[var(--color-primary)]">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--color-muted)]">
          New here?{" "}
          <Link to="/signup" className="text-white underline">
            Create an account
          </Link>
        </p>
      </div>
    </PageWrapper>
  );
}
