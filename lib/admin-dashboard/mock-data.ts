import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  ClipboardCheck,
  LayoutDashboard,
  LineChart,
  Send,
  Settings,
  UsersRound,
} from 'lucide-react';

import type { NavItem } from '@/types/admin-dashboard';

export const adminNavItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'candidates', label: 'Candidatos', icon: UsersRound },
  { key: 'jobs', label: 'Vacantes', icon: BriefcaseBusiness },
  { key: 'pipeline', label: 'Pipeline', icon: LineChart },
  { key: 'invites', label: 'Invita a candidatos', icon: Send },
  { key: 'assessments', label: 'Evaluaciones', icon: ClipboardCheck },
  { key: 'audit', label: 'Auditoría', icon: Activity },
  { key: 'reports', label: 'Reportes', icon: BarChart3 },
  { key: 'settings', label: 'Configuración', icon: Settings },
];
