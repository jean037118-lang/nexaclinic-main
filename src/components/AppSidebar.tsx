import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  CreditCard,
  FileText,
  ShieldCheck,
  Activity,
  Settings,
  Pill,
  UserCog,
  Banknote,
  Layers,
  FileCode2,
  Microscope,
  FileCog,
  Phone,
  MessageCircle,
} from "lucide-react";
import logo from "../assets/logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { eAdmin, getUsuarioAtual } from "@/lib/auth";

const mainItems = [
  { title: "Dashboard",    url: "/",           icon: LayoutDashboard },
  { title: "Agenda",       url: "/agenda",     icon: Calendar },
  { title: "Pacientes",    url: "/pacientes",  icon: Users },
  { title: "Telefonia",    url: "/telefonia",  icon: Phone },
  { title: "Profissionais",url: "/profissionais", icon: Stethoscope },
];

const mgmtItems = [
  { title: "Convênios",     url: "/convenios",    icon: ShieldCheck },
  { title: "Procedimentos", url: "/procedimentos", icon: Activity },
  { title: "Especialidades",url: "/especialidades",icon: Pill },
  { title: "Financeiro",    url: "/financeiro",   icon: CreditCard },
  { title: "Faturamento",   url: "/faturamento",  icon: Layers },
  { title: "TISS",          url: "/tiss",         icon: FileCog },
  { title: "Repasse Médico",url: "/repasse",      icon: Banknote },
  { title: "Relatórios",    url: "/relatorios",   icon: FileText },
  { title: "WhatsApp",      url: "/whatsapp",     icon: MessageCircle },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));
  const isAdmin = eAdmin();
  const usuario = getUsuarioAtual();
  const podeVerConsultorio = isAdmin || usuario?.role === "medico";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60 bg-gradient-to-b from-sidebar to-sidebar/95">
        <Link to="/" className="flex items-center gap-3 px-3 py-3.5 group/logo">
          {/* Logo expandida */}
          <div className="group-data-[collapsible=icon]:hidden flex items-center gap-3 w-full">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400/20 to-teal-500/10 blur-md" />
              <div className="relative h-9 w-9 rounded-xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center overflow-hidden backdrop-blur-sm">
                <img src={logo} alt="NexaClinic" className="h-7 w-7 object-contain" />
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-sidebar-foreground tracking-tight leading-none">NexaClinic</span>
              <span className="text-[10px] text-sidebar-foreground/45 font-medium tracking-widest uppercase mt-0.5">Gestão Clínica</span>
            </div>
          </div>
          {/* Logo colapsada */}
          <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-cyan-400/20 blur-sm" />
              <div className="relative h-8 w-8 rounded-lg bg-white/10 ring-1 ring-white/20 flex items-center justify-center overflow-hidden">
                <img src={logo} alt="N" className="h-6 w-6 object-contain" />
              </div>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {podeVerConsultorio && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/consultorio")} tooltip="Consultório">
                    <Link to="/consultorio">
                      <Microscope className="h-4 w-4" />
                      <span>Consultório</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mgmtItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/usuarios")} tooltip="Usuários">
                    <Link to="/usuarios">
                      <UserCog className="h-4 w-4" />
                      <span>Usuários</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/configuracoes")} tooltip="Configurações">
              <Link to="/configuracoes">
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
