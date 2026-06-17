'use client';

import { Link } from '@tanstack/react-router';
import logo from "@/assets/nexaclinic-logo.png";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  DollarSign,
  BarChart3,
  Briefcase,
  Pill,
  Settings,
  LogOut,
  Receipt,
  FileText,
  FileCode2,
} from 'lucide-react';

const menuItems = [
  {
    category: 'Principal',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',    href: '/' },
      { icon: Calendar,        label: 'Agenda',       href: '/agenda' },
      { icon: Users,           label: 'Pacientes',    href: '/pacientes' },
      { icon: Stethoscope,     label: 'Profissionais',href: '/profissionais' },
      { icon: FileText,        label: 'Prontuário',   href: '/prontuario' },
    ],
  },
  {
    category: 'Gestão',
    items: [
      { icon: Briefcase,  label: 'Convênios',      href: '/convenios' },
      { icon: Receipt,    label: 'Faturamento',    href: '/faturamento' },
      { icon: FileCode2,  label: 'TISS Eletrônico',href: '/tiss' },
      { icon: Pill,       label: 'Especialidades', href: '/especialidades' },
      { icon: BarChart3,  label: 'Procedimentos',  href: '/procedimentos' },
      { icon: DollarSign, label: 'Financeiro',     href: '/financeiro' },
      { icon: BarChart3,  label: 'Relatórios',     href: '/relatorios' },
    ],
  },
  {
    category: 'Sistema',
    items: [
      { icon: Settings, label: 'Configurações', href: '/configuracoes' },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="flex flex-col h-full bg-slate-900 w-64">
      {/* LOGO */}
      <div className="p-4 border-b border-slate-700 flex justify-center">
        <Link to="/" className="flex items-center justify-center">
          <img
            src={logo}
            alt="NexaClinic"
            className="h-20 w-auto object-contain bg-white rounded-xl p-2"
          />
        </Link>
      </div>

      {/* MENU */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {menuItems.map((group) => (
          <div key={group.category}>
            <div className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {group.category}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                          isActive
                            ? 'bg-cyan-600 text-white'
                            : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                        }`
                      }
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* LOGOUT */}
      <div className="p-3 border-t border-slate-700">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-gray-300 hover:bg-slate-800 hover:text-white transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="text-sm">Sair</span>
        </button>
      </div>
    </aside>
  );
}
