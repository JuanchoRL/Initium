import { cn, getInitials } from '@/lib/utils';

const tones = [
  'from-cyan-500 to-sky-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-fuchsia-500 to-rose-500',
  'from-violet-500 to-indigo-500',
];

export function Avatar({ name, size = 'md', index = 0, className }: { name: string; size?: 'sm' | 'md' | 'lg'; index?: number; className?: string }) {
  const sizeClass = size === 'sm' ? 'h-9 w-9 text-xs' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm';

  return (
    <div
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-semibold text-white shadow-lg shadow-slate-950/10',
        tones[index % tones.length],
        sizeClass,
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
