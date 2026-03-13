import Link from "next/link";
import {
  type BrandingSettingsValues,
  getGlobalBrandingSettings,
} from "@/lib/branding";

type AppBrandProps = {
  href?: string;
  showTagline?: boolean;
  branding?: BrandingSettingsValues;
};

export async function AppBrand({
  href = "/",
  showTagline = true,
  branding: brandingProp,
}: AppBrandProps) {
  const branding = brandingProp ?? (await getGlobalBrandingSettings());

  return (
    <Link href={href} className="inline-flex items-center gap-3">
      <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={branding.logoPath}
          alt={`Logo da ${branding.productName}`}
          className="h-10 w-10 object-contain"
        />
      </span>

      <span className="min-w-0">
        <span className="block text-base font-semibold tracking-tight text-foreground">
          {branding.productName}
        </span>
        {showTagline ? (
          <span className="eyebrow text-muted">{branding.productTagline}</span>
        ) : null}
      </span>
    </Link>
  );
}
