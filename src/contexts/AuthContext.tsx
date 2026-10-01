import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { jugadorApi } from '@/api/jugador';
import { claves } from '@/api/claves';
import { rutaInternaSegura } from '@/lib/navigation';
import { AuthContext, traducirErrorAuth, type AuthContextValue, type DatosRegistro } from './auth';

/** URL absoluta de la app para los enlaces de los emails de Auth. */
function urlDeRetorno(destino?: string | null): string {
  return `${window.location.origin}${rutaInternaSegura(destino) ?? '/app'}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sesionLista, setSesionLista] = useState(false);
  const [recuperandoClave, setRecuperandoClave] = useState(false);
  const usuarioActual = useRef<string | null>(null);

  useEffect(() => {
    const aplicar = (evento: AuthChangeEvent | 'INICIAL', nueva: Session | null) => {
      const nuevoId = nueva?.user.id ?? null;
      // Al cambiar de cuenta se descarta todo lo cacheado de la anterior.
      if (usuarioActual.current !== nuevoId) {
        if (usuarioActual.current !== null) queryClient.clear();
        usuarioActual.current = nuevoId;
      }
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoClave(true);
      setSession(nueva);
      setSesionLista(true);
    };

    supabase.auth.getSession()
      .then(({ data }) => aplicar('INICIAL', data.session))
      .catch(() => aplicar('INICIAL', null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, nueva) => {
      if (evento === 'INITIAL_SESSION') return;
      aplicar(evento, nueva);
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id;
  const perfilQuery = useQuery({
    queryKey: claves.perfil(userId),
    queryFn: jugadorApi.miPerfil,
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? traducirErrorAuth(error.message) : null;
  }, []);

  const signUp = useCallback(async (datos: DatosRegistro) => {
    const { data, error } = await supabase.auth.signUp({
      email: datos.email.trim(),
      password: datos.password,
      options: {
        emailRedirectTo: urlDeRetorno(datos.destino),
        data: { nombre_completo: datos.nombre.trim(), nivel_voley: datos.nivel, telefono: datos.telefono ?? null },
      },
    });
    if (error) return { error: traducirErrorAuth(error.message), requiereConfirmacion: false };
    return { error: null, requiereConfirmacion: !data.session };
  }, []);

  const reenviarConfirmacion = useCallback(async (email: string, destino?: string | null) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: urlDeRetorno(destino) },
    });
    return error ? traducirErrorAuth(error.message) : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  const enviarRecuperacion = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: urlDeRetorno('/perfil'),
    });
    return error ? traducirErrorAuth(error.message) : null;
  }, []);

  const cambiarClave = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return traducirErrorAuth(error.message);
    setRecuperandoClave(false);
    return null;
  }, []);

  const refreshPerfil = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: claves.perfil(userId) });
  }, [queryClient, userId]);

  const perfil = perfilQuery.data ?? null;
  const value = useMemo<AuthContextValue>(() => ({
    session,
    perfil,
    loading: !sesionLista || (!!userId && perfilQuery.isPending),
    recuperandoClave,
    esAdmin: !!perfil?.es_admin,
    esStaff: !!perfil && (perfil.es_admin || perfil.clubes.length > 0),
    signIn,
    signUp,
    reenviarConfirmacion,
    signOut,
    enviarRecuperacion,
    cambiarClave,
    terminarRecuperacion: () => setRecuperandoClave(false),
    refreshPerfil,
  }), [session, perfil, sesionLista, userId, perfilQuery.isPending, recuperandoClave, signIn, signUp, reenviarConfirmacion, signOut,
    enviarRecuperacion, cambiarClave, refreshPerfil]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
