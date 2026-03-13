import clsx from "clsx";
import { formatCurrencyBRL } from "@/lib/formatters/br";

export type DashboardActivityPoint = {
  label: string;
  clients: number;
  services: number;
  requests: number;
  amount: number;
};

export type DashboardStatusBreakdownItem = {
  label: string;
  value: number;
  tone: "neutral" | "accent" | "positive" | "warning" | "danger";
};

export type DashboardPortfolioLoadItem = {
  label: string;
  subtitle?: string;
  clients: number;
  pending: number;
  isUnassigned?: boolean;
};

const activitySeries = [
  {
    key: "clients",
    label: "Clientes",
    barClassName: "bg-stone-300",
    badgeClassName: "bg-stone-200 text-stone-800",
  },
  {
    key: "services",
    label: "Servicos",
    barClassName: "bg-accent/80",
    badgeClassName: "bg-sky-100 text-sky-700",
  },
  {
    key: "requests",
    label: "Solicitacoes",
    barClassName: "bg-orange-400",
    badgeClassName: "bg-orange-100 text-orange-700",
  },
] as const;

const toneClassNames = {
  neutral: "bg-stone-100 text-stone-700",
  accent: "bg-sky-100 text-sky-700",
  positive: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
} as const;

const toneHexColors = {
  neutral: "#d6d3d1",
  accent: "#2563eb",
  positive: "#16a34a",
  warning: "#f59e0b",
  danger: "#ef4444",
} as const;

function resolveBarHeight(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) {
    return "0%";
  }

  return `${Math.max((value / maxValue) * 100, 10)}%`;
}

function resolveBarWidth(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) {
    return "0%";
  }

  return `${Math.max((value / maxValue) * 100, 8)}%`;
}

