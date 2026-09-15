import { NextResponse } from "next/server";
import {
  getStats,
  listPlacements,
  listSmartLinks,
  todayYMD,
  MIN_DATE,
  AdsterraApiError,
} from "@/lib/adsterra";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 min

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
  share: number; // % of total revenue
}

interface DailyPoint {
  date: string;
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
  daily: DailyPoint[];
  linkEarnings: LinkEarning[];
  smartLinks: {
    id: number;
    title: string;
    url: string;
    trafficType: string;
    status: string;
  }[];
  placementsCount: number;
}

export async function GET() {
  const startDate = MIN_DATE; // hard floor: 2026-09-01
  const finishDate = todayYMD();

  try {
    // Run independent calls in parallel
    const [dailyRes, byLinkRes, placements, smartLinks] = await Promise.all([
      getStats({
        startDate,
        finishDate,
        groupBy: ["date"],
      }),
      getStats({
        startDate,
        finishDate,
        groupBy: ["placement"],
      }),
      listPlacements(),
      listSmartLinks(),
    ]);

    // Build placement lookup: id -> { title, alias, direct_url }
    const placementMap = new Map<number, { title: string; alias: string; directUrl?: string }>();
    for (const p of placements) {
      placementMap.set(p.id, {
        title: p.title ?? `Placement ${p.id}`,
        alias: p.alias ?? p.title,
        directUrl: p.direct_url,
      });
    }

    const totalRevenue = byLinkRes.items.reduce((s, r) => s + Number(r.revenue ?? 0), 0);

    const linkEarnings: LinkEarning[] = byLinkRes.items
      .map((r) => {
        const id = Number(r.placement);
        const meta = placementMap.get(id);
        return {
          placementId: id,
          title: meta?.title ?? `Placement ${id}`,
          alias: meta?.alias ?? `Placement ${id}`,
          directUrl: meta?.directUrl ?? null,
          impressions: Number(r.impression ?? 0),
          clicks: Number(r.clicks ?? 0),
          ctr: Number(r.ctr ?? 0),
          cpm: Number(r.cpm ?? 0),
          revenue: Number(r.revenue ?? 0),
          share: totalRevenue > 0 ? (Number(r.revenue ?? 0) / totalRevenue) * 100 : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const daily: DailyPoint[] = dailyRes.items
      .map((r) => ({
        date: r.date ?? "",
        impressions: Number(r.impression ?? 0),
        clicks: Number(r.clicks ?? 0),
        ctr: Number(r.ctr ?? 0),
        cpm: Number(r.cpm ?? 0),
        revenue: Number(r.revenue ?? 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totals = {
      revenue: totalRevenue,
      impressions: dailyRes.items.reduce((s, r) => s + Number(r.impression ?? 0), 0),
      clicks: dailyRes.items.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
      ctr: 0,
      cpm: 0,
    };
    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    totals.cpm = totals.impressions > 0 ? (totals.revenue / totals.impressions) * 1000 : 0;

    const payload: DashboardData = {
      minDate: MIN_DATE,
      startDate,
      finishDate,
      dbLastUpdateTime: byLinkRes.dbLastUpdateTime ?? dailyRes.dbLastUpdateTime ?? null,
      totals,
      daily,
      linkEarnings,
      smartLinks: smartLinks.map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        trafficType: s.traffic_type,
        status: s.status,
      })),
      placementsCount: placements.length,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    if (err instanceof AdsterraApiError) {
      return NextResponse.json(
        {
          error: err.message,
          status: err.status,
          details: err.body,
        },
        { status: err.status >= 400 && err.status < 600 ? err.status : 500 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
