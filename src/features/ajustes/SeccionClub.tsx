import { useId, useMemo, useState, type ClipboardEvent, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, LocateFixed, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import { claves } from '@/api/claves';
import type { ClubConfig, ClubPanel } from '@/api/tipos';
import { useAuth } from '@/contexts/auth';
import { useUbicacion } from '@/hooks/useGeolocation';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { formatTelefono } from '@/lib/telefono';
import { useGestion } from '@/contexts/gestion';
import { Apartado } from './Apartado';
import { BarraGuardar } from './BarraGuardar';
import { BotonCopiar } from '@/components/ui/BotonCopiar';
import {
  campoDelError, enlaceGoogleMaps, formClubDesde, parsearCoordenada, payloadClub, redondearCoordenada, separarCoordenadas, slugificar,
  whatsappValido, type ErroresFormulario, type FormClub,
} from './club';
import { useAvisoSalida, useCambios } from './useCambios';

const MENSAJES_UBICACION = {
  inactivo: null,
  buscando: 'Buscando tu ubicación…',
  listo: 'Cargamos tu ubicación actual. Verificá en el mapa que sea la del club antes de guardar.',
  denegado: 'No diste permiso para usar tu ubicación. Podés cargar las coordenadas a mano.',
  no_disponible: 'No pudimos obtener tu ubicación en este dispositivo. Cargá las coordenadas a mano.',
} as const;

/** Datos públicos del club, ubicación y datos para cobrar. */
export function SeccionClub() {
  const { clubId, panel } = useGestion();
  const club = panel.club;
  const base = useMemo(() => formClubDesde(club), [club]);
  const { valores, editados, hayCambios, cambiar, descartar } = useCambios(base);
  const [errores, setErrores] = useState<ErroresFormulario<FormClub>>({});
  const queryClient = useQueryClient();
  const { refreshPerfil } = useAuth();
  const ubicacion = useUbicacion();
  const prefijo = useId();
  const formId = `${prefijo}-form`;
  useAvisoSalida(hayCambios);

  // Cuando llegan coordenadas nuevas del GPS se cargan en el formulario.
  const [coordenadasUsadas, setCoordenadasUsadas] = useState(ubicacion.coordenadas);
  if (ubicacion.coordenadas !== coordenadasUsadas) {
    setCoordenadasUsadas(ubicacion.coordenadas);
    if (ubicacion.coordenadas) {
      cambiar('latitud', String(redondearCoordenada(ubicacion.coordenadas[0])));
      cambiar('longitud', String(redondearCoordenada(ubicacion.coordenadas[1])));
    }
  }

  const guardar = useMutation({
    mutationFn: (datos: Partial<ClubConfig>) => clubApi.actualizarClub(clubId, datos),
    onSuccess: (actualizado, datos) => {
      queryClient.setQueryData<ClubPanel>(claves.panel(clubId), (previo) => (previo ? { ...previo, club: actualizado } : previo));
      descartar();
      setErrores({});
      toast.success('Datos del club guardados.');
      void queryClient.invalidateQueries({ queryKey: claves.gestion(clubId) });
      void queryClient.invalidateQueries({ queryKey: claves.catalogo });
      if ('nombre' in datos || 'slug' in datos) void refreshPerfil();
    },
    onError: (error) => {
      const mensaje = mensajeDeError(error);
      const campoConError = campoDelError(mensaje);
      if (campoConError) setErrores((previos) => ({ ...previos, [campoConError]: mensaje }));
      toast.error(mensaje);
    },
  });

  function editar(campo: keyof FormClub, valor: string) {
    cambiar(campo, valor);
    if (errores[campo]) setErrores((previos) => ({ ...previos, [campo]: undefined }));
  }

  // Lo que se copia de Google Maps ("-34.6037, -58.3816") completa los dos campos.
  function pegarCoordenadas(evento: ClipboardEvent<HTMLInputElement>) {
    const par = separarCoordenadas(evento.clipboardData.getData('text'));
    if (!par) return;
    evento.preventDefault();
    editar('latitud', par[0]);
    editar('longitud', par[1]);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const { datos, errores: nuevos } = payloadClub(valores, editados, club);
    setErrores(nuevos);
    const primero = Object.keys(nuevos)[0];
    if (primero) {
      document.getElementById(`${prefijo}-${primero}`)?.focus();
      toast.error('Revisá los campos marcados.');
      return;
    }
    if (!Object.keys(datos).length) {
      descartar();
      toast.info('No había cambios para guardar.');
      return;
    }
    guardar.mutate(datos);
  }

  const campo = (nombre: keyof FormClub) => ({
    id: `${prefijo}-${nombre}`,
    value: valores[nombre],
    error: errores[nombre],
    onChange: (evento: { target: { value: string } }) => editar(nombre, evento.target.value),
  });

  const slug = slugificar(valores.slug) || club.slug;
  const urlPublica = `${window.location.origin}/club/${slug}`;
  const slugCambiado = slug !== club.slug;
  const whatsappNuevo = editados.includes('whatsapp') ? whatsappValido(valores.whatsapp) : null;
  const latitud = parsearCoordenada(valores.latitud);
  const longitud = parsearCoordenada(valores.longitud);
  const mapa = latitud !== null && longitud !== null && !Number.isNaN(latitud) && !Number.isNaN(longitud)
    ? enlaceGoogleMaps(latitud, longitud) : null;
  const mensajeUbicacion = MENSAJES_UBICACION[ubicacion.estado];

  return (
    <form id={formId} onSubmit={enviar} noValidate>
      <fieldset disabled={guardar.isPending} className="min-w-0 space-y-5">
        <Apartado titulo="Datos públicos" descripcion="Lo que ven los jugadores en la página del club y en el buscador.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nombre del club" required maxLength={120} autoComplete="organization" className="sm:col-span-2" {...campo('nombre')} />
            <div className="space-y-2 sm:col-span-2">
              <Input
                label="Dirección pública"
                maxLength={60}
                autoCapitalize="none"
                spellCheck={false}
                hint={slugCambiado
                  ? 'Si la cambiás, los enlaces que ya compartiste dejan de funcionar.'
                  : 'Letras, números y guiones. Es el final del enlace de tu club.'}
                {...campo('slug')}
              />
              <div className="flex flex-col gap-2 rounded-xl bg-ink/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 break-all text-sm text-ink/75">
                  <span className="sr-only">Enlace de la página del club:</span>{' '}{urlPublica}
                </p>
                <div className="flex shrink-0 gap-2">
                  <BotonCopiar texto={urlPublica} etiqueta="Copiar" etiquetaAccesible="Copiar el enlace de la página del club" />
                  {!slugCambiado && club.publicado && (
                    <a
                      href={`/club/${club.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-vb-blue hover:underline"
                    >
                      Ver página <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
              {slugCambiado && <p className="text-xs font-medium text-amber-800">Guardá los cambios para que el nuevo enlace funcione.</p>}
              {!club.publicado && (
                <p className="text-xs text-ink/65">La página se puede ver cuando publiques el club (en Reservas → Publicación).</p>
              )}
            </div>
            <Textarea
              label="Descripción"
              rows={4}
              maxLength={1000}
              className="sm:col-span-2"
              hint={`Contá cómo son las canchas, servicios (vestuarios, buffet, estacionamiento) y cómo llegar. ${valores.descripcion.length}/1000`}
              {...campo('descripcion')}
            />
            <Input label="Dirección" maxLength={200} autoComplete="street-address" hint="Calle, número y localidad." {...campo('direccion')} />
            <Input label="Zona" maxLength={80} hint="Barrio o localidad. Se usa para buscar clubes cercanos." {...campo('zona')} />
            <Input
              label="WhatsApp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              hint={whatsappNuevo ? `Se guardará como ${formatTelefono(whatsappNuevo)}.` : 'Con código de área, por ejemplo 11 2233-4455. Los jugadores te escriben a este número.'}
              {...campo('whatsapp')}
            />
            <Input label="Teléfono (opcional)" type="tel" inputMode="tel" hint="Para llamadas, con código de área." {...campo('telefono')} />
            <Input
              label="Instagram (opcional)"
              autoCapitalize="none"
              spellCheck={false}
              hint="Solo el usuario. También podés pegar el enlace del perfil."
              {...campo('instagram')}
            />
          </div>
        </Apartado>

        <Apartado
          titulo="Ubicación en el mapa"
          descripcion="Con la ubicación, el club aparece en el mapa y en las búsquedas por cercanía."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Latitud"
              inputMode="decimal"
              hint="Podés pegar acá las dos coordenadas juntas, como las copia Google Maps."
              {...campo('latitud')}
              onPaste={pegarCoordenadas}
            />
            <Input label="Longitud" inputMode="decimal" {...campo('longitud')} onPaste={pegarCoordenadas} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={ubicacion.pedir} loading={ubicacion.estado === 'buscando'}>
              <LocateFixed size={16} aria-hidden="true" /> Usar mi ubicación
            </Button>
            {mapa && (
              <a href={mapa} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-vb-blue hover:underline">
                <MapPin size={16} aria-hidden="true" /> Verificar en Google Maps <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
          </div>
          {mensajeUbicacion && <p role="status" className="mt-2 text-sm text-ink/65">{mensajeUbicacion}</p>}
          <p className="mt-3 text-xs text-ink/65">
            Tip: en Google Maps mantené apretado sobre el club y copiá los números que aparecen (por ejemplo -34.6037, -58.3816).
          </p>
        </Apartado>

        <Apartado
          titulo="Datos para cobrar"
          descripcion="Se los mostramos solo a los jugadores que reservaron, para que te transfieran la seña. No aparecen en la página pública."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Alias (CBU o CVU)" maxLength={60} autoCapitalize="none" spellCheck={false} {...campo('alias_pago')} />
            <Input label="Titular de la cuenta" maxLength={100} hint="Así el jugador confirma que transfiere a la cuenta correcta." {...campo('titular_pago')} />
          </div>
        </Apartado>
      </fieldset>

      <BarraGuardar
        visible={hayCambios}
        mensaje="Tenés cambios sin guardar en los datos del club."
        guardando={guardar.isPending}
        onDescartar={() => { descartar(); setErrores({}); }}
        formId={formId}
      />
    </form>
  );
}
