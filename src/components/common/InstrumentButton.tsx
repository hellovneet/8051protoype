/**
 * Vintage Instrument Button Component (High Contrast & EdSim51 Readability)
 */

import React from 'react';

interface InstrumentButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'amber' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  icon?: React.ReactNode;
}

export const InstrumentButton: React.FC<InstrumentButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  active = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-xs gap-2',
    lg: 'px-4 py-2 text-sm gap-2.5',
  }[size];

  const variantClasses = {
    amber: active
      ? 'bg-[#f59e0b] text-[#000000] font-black border-[#fbbf24] shadow-[0_0_10px_rgba(245,158,11,0.5)]'
      : 'bg-[#291f14] text-[#fbbf24] hover:bg-[#3d2d1b] hover:text-[#fef3c7] border-[#92400e] hover:border-[#f59e0b]',
    primary: active
      ? 'bg-[#f59e0b] text-[#000000] font-black border-[#fbbf24]'
      : 'bg-[#26221e] text-[#ffffff] hover:bg-[#36302a] border-[#574e44] hover:border-[#f59e0b]',
    secondary: active
      ? 'bg-[#443c33] text-[#fbbf24] border-[#f59e0b]'
      : 'bg-[#1f1c19] text-[#f4efe8] hover:bg-[#2e2a25] hover:text-[#ffffff] border-[#4a4237] hover:border-[#786c5a]',
    danger: active
      ? 'bg-[#dc2626] text-[#ffffff] border-[#ef4444]'
      : 'bg-[#2b1717] text-[#fca5a5] hover:bg-[#3d1e1e] hover:text-[#ffffff] border-[#7f1d1d] hover:border-[#ef4444]',
    ghost: active
      ? 'bg-[#2d251d] text-[#fbbf24] border-transparent'
      : 'bg-transparent text-[#d4ccc2] hover:text-[#ffffff] hover:bg-[#28231d] border-transparent',
  }[variant];

  return (
    <button
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-mono uppercase tracking-wider font-bold
        rounded-sm border transition-all duration-75 select-none cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1f1c19]
        active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]
        ${sizeClasses}
        ${variantClasses}
        ${className}
      `}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
