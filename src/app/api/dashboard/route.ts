import { NextResponse } from "next/server";
import {
  getStats,
  listPlacements,
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

/** ISO 3166-1 alpha-2 → full English country name. */
const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AD: "Andorra", AO: "Angola",
  AG: "Antigua and Barbuda", AR: "Argentina", AM: "Armenia", AU: "Australia",
  AT: "Austria", AZ: "Azerbaijan", BS: "Bahamas", BH: "Bahrain", BD: "Bangladesh",
  BB: "Barbados", BY: "Belarus", BE: "Belgium", BZ: "Belize", BJ: "Benin",
  BT: "Bhutan", BO: "Bolivia", BA: "Bosnia and Herzegovina", BW: "Botswana",
  BR: "Brazil", BN: "Brunei", BG: "Bulgaria", BF: "Burkina Faso", BI: "Burundi",
  KH: "Cambodia", CM: "Cameroon", CA: "Canada", CV: "Cape Verde",
  CF: "Central African Republic", TD: "Chad", CL: "Chile", CN: "China",
  CO: "Colombia", KM: "Comoros", CG: "Congo", CD: "Congo (DRC)",
  CR: "Costa Rica", CI: "Côte d'Ivoire", HR: "Croatia", CU: "Cuba",
  CY: "Cyprus", CZ: "Czech Republic", DK: "Denmark", DJ: "Djibouti",
  DM: "Dominica", DO: "Dominican Republic", EC: "Ecuador", EG: "Egypt",
  SV: "El Salvador", GQ: "Equatorial Guinea", ER: "Eritrea", EE: "Estonia",
  SZ: "Eswatini", ET: "Ethiopia", FJ: "Fiji", FI: "Finland", FR: "France",
  GA: "Gabon", GM: "Gambia", GE: "Georgia", DE: "Germany", GH: "Ghana",
  GR: "Greece", GD: "Grenada", GT: "Guatemala", GN: "Guinea", GW: "Guinea-Bissau",
  GY: "Guyana", HT: "Haiti", HN: "Honduras", HK: "Hong Kong", HU: "Hungary",
  IS: "Iceland", IN: "India", ID: "Indonesia", IR: "Iran", IQ: "Iraq",
  IE: "Ireland", IL: "Israel", IT: "Italy", JM: "Jamaica", JP: "Japan",
  JO: "Jordan", KZ: "Kazakhstan", KE: "Kenya", KI: "Kiribati",
  KP: "North Korea", KR: "South Korea", KW: "Kuwait", KG: "Kyrgyzstan",
  LA: "Laos", LV: "Latvia", LB: "Lebanon", LS: "Lesotho", LR: "Liberia",
  LY: "Libya", LI: "Liechtenstein", LT: "Lithuania", LU: "Luxembourg",
  MO: "Macao", MG: "Madagascar", MW: "Malawi", MY: "Malaysia", MV: "Maldives",
  ML: "Mali", MT: "Malta", MH: "Marshall Islands", MR: "Mauritania",
  MU: "Mauritius", MX: "Mexico", FM: "Micronesia", MD: "Moldova",
  MC: "Monaco", MN: "Mongolia", ME: "Montenegro", MA: "Morocco",
  MZ: "Mozambique", MM: "Myanmar", NA: "Namibia", NR: "Nauru", NP: "Nepal",
  NL: "Netherlands", NZ: "New Zealand", NI: "Nicaragua", NE: "Niger",
  NG: "Nigeria", MK: "North Macedonia", NO: "Norway", OM: "Oman",
  PK: "Pakistan", PW: "Palau", PA: "Panama", PG: "Papua New Guinea",
  PY: "Paraguay", PE: "Peru", PH: "Philippines", PL: "Poland", PT: "Portugal",
  QA: "Qatar", RO: "Romania", RU: "Russia", RW: "Rwanda",
  KN: "Saint Kitts and Nevis", LC: "Saint Lucia",
  VC: "Saint Vincent and the Grenadines", WS: "Samoa", SM: "San Marino",
  ST: "São Tomé and Príncipe", SA: "Saudi Arabia", SN: "Senegal",
  RS: "Serbia", SC: "Seychelles", SL: "Sierra Leone", SG: "Singapore",
  SK: "Slovakia", SI: "Slovenia", SB: "Solomon Islands", SO: "Somalia",
  ZA: "South Africa", SS: "South Sudan", ES: "Spain", LK: "Sri Lanka",
  SD: "Sudan", SR: "Suriname", SE: "Sweden", CH: "Switzerland", SY: "Syria",
  TW: "Taiwan", TJ: "Tajikistan", TZ: "Tanzania", TH: "Thailand",
  TL: "Timor-Leste", TG: "Togo", TO: "Tonga", TT: "Trinidad and Tobago",
  TN: "Tunisia", TR: "Turkey", TM: "Turkmenistan", TV: "Tuvalu",
  UG: "Uganda", UA: "Ukraine", AE: "United Arab Emirates", GB: "United Kingdom",
  US: "United States", UY: "Uruguay", UZ: "Uzbekistan", VU: "Vanuatu",
  VA: "Vatican City", VE: "Venezuela", VN: "Vietnam", YE: "Yemen",
  ZM: "Zambia", ZW: "Zimbabwe",
};

