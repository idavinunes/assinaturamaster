import { redirect } from "next/navigation";
import { BrandingSettingsForm } from "@/components/branding-settings-form";
import {
  updateActiveTeamBrandingSettingsAction,
  updateBrandingSettingsAction,
} from "@/app/painel/configuracoes/actions";
import {
  canManageGlobalAdministration,
  canManageTeamBranding,
  requireAccessContext,
} from "@/lib/access-control";
import {
  emptyTeamBrandingSettings,
  getGlobalBrandingSettings,
  getResolvedBrandingSettings,
  getTeamBrandingSettings,
} from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  const access = await requireAccessContext();
  const canManageGlobal = canManageGlobalAdministration(access);
  const canManageTeam = canManageTeamBranding(access) && Boolean(access.activeTeamId);

  if (!canManageGlobal && !canManageTeam) {
    redirect("/painel");
  }

  const globalBranding = await getGlobalBrandingSettings();
  const teamBranding = access.activeTeamId
    ? await getTeamBrandingSettings(access.activeTeamId)
    : null;
  const resolvedActiveTeamBranding = access.activeTeamId
    ? await getResolvedBrandingSettings(access.activeTeamId)
    : globalBranding;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Configurações</h1>
        <p className="max-w-3xl text-base font-medium text-slate-500">
          Controle da identidade do produto e do branding aplicado à equipe ativa.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          {canManageGlobal ? (
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="eyebrow text-slate-400">Branding Global</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                Identidade master
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Define o fallback do produto quando a equipe não sobrescreve um valor próprio.
              </p>

              <BrandingSettingsForm
                action={updateBrandingSettingsAction}
                defaults={globalBranding}
                submitLabel="Salvar Global"
              />
            </section>
          ) : null}

          {canManageTeam && access.activeTeam ? (
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="eyebrow text-slate-400">Branding da Equipe</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                {access.activeTeam.teamName}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Preencha só o que deve sobrescrever o padrão global.
              </p>

              <BrandingSettingsForm
                action={updateActiveTeamBrandingSettingsAction}
                defaults={teamBranding ?? emptyTeamBrandingSettings}
                fallbackValues={globalBranding}
                allowBlankValues
                submitLabel="Salvar Equipe"
              />
            </section>
          ) : null}
        </div>

        <aside className="space-y-8">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Preview Resolvido</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
              Marca em uso agora
            </h2>

            <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/15">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolvedActiveTeamBranding.logoPath}
                    alt={`Logo da ${resolvedActiveTeamBranding.productName}`}
                    className="h-10 w-10 object-contain brightness-0 invert"
                  />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-900">
                    {resolvedActiveTeamBranding.productName}
                  </p>
                  <p className="eyebrow text-slate-400">
                    {resolvedActiveTeamBranding.productTagline}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-sm">
                <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Nome curto
                  </p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {resolvedActiveTeamBranding.productShortName}
                  </p>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Título do navegador
                  </p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {resolvedActiveTeamBranding.browserTitle}
                  </p>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Descrição
                  </p>
                  <p className="mt-2 leading-6 text-slate-500">
                    {resolvedActiveTeamBranding.browserDescription}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {access.activeTeam ? (
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="eyebrow text-slate-400">Como funciona</p>
              <p className="mt-4 text-sm leading-6 text-slate-500">
                O painel usa a marca da equipe ativa. A página pública de assinatura usa a marca
                da equipe dona da solicitação. Campos em branco continuam herdando o branding
                global.
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
