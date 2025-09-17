// scripts/test-synthesize.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { synthesizeTheme } from "@/lib/synthesize";

async function main() {
  const themeId = process.env.TEST_THEME_ID;
  if (!themeId) {
    throw new Error("Provide TEST_THEME_ID in env");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 1. Fetch theme from DB
  const { data: theme, error } = await supabase
    .from("themes")
    .select("id, name, summary")
    .eq("id", themeId)
    .single();

  if (error) throw error;
  if (!theme) throw new Error(`Theme ${themeId} not found`);

  // 2. Build ThemeInput (examples are placeholders for now)
  const themeInput = {
    theme_id: theme.id,
    theme: theme.name,
    summary: theme.summary ?? "",
    examples: [
      {
        snippet:
          "Pricing tiers are confusing and the free plan limits essential blocks.",
        evidence: { type: "review", id: "r1" },
      },
      {
        snippet:
          "Team onboarding hits a paywall unexpectedly when inviting collaborators.",
        evidence: { type: "review", id: "r2" },
      },
    ],
  };

  // 3. Run synthesis
  const result = await synthesizeTheme(themeInput);

  console.log("Synthesis result:", result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});