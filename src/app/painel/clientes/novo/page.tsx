import Link from "next/link";
import { ClientForm } from "@/components/client-form";
import { createClientAction } from "@/app/painel/clientes/actions";
import {
  canTransferOperationalOwnership,
  requireOperationalWriteAccess,
} from "@/lib/access-control";
import { teamMemberRoleLabels } from "@/lib/roles";
import { listAssignableTeamMembers } from "@/lib/team-members";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const access = await requireOperationalWriteAccess();
  const allowResponsibleSelection = canTransferOperationalOwnership(access);
  const responsibleOptions =
    allowResponsibleSelection && access.activeTeamId
      ? await listAssignableTeamMembers(access.activeTeamId)
      : [];

  return (
    <div className="space-y-8">
      <Link href="/painel/clientes" className="eyebrow text-slate-400">
        voltar para clientes
      </Link>
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">
        Criar cliente
      </h1>
      <p className="max-w-3xl text-sm leading-6 text-slate-500">
        Cadastre a empresa ou pessoa vinculada aos contratos e futuros links de
        assinatura.
      </p>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <ClientForm
          action={createClientAction}
          submitLabel="Criar cliente"
          pendingLabel="Criando..."
          allowResponsibleSelection={allowResponsibleSelection}
          responsibleOptions={responsibleOptions.map((member) => ({
            value: member.userId,
            label: member.name,
            helper: `${member.email} • ${teamMemberRoleLabels[member.role]}`,
          }))}
          responsibleSummary={
            allowResponsibleSelection
              ? "Selecione um responsavel da equipe ou deixe a carteira sem atribuicao inicial."
              : "A carteira deste cliente sera atribuida automaticamente ao seu usuario."
          }
          defaults={{ clientType: "BUSINESS" }}
        />
      </div>
    </div>
  );
}
