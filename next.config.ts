import type { NextConfig } from "next";

function normalizeOriginHost(value: string) {
  return value.trim().toLowerCase();
}

function resolveAppAllowedOrigins() {
  const appUrl = process.env.APP_URL?.trim();

  if (!appUrl) {
    return [];
  }

  try {
    const parsedAppUrl = new URL(appUrl);
    const allowedOrigins = new Set<string>([
      normalizeOriginHost(parsedAppUrl.hostname),
      normalizeOriginHost(parsedAppUrl.host),
    ]);

    if (parsedAppUrl.hostname === "localhost") {
      allowedOrigins.add("127.0.0.1");

      if (parsedAppUrl.port) {
        allowedOrigins.add(`127.0.0.1:${parsedAppUrl.port}`);
      }
    }

    if (parsedAppUrl.hostname === "127.0.0.1") {
      allowedOrigins.add("localhost");

      if (parsedAppUrl.port) {
        allowedOrigins.add(`localhost:${parsedAppUrl.port}`);
      }
    }

    return Array.from(allowedOrigins);
  } catch {
    return [];
  }
}

function resolveAdditionalAllowedOrigins() {
  return (process.env.ADDITIONAL_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => normalizeOriginHost(entry))
    .filter(Boolean);
}

const allowedOriginHosts = Array.from(
  new Set([...resolveAppAllowedOrigins(), ...resolveAdditionalAllowedOrigins()]),
);
const allowedDevOrigins = Array.from(
  new Set(allowedOriginHosts.map((entry) => entry.split(":")[0] ?? entry)),
);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  experimental: {
    serverActions: {
      allowedOrigins: allowedOriginHosts,
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
