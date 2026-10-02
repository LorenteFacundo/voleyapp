import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/admin';
import { mensajeDeError } from '@/api/cliente';
import { claves } from '@/api/claves';
import { useUsuariosAdmin } from '@/api/consultas';
import type { RolGlobal, UsuarioAdmin } from '@/api/tipos';
import { useAuth } from '@/contexts/auth';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Input, Select, Switch } from '@/components/ui/Input';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import { formatTelefono } from '@/lib/telefono';
import { etiquetaRol } from '@/features/ajustes/equipo';
import { esRolAdministracion, etiquetaRolGlobal, fechaCorta, permisoCambioRol, ROLES_GLOBALES } from './etiquetas';
import { useValorDiferido } from '@/hooks/useValorDiferido';

const LIMITE = 50;

function FilaUsuario({ usuario }: { usuario: UsuarioAdmin }) {
  const { perfil } = useAuth();
  const queryClient = useQueryClient();
  const confirmar = useConfirmar();
  const permiso = permisoCambioRol(perfil, usuario);
  const nombre = usuario.nombre?.trim() || usuario.email;
  const soyYo = perfil?.id === usuario.id;

  const rol = useMutation({
    mutationFn: (nuevo: RolGlobal) => adminApi.actualizarRol(usuario.id, nuevo),
    onSuccess: async (_resultado, nuevo) => {
      await queryClient.invalidateQueries({ queryKey: claves.admin });
      toast.success(`${nombre} ahora es ${etiquetaRolGlobal(nuevo).toLowerCase()}.`);
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  const acceso = useMutation({
    mutationFn: (habilitado: boolean) => adminApi.definirAcceso(usuario.id, habilitado),
    onSuccess: async (_resultado, habilitado) => {
      await queryClient.invalidateQueries({ queryKey: claves.admin });
      void queryClient.invalidateQueries({ queryKey: claves.estadoOperacion });
      toast.success(habilitado ? `${nombre} ya puede reservar durante el piloto.` : `${nombre} ya no tiene acceso al piloto.`);
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  async function cambiarRol(nuevo: RolGlobal) {
    const descripcion = ROLES_GLOBALES.find((opcion) => opcion.valor === nuevo)?.descripcion;
    const { confirmado } = await confirmar({
      titulo: `¿Cambiar el rol de ${nombre}?`,
      descripcion: `Pasa de ${etiquetaRolGlobal(usuario.rol)} a ${etiquetaRolGlobal(nuevo)}. ${descripcion ?? ''}`,
      confirmar: 'Cambiar rol',
      peligro: esRolAdministracion(nuevo) || esRolAdministracion(usuario.rol),
    });
    if (confirmado) rol.mutate(nuevo);
  }

  const rolVisible = rol.isPending && rol.variables ? rol.variables : usuario.rol;
  const habilitadoVisible = acceso.isPending && acceso.variables !== undefined ? acceso.variables : usuario.habilitado;

  return (
    <li>
      <Card padding="md">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
              <span className="truncate">{usuario.nombre?.trim() || 'Sin nombre'}</span>
              {soyYo && <Badge variant="info">vos</Badge>}
              {esRolAdministracion(usuario.rol) && <Badge variant="court">{etiquetaRolGlobal(usuario.rol)}</Badge>}
            </p>
            <p className="break-all text-sm text-ink/65">{usuario.email}</p>
            <p className="mt-0.5 text-xs text-ink/65">
              Alta: {fechaCorta(usuario.created_at)}
              {usuario.telefono && ` · ${formatTelefono(usuario.telefono)}`}
              {usuario.nivel !== null && ` · nivel ${usuario.nivel}`}
            </p>
            {usuario.clubes.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Clubes que gestiona">
                {usuario.clubes.map((club) => (
                  <li key={club.id}><Badge variant="muted">{club.nombre} · {etiquetaRol(club.rol)}</Badge></li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-4 md:w-72 md:shrink-0">
            <Select
              label={<>Rol{' '}<span className="sr-only">de {nombre}</span></>}
              value={rolVisible}
              disabled={!permiso.editable || rol.isPending}
              hint={permiso.motivo ?? undefined}
              onChange={(evento) => void cambiarRol(evento.target.value as RolGlobal)}
            >
              {ROLES_GLOBALES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor} disabled={permiso.bloqueados.includes(opcion.valor)}>
                  {opcion.etiqueta}
                </option>
              ))}
            </Select>
            <Switch
              checked={habilitadoVisible}
              onChange={(valor) => acceso.mutate(valor)}
              disabled={acceso.isPending}
              label={<>Acceso al piloto{' '}<span className="sr-only">de {nombre}</span></>}
              descripcion="Puede reservar mientras esté activa la lista de acceso."
            />
          </div>
        </div>
      </Card>
    </li>
  );
}

export function UsuariosAdmin() {
  const [busqueda, setBusqueda] = useState('');
  const termino = useValorDiferido(busqueda.trim(), 350);
  const usuarios = useUsuariosAdmin(termino);
  const tituloId = useId();

  let contenido;
  if (usuarios.isPending) contenido = <Cargando texto="Cargando usuarios…" />;
  else if (usuarios.isError) contenido = <ErrorCarga error={usuarios.error} onRetry={() => usuarios.refetch()} />;
  else if (!usuarios.data.length) {
    contenido = (
      <Vacio
        icono={<Users size={32} />}
        titulo={termino ? 'Nadie coincide con la búsqueda' : 'Todavía no hay usuarios'}
        descripcion={termino ? 'Probá con otra parte del nombre o del email.' : undefined}
      />
    );
  } else {
    contenido = (
      <>
        <ul className={usuarios.isPlaceholderData ? 'space-y-3 opacity-60 transition-opacity' : 'space-y-3'}>
          {usuarios.data.map((usuario) => <FilaUsuario key={usuario.id} usuario={usuario} />)}
        </ul>
        {usuarios.data.length >= LIMITE && (
          <p className="mt-3 text-center text-sm text-ink/65">
            Se muestran las {LIMITE} cuentas más recientes. Buscá por nombre o email para encontrar otras.
          </p>
        )}
      </>
    );
  }

  return (
    <section aria-labelledby={tituloId}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={tituloId} className="font-display text-xl font-black text-vb-blue">Usuarios</h2>
          <p className="mt-0.5 text-sm text-ink/65">Roles de la app y acceso al piloto.</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-80">
          <Input
            label="Buscar usuarios"
            labelOculto
            type="search"
            placeholder="Buscar por nombre o email"
            className="flex-1"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
          {usuarios.isFetching && <Spinner className="h-5 w-5 shrink-0 text-vb-orange-ink" />}
        </div>
      </div>
      {contenido}
    </section>
  );
}
