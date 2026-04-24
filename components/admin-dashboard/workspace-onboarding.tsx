import { Download, Plus, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function WorkspaceOnboarding({
  hasJobs,
  hasCandidates,
  hasImports,
  onCreateVacancy,
  onAddCandidate,
  onImportAssessments,
}: {
  hasJobs: boolean;
  hasCandidates: boolean;
  hasImports: boolean;
  onCreateVacancy: () => void;
  onAddCandidate: () => void;
  onImportAssessments: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Configura tu workspace</CardTitle>
          <CardDescription>El dashboard parte vacío para que todo lo que veas provenga de tus propios procesos y evaluaciones.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <button onClick={onCreateVacancy} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-left transition hover:border-cyan-200 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-cyan-900/70 dark:hover:bg-slate-900">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
            <Plus className="h-5 w-5" />
          </div>
          <p className="text-base font-semibold text-slate-950 dark:text-white">Crear vacante</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hasJobs ? 'Puedes seguir añadiendo roles al pipeline.' : 'Empieza definiendo el puesto que quieres cubrir.'}</p>
        </button>

        <button onClick={onAddCandidate} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-left transition hover:border-cyan-200 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-cyan-900/70 dark:hover:bg-slate-900">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
            <UserPlus className="h-5 w-5" />
          </div>
          <p className="text-base font-semibold text-slate-950 dark:text-white">Cargar candidato</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hasCandidates ? 'Puedes registrar más candidatos o completar scores manuales.' : 'Carga manualmente un perfil si aún no pasó por el assessment.'}</p>
        </button>

        <button onClick={onImportAssessments} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-left transition hover:border-cyan-200 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-cyan-900/70 dark:hover:bg-slate-900">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
            <Download className="h-5 w-5" />
          </div>
          <p className="text-base font-semibold text-slate-950 dark:text-white">Vincular resultados</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hasImports ? 'Hay resultados que no pudieron vincularse automáticamente y requieren revisión manual.' : 'Los resultados del assessment se sincronizan solos al pipeline. Este bloque queda como respaldo manual.'}</p>
        </button>
      </CardContent>
    </Card>
  );
}
