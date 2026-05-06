import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import PageWrapper from "@/components/layout/PageWrapper";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuthStore } from "@/store/authStore";

export default function SignupPage() {
  const { user, signup, refresh, loading } = useAuthStore();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signup(email, password, displayName);
      await refresh();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Signup failed");
    }
  };

  return (
    <PageWrapper>
      <div className="mx-auto flex max-w-md flex-col gap-6 px-6">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-primary)]">
          Create account
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">Sign up</h1>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-6">
          <Input label="Display name" name="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <Input label="Email" type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            label="Password"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            hint="Minimum 8 characters."
            required
          />
          {error && (
            <div className="rounded border border-[var(--color-primary)] bg-[#1a0a0a] px-3 py-2 text-xs text-[var(--color-primary)]">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--color-muted)]">
          Already have an account?{" "}
          <Link to="/login" className="text-white underline">
            Sign in
          </Link>
        </p>
      </div>
    </PageWrapper>
  );
}
