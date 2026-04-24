import { CalendarClock, Mail, Phone, Send } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AssessmentInvite } from '@/types/admin-dashboard';
import { EmptyState } from '@/components/admin-dashboard/empty-state';
import { StatusBadge } from '@/components/admin-dashboard/status-badge';
import { formatAdminDate, formatAdminTime } from '@/lib/utils';

export function CandidateInvitesPanel({ invites }: { invites: AssessmentInvite[] }) {
  return (
    <Card className="h-full overflow-hidden border-slate-200/90 bg-white shadow-[0_18px_40px_-28px_rgba(14,165,233,0.2)]">
      <CardHeader className="border-b border-slate-200/80 bg-gradient-to-r from-cyan-50/80 via-white to-white">
        <div>
          <CardTitle>Invitaciones enviadas</CardTitle>
          <CardDescription>
            Controla quién recibió la evaluación, para qué vacante y hasta cuándo tiene vigencia el enlace.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {invites.length === 0 ? (
          <EmptyState
            title="Todavía no hay invitaciones activas"
            description="Envía la primera evaluación desde el dashboard para empezar a monitorear vigencia y completitud."
            icon={<Send className="h-6 w-6" />}
          />
        ) : (
          invites.map((invite, index) => (
            <div
              key={invite.id}
              className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-4 shadow-sm transition hover:border-cyan-200 hover:bg-white"
            >
              <div className="flex items-start gap-3">
                <Avatar name={invite.candidateName} index={index} />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold tracking-tight text-slate-950">{invite.candidateName}</p>
                      <p className="truncate text-sm text-slate-500">{invite.vacancy} · {invite.department}</p>
                    </div>
                    <StatusBadge status={invite.status} />
                  </div>

                  <div className="grid gap-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-cyan-600" />
                      <span className="truncate">{invite.candidateEmail}</span>
                    </div>
                    {invite.candidatePhone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-cyan-600" />
                        <span>{invite.candidatePhone}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-cyan-600" />
                      <span>
                        Vence {formatAdminDate(invite.expiresAt)} · {formatAdminTime(invite.expiresAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
