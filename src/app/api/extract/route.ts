// app/api/extract/route.ts
import { NextRequest, NextResponse } from "next/server";
import { extractFromReview } from "@/lib/extract";

export const runtime = "nodejs"; // ensure server runtime

export async function POST(req: NextRequest) {
  const { body, meta } = await req.json();
  const result = await extractFromReview({ body, meta });
  return NextResponse.json(result);
}