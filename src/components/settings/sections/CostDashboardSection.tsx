/**
 * Settings → Cost dashboard (Phase 5 / F-P5-05).
 *
 * Client-rendered, read-only view of `llm_usage` for the current user.
 * Groups rows three ways in a single card so students can see where
 * their money goes without scrolling through dozens of charts:
 *
 *   1. Last-7-days total + per-day sparkline.
 *   2. Breakdown by `surface` (review / live / paths / master / ...).
 *   3. Breakdown by `role`  (prescribe / evaluate / scenario / ...).
 *
 * All data is pulled with a single `select` — we aggregate in memory
 * because token volumes are low (a few hundred rows per week per user).
 *
 * If the `llm_usage` migration hasn't been applied, the select returns
 * an error and the dashboard renders an "empty state" (same UX as
 * before the table existed).
 */
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { supabase } from '../../../services/supabase/client';
import { getCurrentUser } from '../../../services/supabase/auth';

interface LlmUsageRow {
  provider: string;
  model: string;
  surface: string;
  role: string;
  operation: string;
  tokens_in: number;
  tokens_out: number;
  seconds_used: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  created_at: string;
}

interface Breakdown {
  key: string;
  cost: number;
  calls: number;
  tokens: number;
}

interface DailyPoint {
  day: string;
  cost: number;
  calls: number;
}

const WINDOW_DAYS = 7;

function formatUsd(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `<$0.01`;
  return `$${cost.toFixed(cost < 1 ? 3 : 2)}`;
}

function isoDay(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function buildBreakdown(rows: LlmUsageRow[], key: 'surface' | 'role'): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const r of rows) {
    const k = r[key] || 'unknown';
    const existing = map.get(k) ?? { key: k, cost: 0, calls: 0, tokens: 0 };
    existing.cost += r.cost_usd ?? 0;
    existing.calls += 1;
    existing.tokens += (r.tokens_in ?? 0) + (r.tokens_out ?? 0);
    map.set(k, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

function buildDailySeries(rows: LlmUsageRow[]): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (const r of rows) {
    const day = isoDay(r.created_at);
    const existing = map.get(day) ?? { day, cost: 0, calls: 0 };
    existing.cost += r.cost_usd ?? 0;
    existing.calls += 1;
    map.set(day, existing);
  }
  // Fill missing days for a stable sparkline
  const series: DailyPoint[] = [];
  const end = new Date();
  for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push(map.get(key) ?? { day: key, cost: 0, calls: 0 });
  }
  return series;
}

export function CostDashboardSection() {
  const [rows, setRows] = useState<LlmUsageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchRows = async () => {
      const user = getCurrentUser();
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const since = new Date();
        since.setDate(since.getDate() - WINDOW_DAYS);
        const { data, error: qErr } = await supabase
          .from('llm_usage')
          .select(
            'provider, model, surface, role, operation, tokens_in, tokens_out, seconds_used, cost_usd, latency_ms, created_at',
          )
          .eq('user_id', user.id)
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false })
          .limit(2000);
        if (qErr) {
          throw qErr;
        }
        if (!cancelled) setRows((data ?? []) as LlmUsageRow[]);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRows();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    if (!rows) return { cost: 0, calls: 0, tokens: 0 };
    let cost = 0;
    let tokens = 0;
    for (const r of rows) {
      cost += r.cost_usd ?? 0;
      tokens += (r.tokens_in ?? 0) + (r.tokens_out ?? 0);
    }
    return { cost, calls: rows.length, tokens };
  }, [rows]);

  const dailySeries = useMemo(() => (rows ? buildDailySeries(rows) : []), [rows]);
  const bySurface = useMemo(() => (rows ? buildBreakdown(rows, 'surface') : []), [rows]);
  const byRole = useMemo(() => (rows ? buildBreakdown(rows, 'role') : []), [rows]);

  const maxDailyCost = Math.max(0.0001, ...dailySeries.map((d) => d.cost));

  return (
    <section className="bg-card rounded-2xl p-5 border border-border space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-primary-soft flex items-center justify-center">
            <BarChart3 size={14} className="text-primary" />
          </div>
          <h4 className="text-sm font-bold uppercase tracking-wide text-primary">
            Custos de IA (últimos 7 dias)
          </h4>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          Carregando...
        </div>
      )}

      {!loading && (rows?.length ?? 0) === 0 && !error && (
        <p className="text-xs text-muted-foreground">
          Ainda não há chamadas de IA registradas nos últimos 7 dias. Conforme
          você pratica, este painel começa a mostrar o custo estimado por área
          do app e por papel do tutor.
        </p>
      )}

      {error && (
        <p className="text-xs text-muted-foreground">
          Painel de custos indisponível (migração `llm_usage` pendente).
        </p>
      )}

      {!loading && rows && rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Kpi label="Gasto estimado" value={formatUsd(totals.cost)} />
            <Kpi label="Chamadas" value={totals.calls.toLocaleString('pt-BR')} />
            <Kpi
              label="Tokens"
              value={
                totals.tokens >= 1_000_000
                  ? `${(totals.tokens / 1_000_000).toFixed(1)}M`
                  : totals.tokens >= 1_000
                    ? `${(totals.tokens / 1_000).toFixed(1)}k`
                    : totals.tokens.toLocaleString('pt-BR')
              }
            />
          </div>

          <div>
            <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              Custo por dia
            </h5>
            <div className="flex items-end gap-1 h-16">
              {dailySeries.map((d) => {
                const heightPct = Math.max(2, (d.cost / maxDailyCost) * 100);
                return (
                  <div
                    key={d.day}
                    title={`${d.day}: ${formatUsd(d.cost)} (${d.calls} chamadas)`}
                    className="flex-1 rounded-t bg-primary-soft relative"
                    style={{ height: `${heightPct}%` }}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-t bg-primary"
                      style={{ height: `${heightPct}%`, opacity: 0.3 + heightPct / 200 }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{dailySeries[0]?.day.slice(5)}</span>
              <span>{dailySeries[dailySeries.length - 1]?.day.slice(5)}</span>
            </div>
          </div>

          <Breakdown title="Por área do app (surface)" rows={bySurface} total={totals.cost} />
          <Breakdown title="Por papel (role)" rows={byRole} total={totals.cost} />
        </>
      )}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Breakdown[];
  total: number;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{title}</h5>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const pct = total > 0 ? (r.cost / total) * 100 : 0;
          return (
            <div key={r.key} className="flex items-center gap-2 text-xs">
              <span className="w-32 truncate text-foreground">{r.key}</span>
              <div className="flex-1 h-2 rounded bg-border overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.max(2, pct)}%`, opacity: 0.4 + pct / 200 }}
                />
              </div>
              <span className="w-16 text-right text-foreground tabular-nums">
                {formatUsd(r.cost)}
              </span>
              <span className="w-12 text-right text-muted-foreground tabular-nums">
                {r.calls}×
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
