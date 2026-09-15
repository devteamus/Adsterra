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
  ExternalLink,
  Eye,
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

interface SmartLink {
  id: number;
  title: string;
  url: string;
  trafficType: string;
  status: string;
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
  daily: DailyPoint[];
  linkEarnings: LinkEarning[];
  smartLinks: SmartLink[];
  placementsCount: number;
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
  // iso = YYYY-MM-DD, render as "Sep 4"
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard", {
        cache: "no-store",
        headers: { "x-vercel-no-cache": "1" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.error || `Request failed with HTTP ${res.status}`
        );
      }
      const json = (await res.json()) as DashboardData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const topLink = useMemo(() => {
    if (!data || data.linkEarnings.length === 0) return null;
    return data.linkEarnings[0];
  }, [data]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold leading-tight">
                Adsterra Revenue
              </h1>
              <p className="text-xs text-muted-foreground">
                {data
                  ? `${data.startDate} → ${data.finishDate}`
                  : "Loading date range…"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data?.dbLastUpdateTime && (
              <span className="hidden sm:inline text-xs text-muted-foreground">
                Updated {new Date(data.dbLastUpdateTime + "Z").toLocaleString()}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<Wallet className="size-4" />}
            label="Total Balance"
            value={loading ? null : formatUsd(data?.totals.revenue ?? 0)}
            hint="Revenue since Sept 1, 2026"
            tone="primary"
          />
          <KpiCard
            icon={<Eye className="size-4" />}
            label="Impressions"
            value={loading ? null : formatInt(data?.totals.impressions ?? 0)}
            hint={`${data?.placementsCount ?? 0} placements tracked`}
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
            hint="Per 1,000 impressions"
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Daily Revenue
                </CardTitle>
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
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Stat
                      label="Share of total"
                      value={formatPct(topLink.share)}
                    />
                    <Stat label="Impressions" value={formatInt(topLink.impressions)} />
                    <Stat label="Clicks" value={formatInt(topLink.clicks)} />
                    <Stat label="CTR" value={formatPct(topLink.ctr)} />
                  </div>
                  {topLink.directUrl && (
                    <a
                      href={topLink.directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-full"
                    >
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate">{topLink.directUrl}</span>
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No link earnings recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Per-Link Earnings
                </CardTitle>
                <Badge variant="secondary">
                  {data?.linkEarnings.length ?? 0} links
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[320px] w-full" />
              ) : (
                <div className="max-h-[400px] overflow-y-auto rounded-md border border-border/60 custom-scroll">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="w-[34%]">Link</TableHead>
                        <TableHead className="text-right">Impr.</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">CPM</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.linkEarnings.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground py-8"
                          >
                            No per-link data since Sept 1, 2026.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data?.linkEarnings.map((row) => (
                          <TableRow key={row.placementId}>
                            <TableCell>
                              <div className="font-medium truncate max-w-[220px]">
                                {row.title}
                              </div>
                              {row.directUrl && (
                                <a
                                  href={row.directUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-muted-foreground hover:text-primary truncate block max-w-[220px]"
                                >
                                  {row.directUrl}
                                </a>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatInt(row.impressions)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatInt(row.clicks)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatUsd(row.cpm)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatUsd(row.revenue)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
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
                <CardTitle className="text-sm font-medium">
                  Smart Links
                </CardTitle>
                <Badge variant="secondary">
                  {data?.smartLinks.length ?? 0}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[320px] w-full" />
              ) : data?.smartLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No SmartLinks configured.
                </p>
              ) : (
                <div className="max-h-[400px] overflow-y-auto space-y-2 custom-scroll pr-1">
                  {data?.smartLinks.map((sl) => (
                    <div
                      key={sl.id}
                      className="rounded-md border border-border/60 p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {sl.title}
                        </span>
                        <Badge
                          variant={sl.status === "Active" ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {sl.status}
                        </Badge>
                      </div>
                      <a
                        href={sl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary truncate block flex items-center gap-1"
                      >
                        <Link2 className="size-3 shrink-0" />
                        <span className="truncate">{sl.url}</span>
                      </a>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {sl.trafficType} · ID {sl.id}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="mt-auto border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
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
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          <span
            className={`size-7 rounded-md grid place-items-center ${
              tone === "primary"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {icon}
          </span>
        </div>
        <div className="mt-3 text-2xl font-semibold tabular-nums">
          {value ?? <Skeleton className="h-7 w-24" />}
        </div>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
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
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-12 text-right">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function RevenueChart({ daily }: { daily: DailyPoint[] }) {
  if (daily.length === 0) {
    return (
      <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">
        No revenue recorded yet since Sept 1, 2026.
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
