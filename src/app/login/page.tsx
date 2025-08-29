import { Suspense } from "react";
import LoginContent from "./LoginContent";

export const dynamic = "force-dynamic"; // avoid prerender/export issues for auth pages

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <LoginContent />
    </Suspense>
  );
}