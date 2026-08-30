import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Code2, LogOut, PanelRightOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

export type AcademyMenuItem = { icon: LucideIcon; label: string; path: string };

export default function DashboardLayout({ children, menuItems, title }: { children: React.ReactNode; menuItems: AcademyMenuItem[]; title: string }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return <div className="auth-gate"><div className="auth-gate-card"><BrandMark /><h1>رحلتك البرمجية تبدأ من هنا</h1><p>سجّلي الدخول للوصول إلى مسارك التعليمي ولوحة متابعتك.</p><Button className="academy-button" onClick={() => startLogin(location)}>تسجيل الدخول</Button></div></div>;
  }

  const active = menuItems.find(item => item.path === location)?.label ?? title;
  return <SidebarProvider className="academy-shell" dir="rtl">
    <Sidebar side="right" collapsible="icon" className="academy-sidebar border-l border-white/10">
      <SidebarHeader className="h-24 p-4"><BrandMark compact /></SidebarHeader>
      <SidebarContent className="px-3 pt-2">
        <p className="sidebar-kicker px-2 pb-3 group-data-[collapsible=icon]:hidden">{title}</p>
        <SidebarMenu className="gap-2">
          {menuItems.map(item => <SidebarMenuItem key={item.label}>
            <SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="academy-menu-item h-12">
              <item.icon className="size-5" /><span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>)}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button className="account-trigger"><Avatar><AvatarFallback>{user.name?.trim()?.[0] ?? "ط"}</AvatarFallback></Avatar><span className="min-w-0 text-right group-data-[collapsible=icon]:hidden"><b>{user.name || "طالبة الأكاديمية"}</b><small>{user.role === "admin" ? "المعلمة" : "طالبة"}</small></span></button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44"><DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive"><LogOut className="ml-2 size-4" />تسجيل الخروج</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
    <SidebarInset className="academy-main">
      <header className="dashboard-header"><div className="flex items-center gap-3"><SidebarTrigger className="md:hidden" /><span className="dashboard-section-title">{isMobile ? active : title}</span></div><button className="header-mark" onClick={() => setLocation("/")} aria-label="العودة للصفحة الرئيسية"><PanelRightOpen className="size-4" />المنصة</button></header>
      <main className="dashboard-content">{children}</main>
    </SidebarInset>
  </SidebarProvider>;
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className="brand-mark"><div className="brand-icon"><Code2 className="size-5" /></div><span className={compact ? "group-data-[collapsible=icon]:hidden" : ""}><b>دعاء سلطان</b><small>أكاديمية البرمجة</small></span></div>;
}
