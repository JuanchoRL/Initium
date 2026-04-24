import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ai';
};

export const Card = ({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode; className?: string }) => (
  <div
    {...rest}
    className={`bg-white/85 backdrop-blur-xl border border-white/60 rounded-xl p-6 shadow-xl shadow-stone-200/40 ${className}`}
  >
    {children}
  </div>
);

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) => {
  const baseStyle =
    'px-6 py-3 rounded-lg font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20',
    secondary: 'bg-stone-200 hover:bg-stone-300 text-stone-700',
    danger: 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20',
    outline: 'border-2 border-cyan-600 text-cyan-700 hover:bg-cyan-50',
    ai: 'bg-stone-800 hover:bg-stone-700 text-white shadow-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export const InputField = ({
  value,
  onChange,
  type = 'text',
  placeholder,
  icon: Icon,
}: {
  value: string;
  onChange: (next: string) => void;
  type?: string;
  placeholder: string;
  icon?: LucideIcon;
}) => (
  <div className="relative">
    {Icon ? (
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
        <Icon className="w-5 h-5" />
      </div>
    ) : null}
    <input
      type={type}
      className="w-full bg-stone-50 border border-stone-200 rounded-lg py-3.5 pl-10 pr-4 text-stone-800 placeholder-stone-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all outline-none text-base"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);

export const ToggleRow = ({
  checked,
  onChange,
  title,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description: string;
  icon: LucideIcon;
}) => (
  <label className="flex items-start gap-3 p-4 bg-stone-50 border border-stone-200 rounded-lg cursor-pointer">
    <input
      type="checkbox"
      className="mt-1 h-4 w-4 accent-cyan-600"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
    <Icon className="w-5 h-5 text-cyan-600 mt-0.5" />
    <div>
      <div className="font-semibold text-stone-700 text-sm">{title}</div>
      <div className="text-xs text-stone-500 leading-relaxed">{description}</div>
    </div>
  </label>
);
