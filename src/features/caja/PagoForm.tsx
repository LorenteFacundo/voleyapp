import { useState, type FormEvent } from 'react';
import type { MedioPago } from '@/api/tipos';
import { Input } from '@/components/ui/Input';
import { addDaysToISODate, esFechaISO, todayArgentinaISO } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { BuscadorCliente, type ClienteElegido } from '@/features/clientes/BuscadorCliente';
import { MEDIOS_PAGO } from './etiquetas';
import { montoParaCampo, parsearMonto } from './montos';
import { SelectorOpciones } from './SelectorOpciones';

export type ValoresPago = {
  cliente: ClienteElegido | null;
  /** Siempre positivo; el signo de una devolución lo pone quien envía. */
  monto: number;
  medio: MedioPago;
  fecha: string;
  nota: string | null;
};

type Errores = Partial<Record<'cliente' | 'monto' | 'fecha', string>>;

const MONTO_MAXIMO = 100_000_000;

type Props = {
  id: string;
  modo: 'pago' | 'devolucion';
  /** Muestra el buscador de clientes (pago sin reserva ni cliente fijo). */
  elegirCliente?: boolean;
  montoInicial?: number | null;
  /** Tope del monto (por ejemplo, lo cobrado en una devolución). */
  montoMaximo?: number | null;
  notaInicial?: string;
  onSubmit: (valores: ValoresPago) => void;
};

/** Formulario de cobro o devolución. El botón de envío vive en el pie del diálogo (atributo form). */
export function PagoForm({
  id, modo, elegirCliente = false, montoInicial, montoMaximo, notaInicial = '', onSubmit,
}: Props) {
  const hoy = todayArgentinaISO();
  const minimo = addDaysToISODate(hoy, -60);
  const maximo = addDaysToISODate(hoy, 1);
  const [cliente, setCliente] = useState<ClienteElegido | null>(null);
  const [monto, setMonto] = useState(montoParaCampo(montoInicial));
  const [medio, setMedio] = useState<MedioPago>(modo === 'devolucion' ? 'transferencia' : 'efectivo');
  const [fecha, setFecha] = useState(hoy);
  const [nota, setNota] = useState(notaInicial);
  const [errores, setErrores] = useState<Errores>({});

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nuevos: Errores = {};
    const valor = parsearMonto(monto);
    if (elegirCliente && !cliente) nuevos.cliente = 'Elegí el cliente.';
    if (valor === null || valor <= 0) nuevos.monto = 'Ingresá un monto mayor a cero.';
    else if (montoMaximo != null && valor > montoMaximo) nuevos.monto = `No puede superar ${formatMoney(montoMaximo)}.`;
    else if (valor > MONTO_MAXIMO) nuevos.monto = 'Revisá el monto: es demasiado alto.';
    if (!esFechaISO(fecha) || fecha < minimo || fecha > maximo) {
      nuevos.fecha = 'La fecha tiene que estar dentro de los últimos 60 días.';
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length || valor === null) return;
    onSubmit({ cliente, monto: valor, medio, fecha, nota: nota.trim() || null });
  }

  return (
    <form id={id} onSubmit={enviar} noValidate className="space-y-4">
      {elegirCliente && (
        <BuscadorCliente
          valor={cliente}
          onChange={(elegido) => {
            setCliente(elegido);
            setErrores((previos) => ({ ...previos, cliente: undefined }));
          }}
          error={errores.cliente}
          enfocar
        />
      )}
      <Input
        label={modo === 'devolucion' ? 'Monto a devolver' : 'Monto'}
        inputMode="decimal"
        autoComplete="off"
        value={monto}
        onChange={(evento) => setMonto(evento.target.value)}
        error={errores.monto}
        hint={montoMaximo != null ? `Cobrado: ${formatMoney(montoMaximo)}.` : 'En pesos, por ejemplo 12.000.'}
        data-autofocus={elegirCliente ? undefined : true}
      />
      <SelectorOpciones legend="Medio de pago" opciones={MEDIOS_PAGO} valor={medio} onChange={setMedio} />
      <Input
        type="date"
        label="Fecha"
        value={fecha}
        min={minimo}
        max={maximo}
        onChange={(evento) => setFecha(evento.target.value)}
        error={errores.fecha}
      />
      <Input
        label="Nota (opcional)"
        value={nota}
        maxLength={300}
        onChange={(evento) => setNota(evento.target.value)}
        placeholder={modo === 'devolucion' ? 'Por ejemplo: transferido a su alias' : 'Por ejemplo: pagó las 2 últimas semanas'}
      />
    </form>
  );
}
