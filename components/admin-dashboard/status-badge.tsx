import { Badge } from '@/components/ui/badge';

const config = {
  active: { label: 'Activa', variant: 'active' as const },
  'on-hold': { label: 'On hold', variant: 'pending' as const },
  closed: { label: 'Cerrada', variant: 'outline' as const },
  pending: { label: 'Pendiente', variant: 'pending' as const },
  rejected: { label: 'No avanzar', variant: 'rejected' as const },
  shortlisted: { label: 'Shortlist', variant: 'shortlisted' as const },
  hired: { label: 'Contratado', variant: 'hired' as const },
  confirmed: { label: 'Confirmada', variant: 'active' as const },
  rescheduled: { label: 'Reagendada', variant: 'pending' as const },
  draft: { label: 'Borrador', variant: 'outline' as const },
  sent: { label: 'Enviada', variant: 'active' as const },
  completed: { label: 'Completada', variant: 'shortlisted' as const },
  expired: { label: 'Vencida', variant: 'rejected' as const },
  cancelled: { label: 'Cancelada', variant: 'outline' as const },
};

export function StatusBadge({ status }: { status: keyof typeof config }) {
  return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
}
