"use client";

import { startTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  manageUserPortfolioAction,
  type UserPortfolioActionState,
} from "@/app/painel/usuarios/actions";
import { SubmitButton } from "@/components/submit-button";

type UserPortfolioManagementFormProps = {
  userId: string;
  teamName: string;
  summary: {
    clientsCount: number;
    executedServicesCount: number;
    signatureRequestsCount: number;
    totalCount: number;
  };
  assignableMembers: Array<{
    userId: string;
    name: string;
    email: string;
  }>;
};

const initialState: UserPortfolioActionState = {};

function formatSummary(summary: UserPortfolioManagementFormProps["summary"]) {
  return `${summary.clientsCount} cliente(s), ${summary.executedServicesCount} servico(s) executado(s) e ${summary.signatureRequestsCount} assinatura(s)`;
}

export function UserPortfolioManagementForm({
  userId,
  teamName,
  summary,
  assignableMembers,
}: UserPortfolioManagementFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    manageUserPortfolioAction.bind(null, userId),
    initialState,
  );

  useEffect(() => {
    if (!state.success) {
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }, [router, state.success]);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm leading-6 text-muted">
        <p className="font-semibold text-foreground">Equipe ativa: {teamName}</p>
        <p className="mt-2">
          Carteira pendente nesta equipe:{" "}
          <span className="font-medium text-foreground">{formatSummary(summary)}</span>
        </p>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-foreground">
          Transferir carteira para
        </span>
        <select
          name="targetUserId"
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
          defaultValue=""
        >
          <option value="">Selecione um membro da equipe</option>
          {assignableMembers.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name} • {member.email}
            </option>
          ))}
        </select>
      </label>

      {state.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <SubmitButton
          pendingLabel="Transferindo..."
          className="button-primary"
          name="mode"
          value="transfer"
        >
          Transferir carteira
        </SubmitButton>
        <SubmitButton
          pendingLabel="Liberando..."
          className="inline-flex items-center justify-center rounded-full border border-line px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-white"
          name="mode"
          value="unassign"
        >
          Deixar sem responsavel
        </SubmitButton>
      </div>
    </form>
  );
}
