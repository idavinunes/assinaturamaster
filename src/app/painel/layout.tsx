import type { ReactNode } from "react";
import {
  canManageGlobalAdministration,
  canManageTeamBranding,
  canManageTeamMembers,
  requireAccessContext,
} from "@/lib/access-control";
import { getCurrentSession } from "@/lib/auth";
import { getResolvedBrandingSettings } from "@/lib/branding";
import { AdminShell } from "@/components/admin-shell";
import { SubmitButton } from "@/components/submit-button";
import { logoutAction } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const session = await getCurrentSession();
  const branding = await getResolvedBrandingSettings(session?.activeTeamId ?? null);

  return {
    title: branding.browserTitle,
    description: branding.browserDescription,
  };
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireAccessContext();
  const branding = await getResolvedBrandingSettings(session.activeTeamId);
  const canAccessSettings =
    canManageGlobalAdministration(session) || canManageTeamBranding(session);
  const canAccessTeams =
    canManageGlobalAdministration(session) || canManageTeamMembers(session);

  if (!session.activeTeam) {
    return (
      <main className="px-4 py-4 md:px-6">
        <section className="panel mx-auto max-w-3xl rounded-[32px] p-6 md:p-8">
          <p className="eyebrow text-muted">Equipe ativa</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            Nenhuma equipe disponivel
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Seu usuario nao possui uma equipe ativa vinculada neste momento. Solicite
            acesso a um administrador ou saia da sessao para entrar com outro perfil.
          </p>

          <form action={logoutAction} className="mt-6">
            <SubmitButton
              pendingLabel="Saindo..."
              className="button-primary"
            >
              Sair
            </SubmitButton>
          </form>
        </section>
      </main>
    );
  }

  return (
    <AdminShell
      session={session}
      branding={branding}
      canAccessSettings={canAccessSettings}
      canAccessTeams={canAccessTeams}
    >
      {children}
    </AdminShell>
  );
}
