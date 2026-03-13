"use server";

import { redirect } from "next/navigation";
import {
  authenticateUser,
  clearUserSession,
  createUserSession,
  requireSession,
  updateActiveTeamSelection,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validation/forms";

export type AuthFormState = {
  error?: string;
};

export async function loginAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Dados de acesso invalidos.",
    };
  }

  const user = await authenticateUser(parsed.data.email, parsed.data.password);

  if (!user) {
    return {
      error: "E-mail ou senha invalidos.",
    };
  }

  await createUserSession(user);
  redirect("/painel");
}

export async function logoutAction() {
  await clearUserSession();
  redirect("/entrar");
}

export async function switchActiveTeamAction(formData: FormData) {
  const session = await requireSession();
  const teamId = String(formData.get("teamId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/painel").trim();
  const nextPath = redirectTo.startsWith("/painel") ? redirectTo : "/painel";

  if (teamId) {
    try {
      await updateActiveTeamSelection(session.id, teamId);
    } catch {
      redirect(nextPath);
    }
  }

  redirect(nextPath);
}
