import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  attachProductImages,
  productSelectFields,
} from "@/lib/products";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

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

export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  const { data, error } = await supabaseServer
    .from("products")
    .select(productSelectFields)
    .eq("is_active", true)
    .eq("slug", slug)
    .maybeSingle();

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

  if (!data) {
    return NextResponse.json(
      { error: "Product not found" },
      {
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  const [productWithImages] = await attachProductImages([data]);

  const { data: relatedProducts, error: relatedError } = await supabaseServer
    .from("products")
    .select(productSelectFields)
    .eq("is_active", true)
    .eq("category", data.category)
    .neq("id", data.id)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4);

  if (relatedError) {
    return NextResponse.json(
      { error: relatedError.message },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  const relatedWithImages = await attachProductImages(
    (relatedProducts ?? []) as Array<{
      id: number;
      [key: string]: unknown;
    }>,
  );

  return NextResponse.json(
    {
      product: productWithImages,
      relatedProducts: relatedWithImages,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
