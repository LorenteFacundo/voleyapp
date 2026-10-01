import { useId, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import type { MedioPago, Ocupacion } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GrupoChips } from './Chips';
import { useInvalidarAgenda } from './hooks';
import { parsearMonto } from './precios';
import { MEDIOS_PAGO, informoPago, montoCorto, saldoDe } from './presentacion';

type Props = {
  clubId: number;
  ocupacion: Ocupacion;
  /** Solo el dueño puede anular pagos: habilita "Deshacer". */
  puedeAnular: boolean;
  onRegistrado: (ocupacion: Ocupacion) => void;
};

/** Cobro rápido: seña, saldo o un monto a elección, con el medio de pago. */
export function RegistrarPago({ clubId, ocupacion, puedeAnular, onRegistrado }: Props) {
  const id = useId();
  const invalidar = useInvalidarAgenda(clubId);
  const [medio, setMedio] = useState<MedioPago>(() => (informoPago(ocupacion) ? 'transferencia' : 'efectivo'));
  const [otro, setOtro] = useState(false);
  const [montoTexto, setMontoTexto] = useState('');
  const [errorMonto, setErrorMonto] = useState<string | null>(null);

  const precio = Number(ocupacion.precio);
  const pagado = Number(ocupacion.pagado);
  const sena = Number(ocupacion.sena);
  const saldo = saldoDe(ocupacion);
  const aDevolver = ocupacion.estado_pago === 'a_devolver';
  const etiquetaMedio = MEDIOS_PAGO.find((opcion) => opcion.value === medio)?.label ?? medio;

  const anular = useMutation({
    mutationFn: (pagoId: number) => clubApi.anularPago(pagoId),
    onSuccess: () => toast.success('Anulaste el pago.'),
    onError: (error) => toast.error(mensajeDeError(error)),
    onSettled: () => {
      void invalidar({ clienteId: ocupacion.cliente?.id });
    },
  });

  const registrar = useMutation({
    mutationFn: (monto: number) => clubApi.registrarPago({ clubId, monto, medio, ocupacionId: ocupacion.id }),
    onSuccess: (resultado, monto) => {
      const texto = monto < 0
        ? `Registraste una devolución de ${montoCorto(-monto)} (${etiquetaMedio.toLowerCase()}).`
        : `Registraste un pago de ${montoCorto(monto)} (${etiquetaMedio.toLowerCase()}).`;
      toast.success(texto, puedeAnular ? { action: { label: 'Deshacer', onClick: () => anular.mutate(resultado.pago_id) } } : undefined);
      setOtro(false);
      setMontoTexto('');
      if (resultado.ocupacion) onRegistrado(resultado.ocupacion);
    },
    onError: (error) => toast.error(mensajeDeError(error)),
    onSettled: () => {
      void invalidar({ clienteId: ocupacion.cliente?.id });
    },
  });

  const rapidos: { etiqueta: string; monto: number }[] = [];
  if (aDevolver) {
    rapidos.push({ etiqueta: `Devolver ${montoCorto(pagado)}`, monto: -pagado });
  } else {
    if (sena > 0 && pagado === 0 && sena < precio) rapidos.push({ etiqueta: `Seña ${montoCorto(sena)}`, monto: sena });
    if (saldo > 0) rapidos.push({ etiqueta: `${pagado > 0 ? 'Saldo' : 'Total'} ${montoCorto(saldo)}`, monto: saldo });
  }

  const enviarOtro = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const monto = parsearMonto(montoTexto);
    if (!monto) {
      setErrorMonto('Ingresá un monto mayor a cero.');
      return;
    }
    setErrorMonto(null);
    registrar.mutate(aDevolver ? -monto : monto);
  };

  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-3 rounded-2xl border border-ink/10 p-4">
      <h3 id={`${id}-titulo`} className="text-base font-bold text-ink">{aDevolver ? 'Registrar devolución' : 'Registrar pago'}</h3>
      <GrupoChips legend="Medio" opciones={MEDIOS_PAGO} value={medio} onChange={setMedio} />
      <div className="flex flex-wrap gap-2">
        {rapidos.map((rapido) => (
          <Button
            key={rapido.etiqueta}
            variant={aDevolver ? 'danger' : 'success'}
            loading={registrar.isPending && registrar.variables === rapido.monto}
            disabled={registrar.isPending}
            onClick={() => registrar.mutate(rapido.monto)}
          >
            {rapido.etiqueta}
          </Button>
        ))}
        <Button variant="secondary" aria-expanded={otro} onClick={() => setOtro((abierto) => !abierto)}>
          Otro monto
        </Button>
      </div>
      {otro && (
        <form onSubmit={enviarOtro} className="flex items-start gap-2" noValidate>
          <Input
            label={aDevolver ? 'Monto a devolver' : 'Monto'}
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ej.: 15000"
            value={montoTexto}
            error={errorMonto}
            onChange={(evento) => setMontoTexto(evento.target.value)}
            className="flex-1"
          />
          <Button type="submit" className="mt-6" loading={registrar.isPending}>Registrar</Button>
        </form>
      )}
    </section>
  );
}
