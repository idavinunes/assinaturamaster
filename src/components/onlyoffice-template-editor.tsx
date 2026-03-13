"use client";

import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (
        id: string,
        config: Record<string, unknown> & { token?: string },
      ) => {
        destroyEditor?: () => void;
      };
    };
  }
}

type OnlyOfficeTemplateEditorProps = {
  documentServerUrl: string;
  config: Record<string, unknown>;
  token: string;
  className?: string;
};

export function OnlyOfficeTemplateEditor({
  documentServerUrl,
  config,
  token,
  className,
}: OnlyOfficeTemplateEditorProps) {
  const editorId = useId().replace(/:/g, "");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<{ destroyEditor?: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorSize, setEditorSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!wrapper) {
      return;
    }

    const syncSize = () => {
      const nextWidth = Math.max(Math.floor(wrapper.clientWidth), 960);
      const nextHeight = Math.max(Math.floor(wrapper.clientHeight), 720);

      setEditorSize((current) => {
        if (
          current &&
          Math.abs(current.width - nextWidth) < 4 &&
          Math.abs(current.height - nextHeight) < 4
        ) {
          return current;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
    };

    syncSize();

    const observer = new ResizeObserver(() => {
      syncSize();
    });

    observer.observe(wrapper);
    window.addEventListener("resize", syncSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncSize);
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!editorSize) {
      return;
    }

    const resolvedEditorSize = editorSize;

    async function loadEditor() {
      const scriptId = "onlyoffice-docs-api";

      if (!document.getElementById(scriptId)) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.id = scriptId;
          script.src = `${documentServerUrl}/web-apps/apps/api/documents/api.js`;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("Nao foi possivel carregar o script do ONLYOFFICE."));
          document.body.appendChild(script);
        });
      }

      if (!active || !window.DocsAPI?.DocEditor) {
        return;
      }

      editorRef.current?.destroyEditor?.();
      editorRef.current = new window.DocsAPI.DocEditor(editorId, {
        ...config,
        width: `${resolvedEditorSize.width}px`,
        height: `${resolvedEditorSize.height}px`,
        token,
      });
    }

    loadEditor().catch((loadError) => {
      if (!active) {
        return;
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel iniciar o ONLYOFFICE.",
      );
    });

    return () => {
      active = false;
      editorRef.current?.destroyEditor?.();
    };
  }, [config, documentServerUrl, editorId, editorSize, token]);

  if (error) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={
        className ??
        "h-[calc(100vh-15rem)] min-h-[760px] w-full overflow-hidden rounded-[24px] bg-stone-950"
      }
    >
      <div
        id={editorId}
        className="h-full w-full overflow-hidden rounded-[24px] bg-stone-950"
      />
    </div>
  );
}
