import React from 'react';
import clsx from 'clsx';

type CardProps = {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'md', hover = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'rounded-lg border border-ink/10 bg-white/85 shadow-soft backdrop-blur',
        paddingStyles[padding],
        hover && 'transition-all duration-200 hover:border-court/40 hover:-translate-y-0.5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);

Card.displayName = 'Card';
