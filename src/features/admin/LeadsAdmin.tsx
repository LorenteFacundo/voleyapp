import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Inbox, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/admin';
import { mensajeDeError } from '@/api/cliente';
import { claves } from '@/api/claves';
import { useLeads } from '@/api/consultas';
import type { EstadoLead, LeadClub } from '@/api/tipos';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Select, Textarea } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { pluralizar } from '@/lib/format';
import { contactoLead, ESTADOS_LEAD, fechaCorta } from './etiquetas';
import { NuevoClubModal } from './NuevoClubModal';
import type { FormNuevoClub } from './nuevoClub';

type Filtro = EstadoLead | 'todos';

const VARIANTES: Record<EstadoLead, 'info' | 'warning' | 'court' | 'success'> = {
  nuevo: 'info',
  contactado: 'warning',
  en_preparacion: 'court',
  incorporado: 'success',
};

function Contacto({ lead }: { lead: LeadClub }) {
  const contacto = contactoLead(lead.contacto, lead.club_nombre);
  if (contacto.tipo === 'texto') return <span className="break-all">{contacto.texto}</span>;
  const Icono = contacto.tipo === 'email' ? Mail : MessageCircle;
  return (
    <a
      href={contacto.href}
      target={contacto.tipo === 'whatsapp' ? '_blank' : undefined}
      rel={contacto.tipo === 'whatsapp' ? 'noopener noreferrer' : undefined}
      className="inline-flex min-h-11 items-center gap-1.5 break-all font-semibold text-vb-blue hover:underline"
    >
      <Icono size={15} className="shrink-0" aria-hidden="true" />
      {contacto.texto}
      {' '}<span className="sr-only">{contacto.tipo === 'email' ? '(enviar email)' : '(escribir por WhatsApp)'}</span>
    </a>
  );
}

