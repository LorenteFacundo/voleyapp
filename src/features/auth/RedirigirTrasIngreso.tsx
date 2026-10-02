import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumePostAuthRoute } from '@/lib/navigation';
import { Cargando } from '@/components/ui/Estados';
import { destinoTrasIngreso } from './validacion';

/**
 * Con la sesión abierta, lleva a la ruta pedida (?siguiente=), a la que se
 * recordó antes de ingresar o al inicio. La ruta recordada se consume una
 * sola vez, por eso se hace en un efecto y no durante el render.
 */
export function RedirigirTrasIngreso({ siguiente }: { siguiente: string | null }) {
  const navigate = useNavigate();
  const hecho = useRef(false);

  useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    navigate(destinoTrasIngreso(siguiente, consumePostAuthRoute), { replace: true });
  }, [navigate, siguiente]);

  return <Cargando texto="Entrando…" className="min-h-[40dvh]" />;
}
