import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/labels";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  area_id: string | null;
  phone?: string | null;
}

const VIEW_AS_KEY = "capex.viewAs";

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  hasRole: (r: AppRole) => boolean;
  primaryRole: AppRole | null;
  /** Quando FP&A simula outro papel para testar telas */
  viewAs: AppRole | null;
  setViewAs: (r: AppRole | null) => void;
  /** Papel efetivo (viewAs se houver, senão primaryRole) */
  effectiveRole: AppRole | null;
  /** Verdadeiro se o usuário é realmente FP&A (independente do viewAs) */
  isRealFpa: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

function rolePriority(roles: AppRole[]): AppRole | null {
  if (roles.includes("fpa")) return "fpa";
  if (roles.includes("ceo")) return "ceo";
  if (roles.includes("cfo")) return "cfo";
  if (roles.includes("cco")) return "cco";
  if (roles.includes("cmo")) return "cmo";
  if (roles.includes("manager")) return "manager";
  return null;
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  // Simulação de papéis descontinuada — mantido apenas para compatibilidade da API do contexto.
  const setViewAs = (_r: AppRole | null) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(VIEW_AS_KEY);
  };

  const loadUserData = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, area_id, phone").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((p as Profile) ?? null);
    setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => { void loadUserData(s.user.id); }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setViewAs(null);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadUserData(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primaryRole = rolePriority(roles);
  const isRealFpa = roles.includes("fpa");
  // Simulação de papéis foi descontinuada: o papel efetivo é sempre o papel real.
  const effectiveRole = primaryRole;


  const value: AuthState = {
    loading,
    session,
    user: session?.user ?? null,
    profile,
    roles,
    hasRole: (r) => roles.includes(r),
    primaryRole,
    viewAs: null,
    setViewAs,
    effectiveRole,
    isRealFpa,
    refresh: async () => { if (session?.user) await loadUserData(session.user.id); },
    signOut: async () => { await supabase.auth.signOut(); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
