import { NextRequest } from "next/server";

type NominatimReverseResponse = {
  display_name?: string;
};

function parseCoordinate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const latitude = parseCoordinate(request.nextUrl.searchParams.get("lat"));
  const longitude = parseCoordinate(request.nextUrl.searchParams.get("lng"));

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return Response.json(
      {
        error: "Coordenadas invalidas.",
      },
      {
        status: 400,
      },
    );
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
    {
      cache: "no-store",
      headers: {
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": "assinaura-contrato-app/0.1.0",
      },
    },
  );

  if (!response.ok) {
    return Response.json(
      {
        error: "Nao foi possivel traduzir o GPS para um endereco.",
      },
      {
        status: 502,
      },
    );
  }

  const payload = (await response.json()) as NominatimReverseResponse;

  return Response.json({
    address: payload.display_name ?? null,
    provider: "OpenStreetMap Nominatim",
    capturedAt: new Date().toISOString(),
  });
}
