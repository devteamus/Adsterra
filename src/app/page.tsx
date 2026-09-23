"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Calendar,
  Eye,
  Globe2,
  Link2,
  MousePointerClick,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LinkEarning {
  placementId: number;
  title: string;
  alias: string;
  directUrl: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  revenue: number;
  share: number;
}

interface DailyPoint {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  revenue: number;
}

interface RangeSummary {
  label: string;
  days: number;
  revenue: number;
  impressions: number;
  clicks: number;
}

interface CountryRow {
  countryCode: string;
  countryName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  revenue: number;
}

interface DashboardData {
  minDate: string;
  startDate: string;
  finishDate: string;
  dbLastUpdateTime: string | null;
  totals: {
    revenue: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpm: number;
  };
  ranges: RangeSummary[];
  daily: DailyPoint[];
  linkEarnings: LinkEarning[];
  topCountries: CountryRow[];
  placementsCount: number;
  activeDirectLinksCount: number;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

function formatInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function todayYMDLocal(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function flagEmoji(country: string): string {
  if (!country || country.length !== 2 || country === "—") return "🏳️";
  const code = country.toUpperCase();
  const cp: number[] = [];
  for (let i = 0; i < code.length; i++) {
    cp.push(0x1f1e6 + (code.charCodeAt(i) - 65));
  }
  return String.fromCodePoint(...cp);
}

export default function DashboardPage() {
  // Default range: from the API floor (Sept 1, 2026) to today.
  const FLOOR = "2026-09-01";
  const [startDate, setStartDate] = useState<string>(FLOOR);
  const [finishDate, setFinishDate] = useState<string>(todayYMDLocal());

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          start_date: startDate,
          finish_date: finishDate,
        });
        const res = await fetch(`/api/dashboard?${qs.toString()}`, {
          cache: "no-store",
          headers: { "x-vercel-no-cache": "1" },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Request failed with HTTP ${res.status}`);
        }
        const json = (await res.json()) as DashboardData;
        setData(json);
        // Sync local state to actual clamped values returned by server.
        setStartDate(json.startDate);
        setFinishDate(json.finishDate);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [startDate, finishDate]
  );

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyRange = useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  const topLink = useMemo(() => {
    if (!data || data.linkEarnings.length === 0) return null;
    return data.linkEarnings[0];
  }, [data]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="size-8 sm:size-9 shrink-0 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <TrendingUp className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-semibold leading-tight truncate">
                Adsterra Revenue
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                {data ? `${data.startDate} → ${data.finishDate}` : "Loading date range…"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data?.dbLastUpdateTime && (
              <span className="hidden md:inline text-xs text-muted-foreground">
                Updated {new Date(data.dbLastUpdateTime + "Z").toLocaleString()}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-7xl w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Failed to load dashboard</AlertTitle>
            <AlertDescription>
              {error}
              {error.includes("ADSTERRA_API_KEY") && (
                <span className="block mt-2 text-xs">
                  Add <code className="font-mono">ADSTERRA_API_KEY</code> to your
                  Vercel project settings (or to <code>.env.local</code> locally)
                  and redeploy.
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Custom date range picker */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
              <div className="flex items-center gap-2 text-sm font-medium shrink-0">
                <Calendar className="size-4 text-muted-foreground" />
                Date range
              </div>
              <div className="grid grid-cols-2 sm:flex sm:flex-1 gap-2 sm:gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-muted-foreground">From</label>
                  <Input
                    type="date"
                    value={startDate}
                    min={FLOOR}
                    max={finishDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-muted-foreground">To</label>
                  <Input
                    type="date"
                    value={finishDate}
                    min={startDate}
                    max={todayYMDLocal()}
                    onChange={(e) => setFinishDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <Button onClick={applyRange} disabled={loading} className="h-9 sm:w-auto w-full">
                <TrendingUp className="size-4" />
                Apply
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Earliest available date: {FLOOR}. Old data is hidden permanently.
            </p>
          </CardContent>
        </Card>

        {/* Top KPI row: Live Balance + 7/15/30 day ranges */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            icon={<Wallet className="size-4" />}
            label="Live Balance"
            value={loading ? null : formatUsd(data?.totals.revenue ?? 0)}
            hint={`Selected range`}
            tone="primary"
          />
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            (data?.ranges ?? []).map((r) => (
              <KpiCard
                key={r.label}
                icon={<TrendingUp className="size-4" />}
                label={r.label}
                value={formatUsd(r.revenue)}
                hint={`${formatInt(r.impressions)} impr · ${formatInt(r.clicks)} clicks`}
              />
            ))
          )}
        </section>

        {/* Secondary KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            icon={<Eye className="size-4" />}
            label="Impressions"
            value={loading ? null : formatInt(data?.totals.impressions ?? 0)}
            hint={`${data?.placementsCount ?? 0} placements`}
          />
          <KpiCard
            icon={<MousePointerClick className="size-4" />}
            label="Clicks"
            value={loading ? null : formatInt(data?.totals.clicks ?? 0)}
            hint={`CTR ${formatPct(data?.totals.ctr ?? 0)}`}
          />
          <KpiCard
            icon={<Activity className="size-4" />}
            label="Avg CPM"
            value={loading ? null : formatUsd(data?.totals.cpm ?? 0)}
            hint="Per 1,000 impr."
          />
          <KpiCard
            icon={<Link2 className="size-4" />}
            label="Active Direct Links"
            value={loading ? null : formatInt(data?.activeDirectLinksCount ?? 0)}
            hint="With direct URL"
          />
        </section>

        {/* Daily chart + Top earner */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
                <Badge variant="secondary">USD</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : (
                <RevenueChart daily={data?.daily ?? []} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top Earner</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : topLink ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold tabular-nums">
                      {formatUsd(topLink.revenue)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 truncate">
                      {topLink.title}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Stat label="Share of total" value={formatPct(topLink.share)} />
                    <Stat label="Impressions" value={formatInt(topLink.impressions)} />
                    <Stat label="Clicks" value={formatInt(topLink.clicks)} />
                    <Stat label="CTR" value={formatPct(topLink.ctr)} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No link earnings recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Per-link + Top 10 countries */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Active Direct Links — Earnings</CardTitle>
                <Badge variant="secondary">
                  {data?.linkEarnings.length ?? 0} links
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[320px] w-full" />
              ) : (
                <div className="max-h-[480px] overflow-y-auto rounded-md border border-border/60 custom-scroll">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="w-[32%]">Link</TableHead>
                        <TableHead className="text-right">Impr.</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">CPM</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.linkEarnings.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground py-8 text-sm"
                          >
                            No active direct links with earnings in the selected range.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data?.linkEarnings.map((row) => (
                          <TableRow key={row.placementId}>
                            <TableCell>
                              <div className="font-medium truncate max-w-[160px] sm:max-w-[240px]">
                                {row.title}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatInt(row.impressions)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatInt(row.clicks)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums hidden sm:table-cell">
                              {formatUsd(row.cpm)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatUsd(row.revenue)}
                            </TableCell>
                            <TableCell className="text-right hidden sm:table-cell">
                              <ShareBar value={row.share} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Top 10 Countries</CardTitle>
                <Globe2 className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[420px] w-full" />
              ) : data?.topCountries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No country breakdown available.
                </p>
              ) : (
                <div className="max-h-[480px] overflow-y-auto space-y-2 custom-scroll pr-1">
                  {data?.topCountries.map((c, i) => {
                    const max = data?.topCountries[0]?.revenue ?? 1;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm gap-2">
                          <span className="font-medium flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{flagEmoji(c.countryCode)}</span>
                            <span className="truncate">{c.countryName}</span>
                          </span>
                          <span className="tabular-nums font-medium shrink-0">
                            {formatUsd(c.revenue)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            {formatInt(c.impressions)} impr · {formatInt(c.clicks)} clicks
                          </span>
                          <span>CPM {formatUsd(c.cpm)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{
                              width: `${Math.min(100, (c.revenue / max) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="mt-auto border-t border-border/60 py-4 text-center text-[11px] sm:text-xs text-muted-foreground px-3">
        Data source: Adsterra Publisher API · Only showing data from{" "}
        {data?.minDate ?? "2026-09-01"} onwards
      </footer>

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: var(--muted-foreground);
          border-radius: 999px;
          opacity: 0.5;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  hint?: string;
  tone?: "primary";
}) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
            {label}
          </span>
          <span
            className={`size-6 sm:size-7 shrink-0 rounded-md grid place-items-center ${
              tone === "primary"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {icon}
          </span>
        </div>
        <div className="mt-2 sm:mt-3 text-lg sm:text-2xl font-semibold tabular-nums truncate">
          {value ?? <Skeleton className="h-6 sm:h-7 w-20 sm:w-24" />}
        </div>
        {hint && (
          <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground truncate">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="size-7 rounded-md" />
        </div>
        <Skeleton className="mt-3 h-7 w-24" />
        <Skeleton className="mt-2 h-3 w-32" />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}

function ShareBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-12 sm:w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-10 text-right">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function RevenueChart({ daily }: { daily: DailyPoint[] }) {
  if (daily.length === 0) {
    return (
      <div className="h-[260px] grid place-items-center text-sm text-muted-foreground text-center px-4">
        No revenue recorded in the selected range.
      </div>
    );
  }
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={daily}
          margin={{ top: 10, right: 12, bottom: 0, left: -10 }}
        >
          <defs>
            <linearGradient id="rev-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.5}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
            labelFormatter={(label) => formatDateLabel(String(label))}
            formatter={(value: number, name) => {
              if (name === "revenue")
                return [`$${Number(value).toFixed(4)}`, "Revenue"];
              return [String(value), name];
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#rev-gradient)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
