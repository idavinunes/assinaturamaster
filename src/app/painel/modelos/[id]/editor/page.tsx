import { redirect } from "next/navigation";

type LegacyTemplateEditorRedirectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacyTemplateEditorRedirectPage({
  params,
}: LegacyTemplateEditorRedirectPageProps) {
  const { id } = await params;

  redirect(`/editor/modelos/${id}`);
}
