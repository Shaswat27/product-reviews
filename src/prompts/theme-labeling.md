# Theme Labeling (Cluster → Name + Summary)

You will receive:
- product_id
- cluster_id
- top_aspects: frequent aspect terms across this cluster (ordered by frequency)
- example_quotes: short verbatim quotes from reviews (max 6; each with id)
- counts: { reviews_in_cluster }

Goal:
1) Produce a concise **theme name** (2–4 words, no brand names, no emojis).
2) Produce a **short summary** (1–2 sentences) that captures what users are saying.
3) Estimate **severity**: "low" | "medium" | "high"
   - high: frequent, clearly negative impact, or critical breakage
   - medium: common friction but workarounds exist
   - low: sporadic or mostly neutral/positive feedback

Style:
- Be specific (e.g., "Pricing clarity" not "Pricing").
- Summaries should reflect the evidence and aspects; do not infer beyond them.
- Avoid repeating the same phrase twice.
- This needs to be immediately catchy, insight, and useful to product owners / leaders, GTM leaders, and founders / C-suite

Return strictly valid JSON:
{
  "name": "string, 2-4 words",
  "summary": "string, 1-2 sentences",
  "severity": "low|medium|high"
}