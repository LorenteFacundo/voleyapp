import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatDuracion } from '@/lib/date';
import { pluralizar } from '@/lib/format';
import { errorMonto, parsearMonto, textoMonto } from './club';
import {
  describirBloque, DURACIONES_SUGERIDAS, enumerarBloques, etiquetaRango, generarBloques, MAXIMO_BLOQUES, planGenerador, textoReemplazo,
  type Bloque, type ModoAplicacion,
} from './horarios';
import { SelectorDias } from './SelectorDias';

type Props = {
  canchaTitulo: string;
  bloques: Bloque[];
  /** Precios sugeridos (los de referencia de la cancha). */
  precio: number;
  sena: number;
  onAplicar: (bloques: Bloque[]) => void;
  onClose: () => void;
};

const ETIQUETAS_DURACION: Record<number, string> = { 60: '1 hora', 90: '1 hora y media', 120: '2 horas' };

/** Arma bloques consecutivos (por ejemplo, de 18 a 24 en turnos de 2 horas) para varios días. */
export function GeneradorModal({ canchaTitulo, bloques, precio, sena, onAplicar, onClose }: Props) {
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [desde, setDesde] = useState('18:00');
  const [hasta, setHasta] = useState('00:00');
  const [duracion, setDuracion] = useState<string>('120');
  const [otraDuracion, setOtraDuracion] = useState('');
  const [textoPrecio, setTextoPrecio] = useState(precio > 0 ? textoMonto(precio) : '');
  const [textoSena, setTextoSena] = useState(sena > 0 ? textoMonto(sena) : '');
  const [modo, setModo] = useState<ModoAplicacion>('reemplazar');
  const [intentado, setIntentado] = useState(false);
  const formId = useId();

  const minutos = duracion === 'otra' ? Number(otraDuracion) : Number(duracion);
  const errorPrecio = errorMonto(textoPrecio);
  const errorSena = errorMonto(textoSena, false);
  const montosOk = !errorPrecio && !errorSena;
  // Con montos a medio escribir se arma igual la vista previa; los errores se ven al enviar.
  const generado = generarBloques({
    dias,
    desde,
    hasta,
    duracion: minutos,
    precio: montosOk ? parsearMonto(textoPrecio) ?? 0 : 0,
    sena: montosOk ? parsearMonto(textoSena) ?? 0 : 0,
  });
  const plan = generado.error ? null : planGenerador(bloques, generado.bloques, dias, modo);
  const total = plan?.resultado.length ?? 0;
  const error = generado.error
    ?? (plan?.conflictos.length
      ? `Chocan con bloques que ya tenés: ${enumerarBloques(plan.conflictos.map((conflicto) => conflicto.existente))}. `
        + 'Elegí “Reemplazarlos” o cambiá el rango.'
      : null)
    ?? (total > MAXIMO_BLOQUES ? `Una cancha puede tener hasta ${MAXIMO_BLOQUES} bloques por semana (quedarían ${total}).` : null);
  const delPrimerDia = generado.bloques.slice(0, generado.porDia);
  const deMadrugada = generado.bloques.find((bloque) => bloque.hora_inicio < desde);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setIntentado(true);
    if (!montosOk || error || !plan) return;
    onAplicar(plan.resultado);
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Generar bloques"
      descripcion={`Armá varios turnos seguidos de una vez en ${canchaTitulo}.`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form={formId} disabled={!!error}>
            {plan ? `Generar ${pluralizar(generado.bloques.length, 'bloque')}` : 'Generar bloques'}
          </Button>
        </>
      )}
    >
      <form id={formId} onSubmit={enviar} noValidate className="space-y-5">
        <SelectorDias leyenda="Días" seleccionados={dias} onChange={setDias} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Desde" type="time" step={300} value={desde} onChange={(evento) => setDesde(evento.target.value)} />
          <Input
            label="Hasta"
            type="time"
            step={300}
            value={hasta}
            onChange={(evento) => setHasta(evento.target.value)}
            hint="Para terminar a medianoche poné 00:00. Si es más temprano que “Desde”, sigue al día siguiente."
          />
          <Select label="Duración de cada bloque" value={duracion} onChange={(evento) => setDuracion(evento.target.value)}>
            {DURACIONES_SUGERIDAS.map((valor) => <option key={valor} value={valor}>{ETIQUETAS_DURACION[valor]}</option>)}
            <option value="otra">Otra duración</option>
          </Select>
          {duracion === 'otra' && (
            <Input
              label="Minutos por bloque"
              type="number"
              inputMode="numeric"
              min={30}
              max={720}
              step={15}
              value={otraDuracion}
              onChange={(evento) => setOtraDuracion(evento.target.value)}
              hint="Entre 30 y 720 minutos."
            />
          )}
          <Input
            label="Precio de cada bloque"
            inputMode="numeric"
            placeholder="30.000"
            value={textoPrecio}
            error={intentado ? errorPrecio : null}
            onChange={(evento) => setTextoPrecio(evento.target.value)}
          />
          <Input
            label="Seña (opcional)"
            inputMode="numeric"
            placeholder="10.000"
            value={textoSena}
            error={intentado ? errorSena : null}
            onChange={(evento) => setTextoSena(evento.target.value)}
          />
        </div>

        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold text-ink">Si esos días ya tienen bloques</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {([
              ['reemplazar', 'Reemplazarlos por los nuevos'],
              ['agregar', 'Mantenerlos y sumar los nuevos'],
            ] as const).map(([valor, etiqueta]) => (
              <label key={valor} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-ink/15 px-3 text-sm font-medium has-[:checked]:border-vb-orange-ink has-[:checked]:bg-vb-orange-light has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vb-orange-ink">
                <input type="radio" name={`${formId}-modo`} className="h-4 w-4 accent-vb-orange-ink" checked={modo === valor} onChange={() => setModo(valor)} />
                {etiqueta}
              </label>
            ))}
          </div>
        </fieldset>

        {error ? (
          <Aviso tono={intentado ? 'error' : 'alerta'}>{error}</Aviso>
        ) : plan && (
          <Aviso tono="info" titulo="Vista previa">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Cada día: {delPrimerDia.map(etiquetaRango).join(', ')} ({pluralizar(generado.porDia, 'bloque')}).
              </li>
              {generado.sobrante > 0 && (
                <li>Sobran {formatDuracion(generado.sobrante)} al final del rango: no alcanzan para otro bloque.</li>
              )}
              {deMadrugada && (
                <li>
                  Los bloques que empiezan después de las 00:00 quedan en el día siguiente (por ejemplo, {describirBloque(deMadrugada)}).
                </li>
              )}
              {plan.reemplazados.length > 0 && (
                <li>{textoReemplazo(plan.reemplazados)}</li>
              )}
              <li>La cancha queda con {pluralizar(total, 'bloque')} por semana.</li>
            </ul>
          </Aviso>
        )}
      </form>
    </Modal>
  );
}
