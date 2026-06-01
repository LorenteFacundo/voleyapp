import React from 'react';
import clsx from 'clsx';

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'blue';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const variantStyles = {
  primary: 'bg-vb-orange text-white hover:bg-vb-orange/90 shadow-card hover:-translate-y-0.5 hover:shadow-card-hover',
  secondary: 'border border-vb-gray/15 bg-white text-vb-gray hover:border-vb-orange hover:text-vb-orange hover:-translate-y-0.5',
  ghost: 'text-vb-gray/70 hover:text-vb-gray hover:bg-vb-gray/5',
  danger: 'bg-vb-red text-white hover:bg-vb-red/90',
  blue: 'bg-vb-blue text-white hover:bg-vb-blue/90 shadow-card hover:-translate-y-0.5 hover:shadow-card-hover',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

const Spinner = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, fullWidth = false, className, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all duration-200',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        (disabled || loading) && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
);

Button.displayName = 'Button';
