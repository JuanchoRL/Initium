'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Menu, MoonStar, Plus, Search, SunMedium, UserPlus } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FilterOption } from '@/types/admin-dashboard';

export function DashboardHeader({
  searchValue,
  onSearchChange,
  filterValue,
  onFilterChange,
  filterOptions,
  onOpenCreateVacancy,
  onOpenAddCandidate,
  onOpenImportAssessments,
  onOpenMobileMenu,
  theme,
  onToggleTheme,
  workspaceName,
  ownerName,
  ownerRole,
  availableImports,
  onLogout,
}: {
  searchValue: string;
  onSearchChange: (next: string) => void;
  filterValue: string;
  onFilterChange: (next: string) => void;
  filterOptions: FilterOption[];
  onOpenCreateVacancy: () => void;
  onOpenAddCandidate: () => void;
  onOpenImportAssessments: () => void;
  onOpenMobileMenu: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  workspaceName: string;
  ownerName: string;
  ownerRole: string;
  availableImports: number;
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/75 sm:px-6 lg:px-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] xl:items-start">
        <div className="flex items-start gap-3 pt-1">
          <Button variant="ghost" size="icon" className="mt-1 lg:hidden" onClick={onOpenMobileMenu} aria-label="Abrir navegación">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Dashboard de recruiting</h1>
              <Badge variant="outline">{workspaceName}</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">Crea vacantes, carga candidatos, recibe resultados del assessment sincronizados al pipeline y analiza el funnel con datos reales.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium dark:border-slate-800 dark:bg-slate-950">
                Workspace activo: <span className="font-semibold text-slate-700 dark:text-slate-200">{workspaceName}</span>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium dark:border-slate-800 dark:bg-slate-950">
                Resultados sin vincular: <span className="font-semibold text-slate-700 dark:text-slate-200">{availableImports}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input aria-label="Buscar candidato o vacante" value={searchValue} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar candidato, vacante o recruiter" className="pl-9" />
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Filtrar por vacante o área</span>
              <select
                className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                value={filterValue}
                onChange={(event) => onFilterChange(event.target.value)}
              >
                {filterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </label>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}>
                {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
              </Button>

              <div className="relative flex-1 sm:flex-none" ref={menuRef}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 sm:min-w-[220px]"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((current) => !current)}
                >
                  <Avatar name={ownerName} index={1} size="sm" />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium text-slate-950 dark:text-white">{ownerName}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">{ownerRole}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+12px)] z-10 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-950/10 dark:border-slate-800 dark:bg-slate-950" role="menu">
                    <button
                      type="button"
                      className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      Perfil del workspace
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      Preferencias
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-200"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onLogout();
                      }}
                    >
                      Cerrar sesión
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Button variant="outline" onClick={onOpenImportAssessments} className="justify-between sm:justify-center">
              <span className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Vincular resultados
              </span>
              {availableImports > 0 ? <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-[11px] font-semibold text-slate-950">{availableImports}</span> : null}
            </Button>

            <Button variant="outline" onClick={onOpenAddCandidate}>
              <UserPlus className="h-4 w-4" />
              Nuevo candidato
            </Button>
          </div>

          <Button className="mt-3 w-full" onClick={onOpenCreateVacancy}>
            <Plus className="h-4 w-4" />
            Nueva vacante
          </Button>
        </div>
      </div>
    </header>
  );
}