export function MonthlyActivityChart({
  points,
}: {
  points: DashboardActivityPoint[];
}) {
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) => [point.clients, point.services, point.requests]),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {activitySeries.map((series) => (
          <span
            key={series.key}
            className={clsx(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
              series.badgeClassName,
            )}
          >
            <span className={clsx("size-2 rounded-full", series.barClassName)} />
            {series.label}
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {points.map((point) => (
          <div key={point.label} className="rounded-[26px] border border-line bg-white/80 p-3">
            <div className="flex h-44 items-end justify-center gap-1.5 rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0.7)_100%)] px-2 pb-3 pt-4">
              {activitySeries.map((series) => (
                <div key={series.key} className="flex h-full items-end">
                  <div
                    className={clsx("w-4 rounded-t-full transition-all duration-300", series.barClassName)}
                    style={{
                      height: resolveBarHeight(point[series.key], maxValue),
                    }}
                    title={`${series.label}: ${point[series.key].toLocaleString("pt-BR")}`}
                  />
                </div>
              ))}
            </div>

            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                {point.label}
              </p>
              <div className="mt-2 grid gap-1 text-xs text-muted">
                <p>{point.clients.toLocaleString("pt-BR")} clientes</p>
                <p>{point.services.toLocaleString("pt-BR")} servicos</p>
                <p>{point.requests.toLocaleString("pt-BR")} solicitacoes</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthlyAmountChart({
  points,
}: {
  points: DashboardActivityPoint[];
}) {
  const maxAmount = Math.max(1, ...points.map((point) => point.amount));

  return (
    <div className="grid gap-3">
      {points.map((point) => (
        <div
          key={point.label}
          className="rounded-[22px] border border-line bg-white/80 px-4 py-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{point.label}</p>
              <p className="mt-1 text-xs text-muted">
                {point.services.toLocaleString("pt-BR")} servicos executados
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {formatCurrencyBRL(point.amount)}
            </p>
          </div>

          <div className="mt-4 h-3 rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent)_0%,var(--highlight)_100%)]"
              style={{
                width: resolveBarWidth(point.amount, maxAmount),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusBreakdownChart({
  items,
}: {
  items: DashboardStatusBreakdownItem[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const percentage = total > 0 ? (item.value / total) * 100 : 0;

        return (
          <div
            key={item.label}
            className="rounded-[22px] border border-line bg-white/80 px-4 py-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                    toneClassNames[item.tone],
                  )}
                >
                  {item.label}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">
                  {item.value.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted">
                  {percentage.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 rounded-full bg-stone-100">
              <div
                className={clsx("h-full rounded-full", toneClassNames[item.tone].split(" ")[0])}
                style={{
                  width: `${percentage}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PortfolioLoadChart({
  items,
  emptyMessage,
}: {
  items: DashboardPortfolioLoadItem[];
  emptyMessage: string;
}) {
  const maxClients = Math.max(1, ...items.map((item) => item.clients));

  if (items.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-line bg-white/70 px-5 py-8 text-sm text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.subtitle ?? "sem-subtitulo"}`}
          className="rounded-[24px] border border-line bg-white/80 px-4 py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {item.label}
              </p>
              {item.subtitle ? (
                <p className="mt-1 truncate text-xs text-muted">{item.subtitle}</p>
              ) : null}
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-foreground">
                {item.clients.toLocaleString("pt-BR")}
              </p>
              <p className="text-xs text-muted">clientes ativos</p>
            </div>
          </div>

          <div className="mt-4 h-3 rounded-full bg-stone-100">
            <div
              className={clsx(
                "h-full rounded-full",
                item.isUnassigned
                  ? "bg-[linear-gradient(90deg,#f97316_0%,#fb7185_100%)]"
                  : "bg-[linear-gradient(90deg,var(--accent)_0%,#60a5fa_100%)]",
              )}
              style={{
                width: resolveBarWidth(item.clients, maxClients),
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
            <span>{item.pending.toLocaleString("pt-BR")} assinaturas pendentes</span>
            {item.isUnassigned ? (
              <span className="rounded-full bg-orange-100 px-2.5 py-1 font-semibold text-orange-700">
                Redistribuir
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardDonutChart({
  items,
}: {
  items: DashboardStatusBreakdownItem[];
}) {
  const total = Math.max(
    1,
    items.reduce((sum, item) => sum + item.value, 0),
  );
  const percentages = items.map((item) => (item.value / total) * 100);
  const segments = items.map((item, index) => {
    const start = percentages
      .slice(0, index)
      .reduce((sum, value) => sum + value, 0);
    const percentage = percentages[index] ?? 0;
    const end = start + percentage;

    return {
      ...item,
      percentage,
      gradient: `${toneHexColors[item.tone]} ${start}% ${end}%`,
    };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-full bg-stone-100">
        <div
          className="relative flex h-52 w-52 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${segments.map((segment) => segment.gradient).join(", ")})`,
          }}
        >
          <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white shadow-sm">
            <p className="eyebrow text-muted">Total</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {total.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {segments.map((item) => (
          <div
            key={item.label}
            className="rounded-[22px] border border-line bg-white/80 px-4 py-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: toneHexColors[item.tone] }}
                />
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">
                  {item.value.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted">
                  {item.percentage.toLocaleString("pt-BR", {
                    maximumFractionDigits: 0,
                  })}
                  %
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardLineChart({
  points,
  valueKey,
}: {
  points: DashboardActivityPoint[];
  valueKey: "clients" | "services" | "requests";
}) {
  const width = 520;
  const height = 220;
  const paddingX = 24;
  const paddingY = 22;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const values = points.map((point) => point[valueKey]);
  const maxValue = Math.max(1, ...values);
  const minValue = 0;

  const coordinates = points.map((point, index) => {
    const x =
      paddingX +
      (points.length <= 1 ? 0 : (index / (points.length - 1)) * chartWidth);
    const normalized = (point[valueKey] - minValue) / (maxValue - minValue || 1);
    const y = paddingY + chartHeight - normalized * chartHeight;

    return {
      x,
      y,
      label: point.label,
      value: point[valueKey],
    };
  });

  const pathData = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div>
      <div className="rounded-[28px] border border-line bg-white/80 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((line) => {
            const y = paddingY + chartHeight - line * chartHeight;
            return (
              <line
                key={line}
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
                stroke="rgba(23, 33, 27, 0.08)"
                strokeDasharray="4 6"
              />
            );
          })}

          <path
            d={pathData}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {coordinates.map((point) => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="4.5" fill="#2563eb" />
              <circle cx={point.x} cy={point.y} r="8" fill="rgba(37,99,235,0.12)" />
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
        {coordinates.map((point) => (
          <div key={`${point.label}-label`} className="rounded-[18px] bg-white/60 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              {point.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {point.value.toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
