import type { SupabaseClient } from '@supabase/supabase-js';
import { COMPUTE_VERSION } from '../versions';


export async function computeThemeMetricsForManifest(sb: SupabaseClient, manifestId: string): Promise<number> {
// Load themes for manifest in canonical order
const { data: themes, error: themesErr } = await sb
.from('themes')
.select('id, manifest_id, topic_key, cluster_id, name, severity, evidence_count')
.eq('manifest_id', manifestId)
.order('topic_key', { ascending: true });
if (themesErr) throw themesErr;


if (!themes || themes.length === 0) return 0;


// Fetch actions counts per theme (excluding description '__cache__')
const themeIds = themes.map(t => t.id);
const { data: acts, error: actsErr } = await sb
.from('actions')
.select('theme_id, description')
.in('theme_id', themeIds);
if (actsErr) throw actsErr;
const actionsByTheme = new Map<string, number>();
(acts ?? []).forEach(a => {
if (a.description !== '__cache__') {
actionsByTheme.set(a.theme_id, (actionsByTheme.get(a.theme_id) ?? 0) + 1);
}
});


// Option 2 (minimal): review_count = evidence_count
// If you have a review membership table, compute a real count and replace this.


let upserted = 0;
for (const t of themes) {
const actions_count = actionsByTheme.get(t.id) ?? 0;
const review_count = t.evidence_count ?? 0;


const { error: upErr } = await sb
.from('theme_metrics')
.upsert({
manifest_id: manifestId,
topic_key: t.topic_key,
cluster_id: t.cluster_id,
name: t.name,
severity: t.severity,
evidence_count: t.evidence_count ?? 0,
review_count,
actions_count,
computed_version: COMPUTE_VERSION,
computed_at: new Date().toISOString(),
}, { onConflict: 'manifest_id,topic_key' });
if (upErr) throw upErr;
upserted += 1;
}


return upserted;
}