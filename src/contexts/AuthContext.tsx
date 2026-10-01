import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Perfil } from '@/types';

type AuthContextValue = {
  session: Session | null;
  perfil: Perfil | null;
  loading: boolean;
  refreshPerfil: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    email: string,
    password: string,
    nombre: string,
    nivel: number,
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, nivel_voley, rol, puntos_total, partidos_jugados')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Perfil;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        fetchPerfil(s.user.id).then((p) => {
          if (mounted) {
            setPerfil(p);
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        fetchPerfil(s.user.id).then((p) => {
          if (mounted) setPerfil(p);
        });
      } else {
        setPerfil(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return error.message;
      return null;
    },
    [],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      nombre: string,
      nivel: number,
    ): Promise<string | null> => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nombre_completo: nombre, nivel_voley: nivel },
        },
      });
      if (error) return error.message;
      return null;
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
  }, []);

  const refreshPerfil = useCallback(async (): Promise<void> => {
    const userId = session?.user.id;
    if (!userId) {
      setPerfil(null);
      return;
    }
    setPerfil(await fetchPerfil(userId));
  }, [session?.user.id]);

  return (
    <AuthContext.Provider
      value={{ session, perfil, loading, refreshPerfil, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
