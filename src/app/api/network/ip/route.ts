import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? realIp ?? "indisponivel";

  return Response.json({
    ip,
    capturedAt: new Date().toISOString(),
  });
}
