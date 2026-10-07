import type { Config, Context } from "@netlify/functions";

// GET /api/quotes?isins=IE00BK5BQT80,IE00B4L5Y983
// Optional &days=7 shortens the history (5 to 92, default 92).
// Returns, per ISIN, the latest EUR quote, the previous close and about three months of daily closes.
export default async (req: Request, _context: Context) => {
  const isinPattern = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
  const params = new URL(req.url).searchParams;
  const requested = (params.get("isins") || "").toUpperCase().split(",");
  const isins = [...new Set(requested.filter((s) => isinPattern.test(s)))].slice(0, 30);
  if (!isins.length) {
    return Response.json({ error: "Pass ?isins= with one or more ISINs." }, { status: 400 });
  }

  const day = (d: Date) => d.toISOString().slice(0, 10);
  const to = new Date();
  const days = Math.min(92, Math.max(5, Number(params.get("days")) || 92));
  const from = new Date(to.getTime() - days * 86400000);
  const out: Record<string, unknown> = {};

  await Promise.all(isins.map(async (isin) => {
    try {
      const url = `https://www.justetf.com/api/etfs/${isin}/performance-chart?locale=en&currency=EUR` +
        `&valuesType=MARKET_VALUE&reduceData=false&includeDividends=false&features=DIVIDENDS` +
        `&dateFrom=${day(from)}&dateTo=${day(to)}`;
      const res = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const data = await res.json();
      const points: Record<string, number> = {};
      for (const p of data.series || []) {
        const v = p?.value?.raw;
        const weekday = new Date(p.date + "T12:00:00Z").getUTCDay();
        if (typeof v === "number" && weekday !== 0 && weekday !== 6) points[p.date] = v;
      }
      const days = Object.keys(points).sort();
      if (!days.length) return;
      const latest = typeof data.latestQuote?.raw === "number" ? data.latestQuote.raw : points[days[days.length - 1]];
      const date = data.latestQuoteDate || days[days.length - 1];
      points[date] = latest;
      const earlier = days.filter((d) => d < date);
      out[isin] = {
        price: latest,
        date,
        prev: earlier.length ? points[earlier[earlier.length - 1]] : null,
        venue: "justETF",
        points,
      };
    } catch {
      // Leave this ISIN out; the page shows "No price yet" for it.
    }
  }));

  return Response.json(out, {
    headers: {
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": `public, max-age=${days <= 7 ? 60 : 10}`,
    },
  });
};

export const config: Config = { path: "/api/quotes" };
