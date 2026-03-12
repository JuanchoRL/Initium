import { CalendarClock, MapPin, Video } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UpcomingInterview } from '@/types/admin-dashboard';
import { EmptyState } from '@/components/admin-dashboard/empty-state';
import { StatusBadge } from '@/components/admin-dashboard/status-badge';
import { formatAdminDate, formatAdminTime } from '@/lib/utils';

export function UpcomingInterviews({ interviews }: { interviews: UpcomingInterview[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Próximas entrevistas</CardTitle>
          <CardDescription>Agenda real del workspace, cargada por el equipo.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {interviews.length === 0 ? (
          <EmptyState
            title="Sin entrevistas agendadas"
            description="Agenda una entrevista desde el dashboard para verla reflejada aquí."
            icon={<CalendarClock className="h-6 w-6" />}
          />
        ) : (
          interviews.map((interview, index) => (
            <div key={interview.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 transition-colors hover:border-cyan-200 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-cyan-900/70 dark:hover:bg-slate-900">
              <div className="flex items-start gap-3">
                <Avatar name={interview.candidateName} index={index} />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950 dark:text-white">{interview.candidateName}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{interview.vacancy}</p>
                    </div>
                    <StatusBadge status={interview.status} />
                  </div>
                  <div className="grid gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-cyan-500" />
                      <span>{formatAdminDate(interview.scheduledAt)} · {formatAdminTime(interview.scheduledAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {interview.format === 'Video' ? <Video className="h-4 w-4 text-cyan-500" /> : <MapPin className="h-4 w-4 text-cyan-500" />}
                      <span>{interview.format} con {interview.interviewer}</span>
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
