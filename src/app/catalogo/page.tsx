import Image from "next/image";
import { attachProductImages, productSelectFields } from "@/lib/products";
import { supabaseServer } from "@/lib/supabase/server";

type Product = {
  id: number;
  name: string;
  slug: string;
  category: string;
  price: number;
  condition: "novo" | "usado";
  description: string | null;
  video_url: string | null;
  cover_image: string | null;
  storage?: string | null;
  color?: string | null;
  screen_size?: string | null;
  camera?: string | null;
  stock_status?: string | null;
  featured?: boolean;
  is_active: boolean;
  created_at: string;
  product_images?: {
    id: number;
    product_id: number;
    image_url: string;
    sort_order: number;
    is_primary: boolean;
    created_at: string;
  }[];
};

async function getProducts() {
  const { data, error } = await supabaseServer
    .from("products")
    .select(productSelectFields)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (await attachProductImages(
    (data ?? []) as Array<{
      id: number;
      [key: string]: unknown;
    }>,
  )) as Product[];
}

export default async function CatalogoPage() {
  const products = await getProducts();

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-[28px] border border-border bg-card p-6 sm:p-8">
          <div className="mb-5 inline-flex rounded-full border border-brand/30 bg-brand-dark px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand">
            Catalogo Publico
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Produtos ativos prontos para consumo no Framer.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-card-foreground sm:text-base">
            Esta pagina usa a mesma base de dados da API publica. Ela serve como
            teste visual rapido antes da integracao final com o seu site.
          </p>
        </section>

        {products.length === 0 ? (
          <section className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-card-foreground">
            Nenhum produto ativo encontrado.
          </section>
        ) : (
          <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <article
                key={product.id}
                className="overflow-hidden rounded-[24px] border border-border bg-card"
              >
                <div className="relative h-72 bg-black/20">
                  {product.cover_image ? (
                    <Image
                      src={product.cover_image}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-card-foreground">
                      Sem imagem
                    </div>
                  )}
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap gap-2 text-xs text-card-foreground">
                    <span className="rounded-full border border-border px-2 py-1">
                      {product.category}
                    </span>
                    <span className="rounded-full border border-border px-2 py-1">
                      {product.condition}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      {product.name}
                    </h2>
                    <p className="mt-2 text-sm text-card-foreground">
                      slug: {product.slug}
                    </p>
                    {[product.storage, product.color, product.screen_size]
                      .filter(Boolean)
                      .length > 0 && (
                      <p className="mt-2 text-sm text-card-foreground">
                        {[product.storage, product.color, product.screen_size]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    )}
                  </div>

                  <p className="text-2xl font-semibold text-brand">
                    R$ {Number(product.price).toFixed(2)}
                  </p>

                  {product.description ? (
                    <p className="text-sm leading-6 text-card-foreground">
                      {product.description}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
