import { SoloDueno } from '@/features/caja/SoloDueno';
import { ReportesVista } from '@/features/reportes/ReportesVista';
import { useGestion } from '@/contexts/gestion';

export function ReportesPage() {
  const { esDueno } = useGestion();
  return (
    <section aria-labelledby="titulo-reportes" className="space-y-4">
      <div>
        <h2 id="titulo-reportes" className="font-display text-xl font-black text-vb-blue">Reportes</h2>
        <p className="text-sm text-ink/65">Cómo se usan tus canchas, cuánto facturás y dónde hay lugar para crecer.</p>
      </div>
      {esDueno ? (
        <ReportesVista />
      ) : (
        <SoloDueno
          titulo="Los reportes son solo para el dueño del club"
          descripcion="Si necesitás algún dato de ocupación o de ingresos, pedíselo al dueño."
        />
      )}
    </section>
  );
}