function countryName(code: string): string {
  if (!code || code.length !== 2) return code || "Unknown";
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function summarize(items: { impression?: number; clicks?: number; ctr?: number; cpm?: number; revenue?: number }[]) {
  const impressions = items.reduce((s, r) => s + Number(r.impression ?? 0), 0);
  const clicks = items.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const revenue = items.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  return { impressions, clicks, revenue };
}

/** Validate YYYY-MM-DD and return true if format is valid. */
function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
}

export async function GET(request: Request) {
  const today = todayYMD();
  const url = new URL(request.url);

  // Allow client to override the date range via query params.
  // Both are clamped to the floor (MIN_DATE) and to today.
  const qStart = url.searchParams.get("start_date");
  const qFinish = url.searchParams.get("finish_date");

  let finishDate = today;
  if (qFinish && isValidYmd(qFinish)) {
    finishDate = qFinish > today ? today : qFinish;
  }

  let startDate = MIN_DATE;
  if (qStart && isValidYmd(qStart)) {
    startDate = qStart < MIN_DATE ? MIN_DATE : qStart;
  }
  if (startDate > finishDate) startDate = finishDate;

  // Compute 7/15/30-day window starts (clamped to the floor)
  const day7Start = addDays(finishDate, -6);
  const day15Start = addDays(finishDate, -14);
  const day30Start = addDays(finishDate, -29);

  try {
    // Run independent calls in parallel
    const [
      dailyRes,
      byLinkRes,
      byCountryRes,
      r7,
      r15,
      r30,
      placements,
    ] = await Promise.all([
      getStats({ startDate, finishDate, groupBy: ["date"] }),
      getStats({ startDate, finishDate, groupBy: ["placement"] }),
      getStats({ startDate, finishDate, groupBy: ["country"] }),
      getStats({ startDate: day7Start, finishDate, groupBy: ["date"] }),
      getStats({ startDate: day15Start, finishDate, groupBy: ["date"] }),
      getStats({ startDate: day30Start, finishDate, groupBy: ["date"] }),
      listPlacements(),
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

    // Per-link earnings — only placements that have a direct_url (active direct links).
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
      .filter((row) => !!row.directUrl) // ← only active direct links
      .sort((a, b) => b.revenue - a.revenue);

    const activeDirectLinksCount = linkEarnings.length;

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

    // Top 10 countries by revenue (with full names)
    const topCountries: CountryRow[] = byCountryRes.items
      .map((r) => {
        const cc = String(r.country ?? "—");
        return {
          countryCode: cc,
          countryName: countryName(cc),
          impressions: Number(r.impression ?? 0),
          clicks: Number(r.clicks ?? 0),
          ctr: Number(r.ctr ?? 0),
          cpm: Number(r.cpm ?? 0),
          revenue: Number(r.revenue ?? 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Range summaries
    const s7 = summarize(r7.items);
    const s15 = summarize(r15.items);
    const s30 = summarize(r30.items);

    const ranges: RangeSummary[] = [
      { label: "Last 7 days", days: 7, ...s7 },
      { label: "Last 15 days", days: 15, ...s15 },
      { label: "Last 30 days", days: 30, ...s30 },
    ];

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
      ranges,
      daily,
      linkEarnings,
      topCountries,
      placementsCount: placements.length,
      activeDirectLinksCount,
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
