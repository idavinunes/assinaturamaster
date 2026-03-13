import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/app/entrar/login-form";
import { AppBrand } from "@/components/app-brand";
import { getCurrentSession } from "@/lib/auth";
import { getBrandingSettings } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getCurrentSession();
  const branding = await getBrandingSettings();

  if (session) {
    redirect("/painel");
  }

  return (
    <main className="px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.1fr_420px]">
        <section className="panel hidden rounded-[36px] p-8 md:p-10 lg:block">
          <AppBrand href="/" branding={branding} />

          <p className="mt-8 eyebrow text-muted">Acesso administrativo</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight md:text-6xl">
            Controle clientes, contratos e evidencias em um unico ambiente.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
            O painel concentra a operacao interna do produto: equipes, carteiras,
            modelos, solicitacoes de assinatura e documentos finais.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="rounded-[24px] border border-line bg-white px-4 py-4">
              <p className="eyebrow text-muted">Clientes</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Carteira por equipe e responsavel.
              </p>
            </div>
            <div className="rounded-[24px] border border-line bg-white px-4 py-4">
              <p className="eyebrow text-muted">Assinaturas</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Fluxo com evidencia e documento final.
              </p>
            </div>
            <div className="rounded-[24px] border border-line bg-white px-4 py-4">
              <p className="eyebrow text-muted">Equipes</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Contexto operacional e branding por ambiente.
              </p>
            </div>
          </div>
        </section>

        <section className="panel-strong rounded-[36px] p-7 md:p-8">
          <div className="lg:hidden">
            <AppBrand href="/" branding={branding} />
          </div>

          <p className="mt-6 eyebrow text-muted lg:mt-0">Entrar</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Painel do {branding.productShortName}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Informe suas credenciais para acessar o ambiente administrativo.
          </p>

          <LoginForm />

          <div className="mt-6 flex items-center gap-2 rounded-[24px] border border-line bg-white px-4 py-3 text-sm text-muted">
            <ShieldCheck className="size-4 shrink-0 text-accent" />
            <span>Acesso restrito ao time interno.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
