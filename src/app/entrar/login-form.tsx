"use client";

import { useActionState } from "react";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { loginAction, type AuthFormState } from "@/lib/auth-actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-8 grid gap-5">
      <label className="grid gap-2">
        <span className="eyebrow text-muted">E-mail corporativo</span>
        <span className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="email"
            name="email"
            placeholder="voce@empresa.com"
            className="w-full rounded-[22px] border border-line bg-white px-11 py-3.5 text-sm outline-none transition focus:border-accent"
            autoComplete="email"
            autoFocus
            required
          />
        </span>
      </label>

      <label className="grid gap-2">
        <span className="eyebrow text-muted">Senha</span>
        <span className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="password"
            name="password"
            placeholder="Sua senha"
            className="w-full rounded-[22px] border border-line bg-white px-11 py-3.5 text-sm outline-none transition focus:border-accent"
            autoComplete="current-password"
            required
          />
        </span>
      </label>

      {state.error ? (
        <p className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <SubmitButton
        pendingLabel="Entrando..."
        className="button-primary w-full"
      >
        Entrar no painel
        <ArrowRight className="size-4" />
      </SubmitButton>
    </form>
  );
}
