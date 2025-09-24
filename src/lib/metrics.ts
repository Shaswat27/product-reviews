// src/lib/metrics.ts (super minimal)
export const metrics = {
  inc(name: string) { console.log("metric", name); },
};

// wrap sites:
metrics.inc("llm.calls.theme");   // right before Anthropic create
metrics.inc("llm.calls.actions"); // right before OpenAI create