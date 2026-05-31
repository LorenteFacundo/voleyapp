import React from 'react';
import clsx from 'clsx';

type InputProps = {
  label?: string;
  error?: string;
  helperText?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-ink mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full rounded-md border border-ink/15 px-3 py-2 text-sm focus:ring-2 focus:ring-court/40 focus:outline-none transition',
            error && 'border-red-400',
            className
          )}
          {...props}
        />
        {error && <span className="mt-1 text-xs text-red-500">{error}</span>}
        {helperText && !error && <span className="mt-1 text-xs text-ink/50">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