function TarjetaLead({ lead, onCrearClub }: { lead: LeadClub; onCrearClub: () => void }) {
  const queryClient = useQueryClient();
  const [notas, setNotas] = useState<string | null>(null);
  const notasVisibles = notas ?? lead.notas ?? '';
  const notasCambiadas = notas !== null && notas.trim() !== (lead.notas ?? '').trim();

  const actualizar = useMutation({
    mutationFn: (cambios: { estado?: EstadoLead; notas?: string | null }) => adminApi.actualizarLead(lead.id, cambios),
    onSuccess: async (_resultado, cambios) => {
      await queryClient.invalidateQueries({ queryKey: claves.admin });
      if ('notas' in cambios) {
        setNotas(null);
        toast.success('Notas guardadas.');
      } else toast.success(`${lead.club_nombre}: ${ESTADOS_LEAD.find((estado) => estado.valor === cambios.estado)?.etiqueta}.`);
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  const estadoVisible = actualizar.isPending && actualizar.variables?.estado ? actualizar.variables.estado : lead.estado;

  return (
    <li>
      <Card padding="md">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-vb-blue">{lead.club_nombre}</h3>
            <p className="text-sm text-ink/65">
              {lead.localidad} · {pluralizar(lead.cantidad_canchas, 'cancha')} · {fechaCorta(lead.created_at)}
            </p>
          </div>
          <Badge variant={VARIANTES[lead.estado]}>{ESTADOS_LEAD.find((estado) => estado.valor === lead.estado)?.etiqueta}</Badge>
        </div>
        <p className="mt-2 text-sm text-ink/75">
          {lead.contacto_nombre} · <Contacto lead={lead} />
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-[14rem_1fr]">
          <Select
            label={<>Seguimiento{' '}<span className="sr-only">de {lead.club_nombre}</span></>}
            value={estadoVisible}
            disabled={actualizar.isPending}
            onChange={(evento) => actualizar.mutate({ estado: evento.target.value as EstadoLead })}
          >
            {ESTADOS_LEAD.map((estado) => <option key={estado.valor} value={estado.valor}>{estado.etiqueta}</option>)}
          </Select>
          <div>
            <Textarea
              label={<>Notas internas{' '}<span className="sr-only">de {lead.club_nombre}</span></>}
              rows={2}
              maxLength={1000}
              placeholder="Qué hablaron, próximos pasos…"
              value={notasVisibles}
              onChange={(evento) => setNotas(evento.target.value)}
              hint="Solo las ve la administración."
            />
            {notasCambiadas && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  loading={actualizar.isPending && actualizar.variables?.notas !== undefined}
                  onClick={() => actualizar.mutate({ notas: notas?.trim() || null })}
                >
                  Guardar notas
                </Button>
                <Button variant="ghost" onClick={() => setNotas(null)} disabled={actualizar.isPending}>Descartar</Button>
              </div>
            )}
          </div>
        </div>

        {lead.estado !== 'incorporado' && (
          <Button variant="secondary" className="mt-3" onClick={onCrearClub}>
            <Building2 size={14} aria-hidden="true" /> Dar de alta el club
          </Button>
        )}
      </Card>
    </li>
  );
}

function datosIniciales(lead: LeadClub): Partial<FormNuevoClub> {
  const contacto = contactoLead(lead.contacto);
  return {
    nombre: lead.club_nombre,
    zona: lead.localidad,
    whatsapp: contacto.tipo === 'whatsapp' ? contacto.texto : '',
  };
}

export function LeadsAdmin() {
  const leads = useLeads();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [alta, setAlta] = useState<LeadClub | null>(null);
  const tituloId = useId();

  const encabezado = (
    <div className="mb-4">
      <h2 id={tituloId} className="font-display text-xl font-black text-vb-blue">Clubes interesados</h2>
      <p className="mt-0.5 text-sm text-ink/65">Consultas del formulario “Sumá tu cancha” de la web.</p>
    </div>
  );

  if (leads.isPending) return <section aria-labelledby={tituloId}>{encabezado}<Cargando texto="Cargando consultas…" /></section>;
  if (leads.isError) {
    return <section aria-labelledby={tituloId}>{encabezado}<ErrorCarga error={leads.error} onRetry={() => leads.refetch()} /></section>;
  }

  const cantidad = (estado: Filtro) => (estado === 'todos' ? leads.data.length : leads.data.filter((lead) => lead.estado === estado).length);
  const opciones: { id: Filtro; label: string }[] = [
    { id: 'todos', label: `Todos (${cantidad('todos')})` },
    ...ESTADOS_LEAD.map((estado) => ({ id: estado.valor as Filtro, label: `${estado.plural} (${cantidad(estado.valor)})` })),
  ];
  const visibles = filtro === 'todos' ? leads.data : leads.data.filter((lead) => lead.estado === filtro);

  return (
    <section aria-labelledby={tituloId}>
      {encabezado}
      {!leads.data.length ? (
        <Vacio
          icono={<Inbox size={32} />}
          titulo="Todavía no llegaron consultas"
          descripcion="Cuando un club complete el formulario de la web, aparece acá."
        />
      ) : (
        <>
          <Select
            label="Mostrar"
            className="mb-4 sm:hidden"
            value={filtro}
            onChange={(evento) => setFiltro(evento.target.value as Filtro)}
          >
            {opciones.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>{opcion.label}</option>
            ))}
          </Select>
          <Tabs
            className="mb-4 hidden sm:flex"
            label="Filtrar por seguimiento"
            tabs={opciones}
            activeTab={filtro}
            onChange={setFiltro}
          />
          {visibles.length ? (
            <ul className="space-y-3">
              {visibles.map((lead) => <TarjetaLead key={lead.id} lead={lead} onCrearClub={() => setAlta(lead)} />)}
            </ul>
          ) : (
            <Vacio titulo="No hay consultas en este estado" />
          )}
        </>
      )}
      {alta && <NuevoClubModal inicial={datosIniciales(alta)} onClose={() => setAlta(null)} />}
    </section>
  );
}
