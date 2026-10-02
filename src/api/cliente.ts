import { supabase } from '@/lib/supabase';

/** Error con un mensaje listo para mostrar a la persona usuaria. */
export class ApiError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

type ErrorDeServidor = { message?: string; code?: string; details?: string | null; hint?: string | null };

const SIN_CONEXION = 'No hay conexión. Revisá tu internet e intentá de nuevo.';

/**
 * Traduce errores de Supabase/PostgREST. Los mensajes que escribimos en las
 * funciones SQL ya están en español; los técnicos se reemplazan.
 */
export function traducirError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return new ApiError(SIN_CONEXION, 'red');
  const { message = '', code } = (error ?? {}) as ErrorDeServidor;
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return new ApiError(SIN_CONEXION, 'red');
  if (code === 'PGRST301' || /JWT expired|jwt/i.test(message)) {
    return new ApiError('Tu sesión venció. Volvé a iniciar sesión.', code);
  }
  if (/permission denied/i.test(message)) {
    return new ApiError('No tenés permiso para hacer esto. Iniciá sesión con una cuenta autorizada.', code);
  }
  if (code === 'PGRST202' || /Could not find the function/i.test(message)) {
    return new ApiError('La aplicación está actualizándose. Recargá la página en unos minutos.', code);
  }
  if (/invalid input syntax|violates check constraint|out of range/i.test(message)) {
    return new ApiError('Algún dato no es válido. Revisalo e intentá de nuevo.', code);
  }
  if (/duplicate key/i.test(message)) return new ApiError('Ese dato ya está registrado.', code);
  return new ApiError(message || 'Ocurrió un error inesperado. Intentá de nuevo.', code);
}

export function mensajeDeError(error: unknown): string {
  return traducirError(error).message;
}

/** Llama a una función RPC y devuelve su resultado o lanza un ApiError. */
export async function rpc<T>(funcion: string, argumentos?: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase.rpc(funcion, argumentos);
    if (error) throw traducirError(error);
    return data as T;
  } catch (error) {
    throw traducirError(error);
  }
}

/** Para funciones que devuelven SETOF: siempre un array. */
export async function rpcLista<T>(funcion: string, argumentos?: Record<string, unknown>): Promise<T[]> {
  const data = await rpc<T[] | null>(funcion, argumentos);
  return data ?? [];
}
