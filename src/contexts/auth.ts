import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Perfil } from '@/api/tipos';

type ResultadoRegistro = { error: string | null; requiereConfirmacion: boolean };

export type DatosRegistro = {
  email: string;
  password: string;
  nombre: string;
  nivel: number;
  telefono?: string | null;
  /** Ruta interna a la que lleva el enlace de confirmación (por defecto, /app). */
  destino?: string | null;
};

export type AuthContextValue = {
  session: Session | null;
  perfil: Perfil | null;
  /** true mientras se determina la sesión o se carga el perfil. */
  loading: boolean;
  /** La persona llegó desde un enlace de recuperación y debe elegir una contraseña. */
  recuperandoClave: boolean;
  esAdmin: boolean;
  esStaff: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (datos: DatosRegistro) => Promise<ResultadoRegistro>;
  /** Vuelve a mandar el email de confirmación de una cuenta nueva. */
  reenviarConfirmacion: (email: string, destino?: string | null) => Promise<string | null>;
  signOut: () => Promise<void>;
  enviarRecuperacion: (email: string) => Promise<string | null>;
  cambiarClave: (password: string) => Promise<string | null>;
  terminarRecuperacion: () => void;
  refreshPerfil: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ERRORES_AUTH: [RegExp, string][] = [
  [/invalid login credentials/i, 'Email o contraseña incorrectos.'],
  [/email not confirmed/i, 'Confirmá tu email antes de ingresar. Revisá tu bandeja de entrada.'],
  [/already registered|already been registered/i, 'Ya existe una cuenta con ese email. Probá ingresar o recuperar la contraseña.'],
  [/should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
  [/weak|pwned|leaked|known/i, 'Esa contraseña es muy común o apareció en filtraciones. Elegí otra.'],
  [/should be different/i, 'La nueva contraseña tiene que ser distinta de la anterior.'],
  [/rate limit|for security purposes|too many/i, 'Demasiados intentos. Esperá unos minutos y volvé a probar.'],
  [/invalid email|unable to validate email/i, 'El email no es válido.'],
  [/signups not allowed|signup is disabled/i, 'Por ahora no se pueden crear cuentas nuevas.'],
  [/fetch|network/i, 'No hay conexión. Revisá tu internet e intentá de nuevo.'],
];

export function traducirErrorAuth(mensaje: string): string {
  return ERRORES_AUTH.find(([patron]) => patron.test(mensaje))?.[1] ?? 'No pudimos completar la operación. Intentá de nuevo.';
}

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return contexto;
}
