import { NextRequest, NextResponse } from "next/server";
import { updateTemplateAction } from "@/app/painel/modelos/actions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const formData = await request.formData();
  const result = await updateTemplateAction(id, {}, formData);

  if (result.error) {
    const redirectUrl = new URL(`/painel/modelos/${id}/editar`, request.url);
    redirectUrl.searchParams.set("error", result.error);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  return NextResponse.redirect(new URL(`/painel/modelos/${id}/editar`, request.url), {
    status: 303,
  });
}
