import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetricRow, GetManifestsRes, GetTrendsRes, TrendRow, TrendSide } from './types';

// — Optional: declare a local type for the raw DB row in theme_trends_qoq
// Keep it minimal and aligned to the columns you read.
type ThemeTrendsQoQRow = {
  topic_key: string;

  // current
  current_name: string;
  current_severity: TrendSide['severity'];
  current_evidence_count: number;
  current_review_count: number;
  current_actions_count: number;

  // previous (nullable)
  prev_name: string | null;
  prev_severity: TrendSide['severity'] | null;
  prev_evidence_count: number | null;
  prev_review_count: number | null;
  prev_actions_count: number | null;

  // deltas (nullable group)
  delta_reviews: number | null;
  delta_evidence: number | null;
  delta_actions: number | null;
  severity_change: number | null;
};

export async function getManifests(sb: SupabaseClient): Promise<GetManifestsRes> {
  const { data, error } = await sb
    .from('manifests')
    .select('id, business_unit_id, quarter, start_date, end_date, pipeline_version, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as GetManifestsRes;
}

export async function getMetrics(sb: SupabaseClient, manifestId: string): Promise<MetricRow[]> {
  const { data, error } = await sb
    .from('theme_metrics')
    .select('topic_key, cluster_id, name, severity, evidence_count, review_count, actions_count')
    .eq('manifest_id', manifestId)
    .order('topic_key', { ascending: true })
    .order('cluster_id', { ascending: true });

  if (error) throw error;
  return (data ?? []) as MetricRow[];
}

export async function getTrends(sb: SupabaseClient, manifestId: string): Promise<GetTrendsRes> {
  const { data, error } = await sb
    .from('theme_trends_qoq')
    .select('*')
    .eq('current_manifest_id', manifestId) // assuming your view/table has this column
    .order('topic_key', { ascending: true });

  if (error) throw error;

  const rows = ((data ?? []) as ThemeTrendsQoQRow[]).map((r): TrendRow => {
    const current: TrendSide = {
      name: r.current_name,
      severity: r.current_severity,
      evidence_count: r.current_evidence_count,
      review_count: r.current_review_count,
      actions_count: r.current_actions_count,
    };

    const prev: TrendSide | undefined =
      r.prev_name
        ? {
            name: r.prev_name,
            severity: (r.prev_severity ?? 'low') as TrendSide['severity'], // or better: refine your SQL to coalesce
            evidence_count: r.prev_evidence_count ?? 0,
            review_count: r.prev_review_count ?? 0,
            actions_count: r.prev_actions_count ?? 0,
          }
        : undefined;

    const deltas =
      r.delta_reviews === null
        ? undefined
        : {
            reviews: r.delta_reviews,
            evidence: r.delta_evidence ?? 0,
            actions: r.delta_actions ?? 0,
            severity_change: r.severity_change ?? 0,
          };

    return { topic_key: r.topic_key, current, prev, deltas };
  });

  return rows as GetTrendsRes;
}