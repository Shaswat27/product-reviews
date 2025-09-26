import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetricRow, GetManifestsRes, GetTrendsRes, TrendRow, TrendSide } from './types';


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
.eq('current_manifest_id', manifestId)
.order('topic_key', { ascending: true });
if (error) throw error;
const rows: GetTrendsRes = (data ?? []).map((r: any): TrendRow => {
const current: TrendSide = {
name: r.current_name,
severity: r.current_severity,
evidence_count: r.current_evidence_count,
review_count: r.current_review_count,
actions_count: r.current_actions_count,
};
const prev = r.prev_name ? {
name: r.prev_name,
severity: r.prev_severity,
evidence_count: r.prev_evidence_count,
review_count: r.prev_review_count,
actions_count: r.prev_actions_count,
} satisfies TrendSide : undefined;


const deltas = r.delta_reviews === null ? undefined : {
reviews: r.delta_reviews,
evidence: r.delta_evidence,
actions: r.delta_actions,
severity_change: r.severity_change,
};


return { topic_key: r.topic_key, current, prev, deltas };
});
return rows;
}