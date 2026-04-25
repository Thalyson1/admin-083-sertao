import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get("category");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Number(limitParam || "50"), 100);

  let query = supabaseServer
    .from("products")
    .select(
      "id, name, slug, category, price, condition, description, video_url, cover_image, is_active, created_at",
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(Number.isNaN(limit) ? 50 : limit);

  if (category) {
    query = query.ilike("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  return NextResponse.json(
    {
      products: data ?? [],
      total: data?.length ?? 0,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
