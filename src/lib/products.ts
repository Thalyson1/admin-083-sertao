import { supabaseServer } from "@/lib/supabase/server";

export const productSelectFields = "*";

type ProductWithId = {
  id: number;
  [key: string]: unknown;
};

type ProductImageRow = {
  id: number;
  product_id: number;
  image_url: string;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};

export async function attachProductImages<T extends ProductWithId>(
  products: T[],
) {
  if (products.length === 0) {
    return products.map((product) => ({
      ...product,
      product_images: [],
    }));
  }

  const productIds = products.map((product) => product.id);

  const { data, error } = await supabaseServer
    .from("product_images")
    .select("id, product_id, image_url, sort_order, is_primary, created_at")
    .in("product_id", productIds)
    .order("sort_order", { ascending: true });

  if (error) {
    return products.map((product) => ({
      ...product,
      product_images: [],
    }));
  }

  const imageMap = new Map<number, ProductImageRow[]>();

  for (const image of (data ?? []) as ProductImageRow[]) {
    const current = imageMap.get(image.product_id) ?? [];
    current.push(image);
    imageMap.set(image.product_id, current);
  }

  return products.map((product) => ({
    ...product,
    product_images: imageMap.get(product.id) ?? [],
  }));
}
