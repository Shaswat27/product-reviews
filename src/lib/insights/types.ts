export type Severity = 'low' | 'medium' | 'high';

export type GetManifestsRes = Array<{
id: string;
business_unit_id: string;
quarter: string;
start_date: string; // ISO
end_date: string; // ISO
pipeline_version: string;
created_at: string; // ISO
}>;

export type MetricRow = {
topic_key: string;
cluster_id: string;
name: string;
severity: Severity;
evidence_count: number;
review_count: number;
actions_count: number;
};

export type GetMetricsRes = MetricRow[];

export type TrendSide = {
name: string;
severity: Severity;
evidence_count: number;
review_count: number;
actions_count: number;
};

export type TrendDelta = {
reviews: number;
evidence: number;
actions: number;
severity_change: number; // current - prev (1,2,3)
};

export type TrendRow = {
topic_key: string;
current: TrendSide;
prev?: TrendSide;
deltas?: TrendDelta;
};

export type GetTrendsRes = TrendRow[];