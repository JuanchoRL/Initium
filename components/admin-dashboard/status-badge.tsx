import { Badge } from '@/components/ui/badge';

const config = {
  active: { label: 'Active', variant: 'active' as const },
  pending: { label: 'Pending', variant: 'pending' as const },
  rejected: { label: 'Rejected', variant: 'rejected' as const },
  shortlisted: { label: 'Shortlisted', variant: 'shortlisted' as const },
  hired: { label: 'Hired', variant: 'hired' as const },
  confirmed: { label: 'Confirmed', variant: 'active' as const },
  rescheduled: { label: 'Rescheduled', variant: 'pending' as const },
  draft: { label: 'Draft', variant: 'outline' as const },
};

export function StatusBadge({ status }: { status: keyof typeof config }) {
  return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
}
