"use client";

import type { Role, TeamMemberRole } from "@prisma/client";
import clsx from "clsx";
import {
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCode2,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Signature,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useSyncExternalStore } from "react";
import { logoutAction, switchActiveTeamAction } from "@/lib/auth-actions";
import { roleLabels, teamMemberRoleLabels } from "@/lib/roles";
import { SubmitButton } from "@/components/submit-button";

type AdminShellProps = {
  children: ReactNode;
  session: {
    id: string;
    name: string;
    email: string;
    role: Role;
    activeTeamId: string | null;
    activeTeam: {
      teamId: string;
      teamName: string;
      teamSlug: string;
      role: TeamMemberRole;
    } | null;
    memberships: Array<{
      teamId: string;
      teamName: string;
      teamSlug: string;
      role: TeamMemberRole;
    }>;
  };
  branding: {
    productName: string;
    productTagline: string;
    logoPath: string;
  };
  canAccessSettings: boolean;
  canAccessTeams: boolean;
};

const SIDEBAR_STORAGE_KEY = "assinaura:sidebar-collapsed";
const SIDEBAR_STORAGE_EVENT = "assinaura:sidebar-collapsed-change";

const operationNavigationItems = [
  { href: "/painel", label: "Dashboard", icon: LayoutDashboard },
  { href: "/painel/clientes", label: "Clientes", icon: Building2 },
  { href: "/painel/assinaturas", label: "Assinaturas", icon: Signature },
  { href: "/painel/modelos", label: "Modelos", icon: FileCode2 },
] as const;

const administrationNavigationItems = [{ href: "/painel/usuarios", label: "Usuarios", icon: Users }] as const;

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function matchesPath(pathname: string, href: string) {
  if (href === "/painel") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getSidebarCollapsedSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
}

function subscribeToSidebarPreference(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SIDEBAR_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(SIDEBAR_STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(SIDEBAR_STORAGE_EVENT, onStoreChange);
  };
}

function SidebarLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="mx-auto my-3 h-px w-8 bg-slate-200" />;
  }

  return (
    <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
      {children}
    </p>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  collapsed,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  collapsed: boolean;
  active: boolean;
}) {
  return (
    <div className="group/nav relative">
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={clsx(
          "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition-all",
          collapsed ? "justify-center" : "gap-3",
          active
            ? "border border-slate-200 bg-slate-100 text-slate-900 shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed ? <span>{label}</span> : null}
      </Link>

      {collapsed ? (
        <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm lg:block lg:translate-x-2 lg:opacity-0 lg:transition-all lg:duration-200 lg:group-hover/nav:translate-x-0 lg:group-hover/nav:opacity-100">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export function AdminShell({
  children,
  session,
  branding,
  canAccessSettings,
  canAccessTeams,
}: AdminShellProps) {
  const pathname = usePathname();
  const isCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarCollapsedSnapshot,
    () => false,
  );
  const hasMultipleMemberships = session.memberships.length > 1;
  const isServicesActive = matchesPath(pathname, "/painel/servicos");
  const isExecutedServicesActive = matchesPath(pathname, "/painel/servicos-executados");
  const isSettingsActive = matchesPath(pathname, "/painel/configuracoes");
  const isTeamsActive = matchesPath(pathname, "/painel/equipes");

  function setSidebarCollapsed(nextValue: boolean | ((current: boolean) => boolean)) {
    if (typeof window === "undefined") {
      return;
    }

    const resolvedValue =
      typeof nextValue === "function" ? nextValue(getSidebarCollapsedSnapshot()) : nextValue;

    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, resolvedValue ? "1" : "0");
    window.dispatchEvent(new Event(SIDEBAR_STORAGE_EVENT));
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div
        className={clsx(
          "grid min-h-screen transition-[grid-template-columns] duration-300",
          isCollapsed ? "lg:grid-cols-[92px_1fr]" : "lg:grid-cols-[250px_1fr]",
        )}
      >
        <aside className="border-r border-slate-200 bg-white shadow-sm">
          <div className={clsx("flex min-h-screen flex-col", isCollapsed ? "px-3 py-4" : "px-4 py-5")}>
            <div className={clsx("flex items-start", isCollapsed ? "justify-center" : "justify-between gap-3")}>
              <Link
                href="/painel"
                className="flex items-center justify-center"
                title={branding.productName}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={branding.logoPath}
                  alt={`Logo da ${branding.productName}`}
                  className={clsx(
                    "object-contain",
                    isCollapsed ? "h-14 w-14" : "h-16 w-auto max-w-[160px]",
                  )}
                />
              </Link>

              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
                  aria-label="Recolher menu lateral"
                >
                  <ChevronLeft className="size-4" />
                </button>
              ) : null}
            </div>

            {isCollapsed ? (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                aria-label="Expandir menu lateral"
              >
                <ChevronRight className="size-4" />
              </button>
            ) : null}

            <div className={clsx("mt-8", isCollapsed ? "space-y-3" : "space-y-4")}>
              <div
                className={clsx(
                  "rounded-[22px] border border-slate-200 bg-slate-50/90",
                  isCollapsed ? "px-2 py-3 text-center" : "px-4 py-4",
                )}
              >
                {isCollapsed ? (
                  <>
                    <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-blue-600 text-sm font-semibold text-white">
                      {getInitials(session.name)}
                    </div>
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {roleLabels[session.role]}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-900">{session.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{session.email}</p>
                    <p className="mt-3 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                      {roleLabels[session.role]}
                    </p>
                  </>
                )}
              </div>

              {!isCollapsed && session.activeTeam ? (
                <div className="rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="eyebrow text-slate-400">Equipe ativa</p>
                      <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                        {session.activeTeam.teamName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {teamMemberRoleLabels[session.activeTeam.role]}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                      {session.memberships.length} equipe(s)
                    </span>
                  </div>

                  {hasMultipleMemberships ? (
                    <form action={switchActiveTeamAction} className="mt-4">
                      <input type="hidden" name="redirectTo" value={pathname} />
                      <select
                        name="teamId"
                        defaultValue={session.activeTeamId ?? ""}
                        onChange={(event) => event.currentTarget.form?.requestSubmit()}
                        className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-900 outline-none transition hover:bg-slate-50 focus:border-blue-500"
                        aria-label="Selecionar equipe ativa"
                      >
                        {session.memberships.map((membership) => (
                          <option key={membership.teamId} value={membership.teamId}>
                            {membership.teamName} • {teamMemberRoleLabels[membership.role]}
                          </option>
                        ))}
                      </select>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex-1 overflow-y-auto">
              <nav className="space-y-5">
                <div className="space-y-1">
                  <SidebarLabel collapsed={isCollapsed}>Operacional</SidebarLabel>
                  {operationNavigationItems.map((item) => (
                    <NavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      collapsed={isCollapsed}
                      active={matchesPath(pathname, item.href)}
                    />
                  ))}

                  <div className="space-y-1">
                    <NavItem
                      href="/painel/servicos"
                      label="Servicos"
                      icon={Briefcase}
                      collapsed={isCollapsed}
                      active={isServicesActive || isExecutedServicesActive}
                    />
                    {!isCollapsed ? (
                      <div className="pl-5">
                        <Link
                          href="/painel/servicos-executados"
                          className={clsx(
                            "flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px] font-medium transition-all",
                            isExecutedServicesActive
                              ? "bg-blue-50 text-blue-700"
                              : "text-slate-500 hover:bg-white hover:text-slate-900",
                          )}
                        >
                          <ClipboardList className="size-4 shrink-0" />
                          <span>Servicos executados</span>
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1">
                  <SidebarLabel collapsed={isCollapsed}>Administrativo</SidebarLabel>
                  {canAccessTeams ? (
                    <NavItem
                      href="/painel/equipes"
                      label="Equipes"
                      icon={ShieldCheck}
                      collapsed={isCollapsed}
                      active={isTeamsActive}
                    />
                  ) : null}

                  {administrationNavigationItems.map((item) => (
                    <NavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      collapsed={isCollapsed}
                      active={matchesPath(pathname, item.href)}
                    />
                  ))}

                  {canAccessSettings ? (
                    <NavItem
                      href="/painel/configuracoes"
                      label="Configuracoes"
                      icon={Settings}
                      collapsed={isCollapsed}
                      active={isSettingsActive}
                    />
                  ) : null}
                </div>
              </nav>
            </div>

            <form action={logoutAction} className="mt-6">
              <SubmitButton
                pendingLabel={isCollapsed ? "..." : "Saindo..."}
                className={clsx(
                  "inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70",
                  isCollapsed ? "w-full px-0 py-3" : "w-full gap-2 px-4 py-3",
                )}
              >
                <LogOut className="size-4 shrink-0" />
                {!isCollapsed ? <span>Sair</span> : null}
              </SubmitButton>
            </form>
          </div>
        </aside>

        <main className="px-5 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
