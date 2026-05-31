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
        'rounded-2xl border border-vb-gray/10 bg-white shadow-card transition-all duration-300',
        paddingStyles[padding],
        hover && 'hover:shadow-card-hover hover:-translate-y-1 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);

Card.displayName = 'Card';
