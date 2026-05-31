import React from 'react';
import clsx from 'clsx';

type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  className?: string;
};

export const Skeleton = React.memo<SkeletonProps>(
  ({ width, height, rounded = false, className }) => (
    <div
      className={clsx('animate-pulse bg-ink/10', rounded ? 'rounded-lg' : 'rounded', className)}
      style={{ width, height }}
    />
  )
);

Skeleton.displayName = 'Skeleton';
