import { NextRequest, NextResponse } from "next/server";
import { createTemplateAction } from "@/app/painel/modelos/actions";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const result = await createTemplateAction({}, formData);

  if (result.error) {
    const redirectUrl = new URL("/painel/modelos/novo", request.url);
    redirectUrl.searchParams.set("error", result.error);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  return NextResponse.redirect(new URL("/painel/modelos", request.url), { status: 303 });
}
