// scripts/test-route.ts
import assert from "node:assert";

async function main() {
  const url = "http://localhost:3000/api/extract";

  const payload = {
    body: "Pricing tiers are confusing and the free plan limits essential blocks.",
    meta: { source: "trustpilot", rating: 3 },
  };

  console.log("POST →", url);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert(res.ok, `Request failed: ${res.status} ${res.statusText}`);
  const json = await res.json();

  console.log("Response JSON:", JSON.stringify(json, null, 2));

  // sanity check
  assert("aspects" in json, "Missing aspects key");
  console.log("\n✅ Route works and returned aspects");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});