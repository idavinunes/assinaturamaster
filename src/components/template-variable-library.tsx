"use client";

import { Copy, PanelRightOpen, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

type TemplateVariableLibraryGroup = {
  group: string;
  variables: Array<{
    key: string;
    label: string;
  }>;
};

type TemplateVariableLibraryProps = {
  groups: TemplateVariableLibraryGroup[];
};

export function TemplateVariableLibrary({
  groups,
}: TemplateVariableLibraryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        variables: group.variables.filter((variable) => {
          const placeholder = `{{${variable.key}}}`.toLowerCase();
          return (
            variable.label.toLowerCase().includes(term) ||
            variable.key.toLowerCase().includes(term) ||
            placeholder.includes(term)
          );
        }),
      }))
      .filter((group) => group.variables.length > 0);
  }, [groups, search]);

  async function copyPlaceholder(key: string) {
    const placeholder = `{{${key}}}`;

    try {
      await navigator.clipboard.writeText(placeholder);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1800);
    } catch {
      setCopiedKey(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-stone-50"
      >
        <PanelRightOpen className="size-4" />
        Biblioteca de variaveis
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]">
          <div className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-line bg-[#fbf6ef] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-5">
              <div>
                <p className="eyebrow text-muted">Biblioteca</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  Variaveis do documento
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Copie o placeholder e cole direto no ONLYOFFICE.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-white text-foreground transition hover:bg-stone-50"
                aria-label="Fechar biblioteca de variaveis"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="border-b border-line px-5 py-4">
              <label className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
                <Search className="size-4 text-muted" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome ou placeholder"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                />
              </label>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {filteredGroups.length > 0 ? (
                filteredGroups.map((group) => (
                  <section
                    key={group.group}
                    className="rounded-[24px] border border-line bg-white/80 p-4"
                  >
                    <p className="text-sm font-semibold text-foreground">{group.group}</p>
                    <div className="mt-3 grid gap-3">
                      {group.variables.map((variable) => {
                        const placeholder = `{{${variable.key}}}`;

                        return (
                          <div
                            key={variable.key}
                            className="rounded-[20px] border border-line bg-stone-50 px-4 py-3"
                          >
                            <p className="text-sm font-medium text-foreground">
                              {variable.label}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-xl bg-white px-3 py-2 text-xs text-foreground">
                                {placeholder}
                              </code>
                              <button
                                type="button"
                                onClick={() => copyPlaceholder(variable.key)}
                                className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-stone-100"
                              >
                                <Copy className="size-3.5" />
                                {copiedKey === variable.key ? "Copiado" : "Copiar"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))
              ) : (
                <div className="rounded-[24px] border border-line bg-white/80 px-4 py-5 text-sm text-muted">
                  Nenhuma variavel encontrada para esse filtro.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
