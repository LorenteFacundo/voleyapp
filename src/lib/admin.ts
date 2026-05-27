import { supabase } from './supabase';

const BUCKET = 'canchas-fotos';

export type TurnoInput = {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
};

export type CrearCanchaInput = {
  clubId?: number | null;
  clubNombre: string;
  clubDireccion: string;
  clubTelefono: string;
  latitud: number;
  longitud: number;
  titulo: string;
  nombreIdentificador: string;
  descripcion: string;
  precioTotal: number;
  precioSena: number;
  fotos: string[];
  turnos: TurnoInput[];
};

export async function uploadCanchaPhotos(files: File[]) {
  const urls: string[] = [];

  for (const file of files) {
    const extension = file.name.split('.').pop() ?? 'jpg';
    const path = `${crypto.randomUUID()}/${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

    if (error) {
      throw new Error(`No se pudo subir ${file.name}: ${error.message}`);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}

export async function crearCanchaConTurnos(input: CrearCanchaInput) {
  const { data, error } = await supabase.rpc('admin_crear_cancha', {
    p_club_nombre: input.clubNombre,
    p_club_direccion: input.clubDireccion,
    p_latitud: input.latitud,
    p_longitud: input.longitud,
    p_titulo: input.titulo,
    p_precio_total: input.precioTotal,
    p_precio_sena: input.precioSena,
    p_club_telefono: input.clubTelefono || null,
    p_nombre_identificador: input.nombreIdentificador || null,
    p_descripcion: input.descripcion || null,
    p_fotos: input.fotos,
    p_turnos: input.turnos,
    p_club_id: input.clubId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    club_id: number;
    cancha_id: number;
    turnos_creados: number;
  };
}

export async function reservarTurnoRango(params: {
  canchaId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estadoFinal?: string;
}) {
  const { data, error } = await supabase.rpc('reservar_turno_rango', {
    p_cancha_id: params.canchaId,
    p_fecha: params.fecha,
    p_hora_inicio: params.horaInicio,
    p_hora_fin: params.horaFin,
    p_estado_final: params.estadoFinal || 'reservado',
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as number;
}
