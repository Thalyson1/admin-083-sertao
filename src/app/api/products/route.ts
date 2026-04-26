import { NextRequest, NextResponse } from "next/server";
import { attachProductImages, productSelectFields } from "@/lib/products";
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
  const featured = searchParams.get("featured");
  const search = searchParams.get("search");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Number(limitParam || "50"), 100);

  let query = supabaseServer
    .from("products")
    .select(productSelectFields)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(Number.isNaN(limit) ? 50 : limit);

  if (category) {
    query = query.ilike("category", category);
  }

  if (featured === "true") {
    query = query.eq("featured", true);
  }

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,description.ilike.%${search}%,slug.ilike.%${search}%`,
    );
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

  const productsWithImages = await attachProductImages(
    (data ?? []) as Array<{
      id: number;
      [key: string]: unknown;
    }>,
  );

  return NextResponse.json(
    {
      products: productsWithImages,
      total: productsWithImages.length,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
