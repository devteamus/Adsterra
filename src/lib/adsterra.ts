/**
 * Adsterra Publisher API client (server-only).
 *
 * Base URL: https://api3.adsterratools.com/publisher
 * Auth:     X-API-Key header (env: ADSTERRA_API_KEY)
 *
 * Docs: https://docs.adsterratools.com/public/v3/publishers-api
 *
 * All public functions below FORCE a minimum start_date of 2026-09-01
 * (configurable via ADSTERRA_MIN_DATE). Any request whose start_date is
 * earlier than the floor is automatically clamped to the floor, so old
 * data can NEVER leak to the dashboard.
 */

export const ADSTERRA_BASE_URL = "https://api3.adsterratools.com/publisher";
export const ADSTERRA_MIN_DATE = process.env.ADSTERRA_MIN_DATE ?? "2026-09-01";

const MAX_RANGE_DAYS = 366; // Adsterra hard cap per request

export interface AdsterraPlacement {
  id: number;
  domain_id?: number;
  title: string;
  alias: string;
  direct_url?: string;
}

export interface AdsterraSmartLink {
  id: number;
  title: string;
  alias: string;
  url: string;
  traffic_type: string;
  status: string;
}

export interface AdsterraStatRow {
  date?: string;
  domain?: number;
  placement?: number;
  country?: string;
  placement_sub_id?: string;
  impression: number;
  clicks: number;
  ctr: number;
  cpm: number;
  revenue: number;
}

export interface AdsterraStatsResponse {
  items: AdsterraStatRow[];
  itemCount: number;
  dbLastUpdateTime?: string;
  dbDateTime?: string;
}

export interface AdsterraError {
  error: string;
  status: number;
  body: unknown;
}

function getApiKey(): string {
  const key = process.env.ADSTERRA_API_KEY;
  if (!key) {
    throw new Error(
      "ADSTERRA_API_KEY environment variable is not set. Add it in .env locally or in Vercel project settings."
    );
  }
  return key;
}

/** Convert a Date to YYYY-MM-DD (UTC). */
function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add n days to a YYYY-MM-DD date string, return YYYY-MM-DD. */
function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return toYMD(d);
}

/** True if `ymd` is strictly before the floor date. */
function isBeforeFloor(ymd: string, floor: string): boolean {
  return ymd < floor;
}

/**
 * Split a [start, finish] range into chunks of MAX_RANGE_DAYS so we never
 * hit Adsterra's "Date range cannot exceed 366 days" validation error.
 */
function chunkRange(startYmd: string, finishYmd: string): Array<[string, string]> {
  const chunks: Array<[string, string]> = [];
  let cursor = startYmd;
  while (cursor <= finishYmd) {
    const chunkFinish = addDays(cursor, MAX_RANGE_DAYS - 1);
    const end = chunkFinish > finishYmd ? finishYmd : chunkFinish;
    chunks.push([cursor, end]);
    // move to the day AFTER `end` to avoid overlap
    cursor = addDays(end, 1);
    if (chunks.length > 20) break; // safety guard (~20 years)
  }
  return chunks;
}

async function adsterraFetch<T>(
  path: string,
  params: Record<string, string | string[] | undefined>
): Promise<T> {
  const url = new URL(ADSTERRA_BASE_URL + path);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(`${key}[]`, v);
    } else {
      url.searchParams.set(key, value);
    }
  }

  const key = getApiKey();
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        "X-API-Key": key,
        Accept: "application/json",
      },
      // Cache for 5 minutes on Vercel; dashboard refresh button bypasses via tag.
      next: { revalidate: 300, tags: ["adsterra"] },
    });
  } catch (err) {
    throw new Error(
      `Network error calling Adsterra API: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      try {
        body = await res.text();
      } catch {
        body = null;
      }
    }
    const message =
      typeof body === "object" && body && "message" in body
        ? String((body as { message?: unknown }).message)
        : `Adsterra API returned HTTP ${res.status}`;
    throw new AdsterraApiError(message, res.status, body);
  }

  try {
    return (await res.json()) as T;
  } catch (err) {
    throw new Error(
      `Failed to parse Adsterra JSON response: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export class AdsterraApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "AdsterraApiError";
    this.status = status;
    this.body = body;
  }
}

/* -------------------------------------------------------------------------- */
/*                              Public endpoints                              */
/* -------------------------------------------------------------------------- */

export async function listPlacements(): Promise<AdsterraPlacement[]> {
  const data = await adsterraFetch<{ items: AdsterraPlacement[]; itemCount: number }>(
    "/placements.json",
    {}
  );
  return data.items ?? [];
}

export async function listSmartLinks(): Promise<AdsterraSmartLink[]> {
  const data = await adsterraFetch<{ data: { items: AdsterraSmartLink[] } }>(
    "/smart-links.json",
    {}
  );
  return data.data?.items ?? [];
}

/**
 * Fetch stats grouped by `group_by` for a date range, automatically split
 * into 366-day chunks. The start date is clamped to ADSTERRA_MIN_DATE so
 * old data is impossible to retrieve.
 */
export async function getStats(args: {
  startDate: string;
  finishDate: string;
  groupBy: ("date" | "domain" | "placement" | "country" | "placement_sub_id")[];
  domain?: number;
  placement?: number;
  country?: string;
  placementIds?: number[];
}): Promise<AdsterraStatsResponse> {
  // Force-start at the floor date. This is the core "no old data" guarantee.
  const clampedStart = isBeforeFloor(args.startDate, ADSTERRA_MIN_DATE)
    ? ADSTERRA_MIN_DATE
    : args.startDate;
  if (clampedStart > args.finishDate) {
    // entire requested window is before the floor → return empty
    return { items: [], itemCount: 0 };
  }

  const chunks = chunkRange(clampedStart, args.finishDate);
  const merged: AdsterraStatRow[] = [];
  let dbLastUpdateTime: string | undefined;
  let dbDateTime: string | undefined;
  let totalCount = 0;

  for (const [start, finish] of chunks) {
    const data = await adsterraFetch<AdsterraStatsResponse>("/stats.json", {
      start_date: start,
      finish_date: finish,
      group_by: args.groupBy,
      domain: args.domain?.toString(),
      placement: args.placement?.toString(),
      country: args.country,
      placement_ids: args.placementIds?.map(String),
    });
    if (data.items) merged.push(...data.items);
    totalCount += data.itemCount ?? 0;
    if (data.dbLastUpdateTime) dbLastUpdateTime = data.dbLastUpdateTime;
    if (data.dbDateTime) dbDateTime = data.dbDateTime;
  }

  return {
    items: merged,
    itemCount: totalCount,
    dbLastUpdateTime,
    dbDateTime,
  };
}

/**
 * Convenience: today's date in YYYY-MM-DD (UTC).
 */
export function todayYMD(): string {
  return toYMD(new Date());
}

export const MIN_DATE = ADSTERRA_MIN_DATE;
