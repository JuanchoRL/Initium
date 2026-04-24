import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="border-dashed border-slate-300/70 dark:border-slate-800">
      <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          {icon ?? <Inbox className="h-6 w-6" />}
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
