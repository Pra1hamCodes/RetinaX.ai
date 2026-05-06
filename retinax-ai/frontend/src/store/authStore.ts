import { create } from "zustand";

import { ApiError } from "@/api/client";
import { authApi } from "@/api/endpoints";
import type { UserOut } from "@/types";

const DEMO_KEY = "retinax_demo_user";

interface AuthState {
  user: UserOut | null;
  isDemo: boolean;             // true when this session is local-only
  hydrated: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

function loadDemoUser(): UserOut | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserOut;
  } catch {
    return null;
  }
}

function saveDemoUser(user: UserOut): void {
  localStorage.setItem(DEMO_KEY, JSON.stringify(user));
}

function clearDemoUser(): void {
  localStorage.removeItem(DEMO_KEY);
}

function makeDemoUser(email: string, displayName?: string): UserOut {
  return {
    id: `demo-${crypto.randomUUID()}`,
    email,
    display_name: displayName ?? email.split("@")[0] ?? "Demo User",
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
}

/** True for any error that means "the API isn't reachable". */
function isOffline(err: unknown): boolean {
  if (err instanceof ApiError) {
    // status === 0 indicates network failure (axios populates this when no
    // response was received). 502/503/504 also indicate the gateway can't
    // reach the upstream.
    return err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504;
  }
  return true;                  // unknown errors → assume offline
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isDemo: false,
  hydrated: false,
  loading: false,

  refresh: async () => {
    try {
      const me = await authApi.me();
      set({ user: me, isDemo: false, hydrated: true });
      clearDemoUser();          // we have a real session, drop any demo
    } catch (err) {
      if (isOffline(err)) {
        const demo = loadDemoUser();
        set({ user: demo, isDemo: !!demo, hydrated: true });
      } else {
        set({ user: null, isDemo: false, hydrated: true });
      }
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { user } = await authApi.login({ email, password });
      clearDemoUser();
      set({ user, isDemo: false });
    } catch (err) {
      if (isOffline(err)) {
        const demo = makeDemoUser(email);
        saveDemoUser(demo);
        set({ user: demo, isDemo: true });
        return;                  // demo session counts as success
      }
      throw err;                 // 401 / validation error → propagate
    } finally {
      set({ loading: false });
    }
  },

  signup: async (email, password, displayName) => {
    set({ loading: true });
    try {
      const { user } = await authApi.signup({ email, password, display_name: displayName });
      clearDemoUser();
      set({ user, isDemo: false });
    } catch (err) {
      if (isOffline(err)) {
        const demo = makeDemoUser(email, displayName);
        saveDemoUser(demo);
        set({ user: demo, isDemo: true });
        return;
      }
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore — we'll clear local state regardless
    }
    clearDemoUser();
    set({ user: null, isDemo: false });
  },
}));
