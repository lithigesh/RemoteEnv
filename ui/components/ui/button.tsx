import * as React from 'react';
import { cn } from '../../lib/utils';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};

export function Button({ className, variant = 'default', size = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={cn('ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, className)}
      {...props}
    />
  );
}
