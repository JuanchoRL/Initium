import { Database, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AdminView, NavItem } from '@/types/admin-dashboard';

export function AdminSidebar({
  items,
  activeView,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  onSelect,
}: {
  items: NavItem[];
  activeView: AdminView;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onSelect: (view: AdminView) => void;
}) {
  return (
    <>
      {mobileOpen ? <button className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" aria-label="Cerrar navegación" onClick={onCloseMobile} /> : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen w-[min(88vw,320px)] flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur transition-all duration-300 lg:static lg:translate-x-0',
          collapsed ? 'lg:w-24' : 'lg:w-72',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-200/80 px-5">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-600 to-sky-600 text-white shadow-lg shadow-cyan-500/25">
              <Sparkles className="h-5 w-5" />
            </div>
            {!collapsed ? (
              <div>
                <div className="text-base font-semibold text-slate-950">Initium+</div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Admin workspace</div>
              </div>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggleCollapse} aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}>
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-4 py-6">
          <div className="space-y-2">
            {!collapsed ? <p className="px-3 text-xs uppercase tracking-[0.18em] text-slate-400">Workspace</p> : null}
            <nav className="space-y-1.5" aria-label="Navegación principal">
              {items.map((item) => {
                const active = item.key === activeView;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      onSelect(item.key);
                      onCloseMobile();
                    }}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
                      active
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950',
                      collapsed && 'justify-center px-0'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!collapsed ? (
                      <>
                        <span className="flex-1 text-sm font-medium">{item.label}</span>
                        {item.badge ? (
                          <Badge
                            variant={active ? 'neutral' : 'outline'}
                            className={cn(active && 'border-white/20 bg-white/15 text-white')}
                          >
                            {item.badge}
                          </Badge>
                        ) : null}
                      </>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className={cn('rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50/80 via-white to-white p-4 shadow-sm', collapsed && 'px-2 py-3')}>
            <div className={cn('flex items-start gap-3', collapsed && 'justify-center')}>
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600">
                <Database className="h-5 w-5" />
              </div>
              {!collapsed ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-950">Persistencia activa</p>
                  <p className="text-sm text-slate-500">Vacantes, candidatos y resultados del assessment se guardan en SQLite mediante la API interna.</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
