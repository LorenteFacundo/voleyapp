import { CajaVista } from '@/features/caja/CajaVista';
import { SoloDueno } from '@/features/caja/SoloDueno';
import { useGestion } from '@/contexts/gestion';

export function CajaPage() {
  const { esDueno } = useGestion();
  return (
    <section aria-labelledby="titulo-caja" className="space-y-4">
      <h2 id="titulo-caja" className="font-display text-xl font-black text-vb-blue">Caja</h2>
      {esDueno ? (
        <CajaVista />
      ) : (
        <SoloDueno
          titulo="La caja es solo para el dueño del club"
          descripcion="Podés registrar pagos desde la ficha de cada cliente o desde la agenda. Si necesitás ver la caja, pedíselo al dueño."
        />
      )}
    </section>
  );
}
