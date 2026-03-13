"use client";

import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type PublicSignatureLinkActionsProps = {
  publicPath: string;
  publicToken: string;
  variant?: "full" | "compact";
};

export function PublicSignatureLinkActions({
  publicPath,
  publicToken,
  variant = "full",
}: PublicSignatureLinkActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    const resolvedUrl = new URL(publicPath, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(resolvedUrl);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      {variant === "full" ? (
        <div className="mt-3 rounded-[20px] border border-line bg-white px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted">
            Link publico
          </p>
          <p className="mt-3 break-all font-mono text-sm leading-6 text-foreground">
            {publicPath}
          </p>
          <p className="mt-3 text-xs text-muted">Token: {publicToken}</p>
        </div>
      ) : null}

      <div className={variant === "full" ? "mt-4 flex flex-wrap gap-2" : "flex flex-wrap gap-2"}>
        <Link
          href={publicPath}
          target="_blank"
          className="inline-flex items-center rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-stone-50"
        >
          <ExternalLink className="mr-2 size-4" />
          Abrir pagina publica
        </Link>

        <button
          type="button"
          onClick={() => void handleCopyLink()}
          className="inline-flex items-center rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-stone-50"
        >
          {copied ? (
            <Check className="mr-2 size-4 text-emerald-600" />
          ) : (
            <Copy className="mr-2 size-4" />
          )}
          {copied ? "Link copiado" : "Copiar link"}
        </button>

        <button
          type="button"
          disabled
          className="inline-flex items-center rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition disabled:cursor-not-allowed disabled:opacity-70"
          title="Fluxo de envio por WhatsApp sera implementado depois."
        >
          <MessageCircle className="mr-2 size-4" />
          WhatsApp em breve
        </button>
      </div>
    </>
  );
}
