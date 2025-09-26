// src/lib/insights/computeTrends.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { COMPUTE_VERSION } from '../versions';
import type { Severity } from './types';

interface ManifestRow { id: string; business_unit_id: string; quarter: string }
interface MetricRowSel {
  topic_key: string;
  name: string;
  severity: Severity;
  evidence_count: number | null;
  review_count: number | null;
  actions_count: number | null;
}

const sevToInt = (s: Severity): number => (s === 'low' ? 1 : s === 'medium' ? 2 : 3);

function resolvePrevQuarter(q: string): string {
  const m = q.match(/^(\d{4})Q([1-4])$/);
  if (!m) throw new Error(`Invalid quarter: ${q}`);
  let year = Number(m[1]);
  let part = Number(m[2]);
  if (part === 1) { year -= 1; part = 4; } else { part -= 1; }
  return `${year}Q${part}`;
}

export async function computeTrendsQoQ(
  sb: SupabaseClient,
  currentManifestId: string
): Promise<number> {
  // 1) Current manifest (strict typed)
  const { data: man, error: manErr } = await sb
    .from('manifests')
    .select('id, business_unit_id, quarter')
    .eq('id', currentManifestId)
    .single<ManifestRow>();
  if (manErr) throw manErr;

  const prevQuarter = resolvePrevQuarter(man.quarter);

  // 2) previous manifest (nullable, pick latest by created_at)
  const { data: prevRows, error: prevErr } = await sb
    .from('manifests')
    .select('id, created_at')
    .eq('business_unit_id', man.business_unit_id)
    .eq('quarter', prevQuarter)
    .order('created_at', { ascending: false })
    .limit(1);
  if (prevErr) throw prevErr;

const prevManifestId: string | null = (prevRows && prevRows.length > 0)
  ? prevRows[0].id
  : null;
  // 3) Current metrics (deterministic order)
  const { data: curMet, error: curErr } = await sb
    .from('theme_metrics')
    .select('topic_key, name, severity, evidence_count, review_count, actions_count')
    .eq('manifest_id', man.id)
    .order('topic_key', { ascending: true })
    .returns<MetricRowSel[]>();
  if (curErr) throw curErr;

  // 3b) Previous metrics map by topic_key
  const prevMap: ReadonlyMap<string, MetricRowSel> = await (async () => {
    if (!prevManifestId) return new Map<string, MetricRowSel>();
    const { data: prevMet, error: pErr } = await sb
      .from('theme_metrics')
      .select('topic_key, name, severity, evidence_count, review_count, actions_count')
      .eq('manifest_id', prevManifestId)
      .returns<MetricRowSel[]>();
    if (pErr) throw pErr;
    const m = new Map<string, MetricRowSel>();
    for (const r of prevMet ?? []) m.set(r.topic_key, r);
    return m;
  })();

  // 4/5/6) Compute + upsert
  let upserted = 0;
  const nowISO = new Date().toISOString();

  for (const c of curMet ?? []) {
    const p = prevMap.get(c.topic_key);

    const payload = {
      current_manifest_id: man.id,
      prev_manifest_id: prevManifestId,
      business_unit_id: man.business_unit_id,
      topic_key: c.topic_key,

      current_name: c.name,
      current_severity: c.severity,
      current_evidence_count: (c.evidence_count ?? 0),
      current_review_count: (c.review_count ?? 0),
      current_actions_count: (c.actions_count ?? 0),

      // prev snapshot (nullable when missing)
      prev_name: p?.name ?? null,
      prev_severity: p?.severity ?? null,
      prev_evidence_count: (p?.evidence_count ?? null),
      prev_review_count: (p?.review_count ?? null),
      prev_actions_count: (p?.actions_count ?? null),

      // deltas (nullable when missing)
      delta_reviews: p ? ((c.review_count ?? 0) - (p.review_count ?? 0)) : null,
      delta_evidence: p ? ((c.evidence_count ?? 0) - (p.evidence_count ?? 0)) : null,
      delta_actions: p ? ((c.actions_count ?? 0) - (p.actions_count ?? 0)) : null,
      severity_change: p ? (sevToInt(c.severity) - sevToInt(p.severity)) : null,

      computed_version: COMPUTE_VERSION,
      computed_at: nowISO,
    } as const;

    const { error: upErr } = await sb
      .from('theme_trends_qoq')
      .upsert(payload, { onConflict: 'current_manifest_id,topic_key' });
    if (upErr) throw upErr;
    upserted += 1;
  }

  return upserted;
}