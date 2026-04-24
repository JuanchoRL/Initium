'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Menu, Plus, Search, UserPlus } from 'lucide-react';

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
  workspaceName,
  ownerName,
  ownerRole,
  availableImports,
  searchSummary,
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
  workspaceName: string;
  ownerName: string;
  ownerRole: string;
  availableImports: number;
  searchSummary?: string | null;
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
    <header className="relative z-10 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-slate-200/90 bg-white p-4 shadow-[0_20px_48px_-36px_rgba(15,23,42,0.18)] sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,560px)] xl:items-start">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" className="mt-1 shrink-0 lg:hidden" onClick={onOpenMobileMenu} aria-label="Abrir navegación">
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700 shadow-sm">
                    <Search className="h-3.5 w-3.5" />
                    Workspace recruiter · {workspaceName}
                  </div>
                  <Badge variant="outline">{availableImports} pendientes</Badge>
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">Dashboard de recruiting</h1>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="inline-flex min-h-14 items-center gap-2 rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</span>
                <span className="font-medium text-slate-950">{workspaceName}</span>
              </div>
              <div className="inline-flex min-h-14 items-center gap-2 rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Responsable</span>
                <span className="font-medium text-slate-950">{ownerName}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 xl:h-full">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Buscar candidato o vacante"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar candidato, vacante o recruiter"
                className="border-slate-200 bg-white pl-9"
              />
            </div>

            {searchSummary ? (
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-3 py-2 text-[12px] font-medium text-cyan-900">
                {searchSummary}
              </div>
            ) : null}

            <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="relative">
                <span className="sr-only">Filtrar por vacante o área</span>
                <select
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400"
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

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-cyan-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((current) => !current)}
                  >
                    <Avatar name={ownerName} index={1} size="sm" />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="truncate text-sm font-medium text-slate-950">{ownerName}</div>
                      <div className="truncate text-xs text-slate-500">{ownerRole}</div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>

                  {menuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+12px)] z-10 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-950/10" role="menu">
                      <button
                        type="button"
                        className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                      >
                        Perfil del workspace
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                      >
                        Preferencias
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
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

            <div className="grid gap-2.5 sm:grid-cols-2">
              <Button variant="outline" onClick={onOpenImportAssessments} className="justify-between border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50 sm:justify-center">
                <span className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Vincular resultados
                </span>
                {availableImports > 0 ? <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-[11px] font-semibold text-slate-950">{availableImports}</span> : null}
              </Button>

              <Button variant="outline" onClick={onOpenAddCandidate} className="border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50">
                <UserPlus className="h-4 w-4" />
                Nuevo candidato
              </Button>
            </div>

            <Button className="w-full justify-center bg-cyan-600 text-white hover:bg-cyan-500" onClick={onOpenCreateVacancy}>
              <Plus className="h-4 w-4" />
              Nueva vacante
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
