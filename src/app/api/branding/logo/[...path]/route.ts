import { NextRequest } from "next/server";
import { getBrandingLogoMimeType, readStoredBrandingLogo } from "@/lib/storage/branding-logos";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<unknown> },
) {
  const resolvedParams = await context.params;
  const pathSegments =
    typeof resolvedParams === "object" &&
    resolvedParams !== null &&
    "path" in resolvedParams &&
    Array.isArray(resolvedParams.path)
      ? resolvedParams.path
      : [];
  const decodedSegments = pathSegments.map((segment) => decodeURIComponent(String(segment)));

  if (
    !decodedSegments.length ||
    decodedSegments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return new Response("Logo nao encontrada.", { status: 404 });
  }

  const storagePath = decodedSegments.join("/");

  try {
    const fileBuffer = await readStoredBrandingLogo(storagePath);

    return new Response(fileBuffer, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": getBrandingLogoMimeType(storagePath),
      },
    });
  } catch {
    return new Response("Logo nao encontrada.", { status: 404 });
  }
}
