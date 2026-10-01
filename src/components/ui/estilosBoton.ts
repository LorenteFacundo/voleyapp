import clsx from 'clsx';

// Clases de Button, reutilizables en enlaces que se ven como botones.

export type VarianteBoton = 'primary' | 'secondary' | 'ghost' | 'danger' | 'blue' | 'success';
export type TamanoBoton = 'sm' | 'md' | 'lg' | 'icon';

const variantes: Record<VarianteBoton, string> = {
  primary: 'bg-vb-orange-ink text-white hover:bg-orange-800 shadow-card',
  secondary: 'border border-vb-gray/15 bg-white text-vb-gray hover:border-vb-orange-ink hover:text-vb-orange-ink',
  ghost: 'text-vb-gray/80 hover:text-vb-gray hover:bg-vb-gray/5',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  blue: 'bg-vb-blue text-white hover:bg-vb-blue/90 shadow-card',
  success: 'bg-green-700 text-white hover:bg-green-800',
};

// Alturas mínimas pensadas para el pulgar (44 px en md).
const tamanos: Record<TamanoBoton, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
  icon: 'h-11 w-11 p-0',
};

export function clasesBoton({
  variant = 'primary', size = 'md', fullWidth = false, deshabilitado = false, className,
}: {
  variant?: VarianteBoton;
  size?: TamanoBoton;
  fullWidth?: boolean;
  deshabilitado?: boolean;
  className?: string;
} = {}): string {
  return clsx(
    'inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink focus-visible:ring-offset-2',
    variantes[variant],
    tamanos[size],
    fullWidth && 'w-full',
    deshabilitado && 'cursor-not-allowed opacity-60',
    className,
  );
}
