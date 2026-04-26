"use client";

import Image from "next/image";
import { FormEvent, useEffect, useEffectEvent, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { productSelectFields } from "@/lib/products";
import { slugify } from "@/lib/utils";

type ProductImage = {
  id?: number;
  image_url: string;
  sort_order: number;
  is_primary: boolean;
  created_at?: string;
};

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
  product_images?: ProductImage[];
};

type ProductFormData = {
  name: string;
  category: string;
  price: string;
  condition: "novo" | "usado";
  description: string;
  video_url: string;
  cover_image: string;
  storage: string;
  color: string;
  screen_size: string;
  camera: string;
  stock_status: string;
  featured: boolean;
  is_active: boolean;
};

const initialFormData: ProductFormData = {
  name: "",
  category: "",
  price: "",
  condition: "novo",
  description: "",
  video_url: "",
  cover_image: "",
  storage: "",
  color: "",
  screen_size: "",
  camera: "",
  stock_status: "disponivel",
  featured: false,
  is_active: true,
};

export default function Home() {
  const storageBucket = "product-images";
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [products, setProducts] = useState<Product[]>([]);
  const [galleryImages, setGalleryImages] = useState<ProductImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(
    null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  async function attachGalleryToProducts(baseProducts: Product[]) {
    if (baseProducts.length === 0) {
      return [];
    }

    const productIds = baseProducts.map((product) => product.id);

    const { data, error } = await supabase
      .from("product_images")
      .select("id, product_id, image_url, sort_order, is_primary, created_at")
      .in("product_id", productIds)
      .order("sort_order", { ascending: true });

    if (error) {
      return baseProducts.map((product) => ({
        ...product,
        product_images: [],
      }));
    }

    const imageMap = new Map<number, ProductImage[]>();

    for (const image of (data ?? []) as Array<
      ProductImage & { product_id: number }
    >) {
      const current = imageMap.get(image.product_id) ?? [];
      current.push(image);
      imageMap.set(image.product_id, current);
    }

    return baseProducts.map((product) => ({
      ...product,
      product_images: imageMap.get(product.id) ?? [],
    }));
  }

  async function loadProducts() {
    setErrorMessage(null);
    setIsLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select(productSelectFields)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setProducts([]);
      setIsLoading(false);
      return;
    }

    const productsWithGallery = await attachGalleryToProducts(
      (data ?? []) as Product[],
    );

    setProducts(productsWithGallery);
    setIsLoading(false);
  }

  const loadProductsEvent = useEffectEvent(async () => {
    await loadProducts();
  });

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(currentSession);
      setIsLoading(false);

      if (currentSession) {
        void loadProductsEvent();
      }
    }

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession) {
        void loadProductsEvent();
        return;
      }

      setProducts([]);
      setEditingProductId(null);
      setFormData(initialFormData);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function updateField<K extends keyof ProductFormData>(
    field: K,
    value: ProductFormData[K],
  ) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startEditing(product: Product) {
    setFeedback(null);
    setErrorMessage(null);
    setEditingProductId(product.id);
    setFormData({
      name: product.name,
      category: product.category,
      price: String(product.price),
      condition: product.condition,
      description: product.description ?? "",
      video_url: product.video_url ?? "",
      cover_image: product.cover_image ?? "",
      storage: product.storage ?? "",
      color: product.color ?? "",
      screen_size: product.screen_size ?? "",
      camera: product.camera ?? "",
      stock_status: product.stock_status ?? "disponivel",
      featured: Boolean(product.featured),
      is_active: product.is_active,
    });
    setGalleryImages(
      [...(product.product_images ?? [])].sort(
        (left, right) => left.sort_order - right.sort_order,
      ),
    );
  }

  function resetForm() {
    setEditingProductId(null);
    setFormData(initialFormData);
    setGalleryImages([]);
  }

  function removeGalleryImage(indexToRemove: number) {
    setGalleryImages((current) =>
      current
        .filter((_, index) => index !== indexToRemove)
        .map((image, index) => ({
          ...image,
          sort_order: index,
        })),
    );
  }

  async function saveGalleryImages(productId: number) {
    const galleryPayload = galleryImages.map((image, index) => ({
      product_id: productId,
      image_url: image.image_url,
      sort_order: index,
      is_primary: index === 0,
    }));

    const { error: deleteError } = await supabase
      .from("product_images")
      .delete()
      .eq("product_id", productId);

    if (deleteError) {
      throw deleteError;
    }

    if (galleryPayload.length === 0) {
      return;
    }

    const { error: insertError } = await supabase
      .from("product_images")
      .insert(galleryPayload);

    if (insertError) {
      throw insertError;
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setErrorMessage(null);
    setIsAuthenticating(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsAuthenticating(false);
      return;
    }

    setAuthPassword("");
    setFeedback("Login realizado com sucesso.");
    setIsAuthenticating(false);
  }

  async function handleLogout() {
    setFeedback(null);
    setErrorMessage(null);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setFeedback("Sessao encerrada com sucesso.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setErrorMessage(null);

    if (!formData.name.trim() || !formData.category.trim() || !formData.price) {
      setErrorMessage("Preencha nome, categoria e preco antes de salvar.");
      return;
    }

    const generatedSlug = slugify(formData.name);

    if (!generatedSlug) {
      setErrorMessage("Nao foi possivel gerar o slug do produto.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      slug: generatedSlug,
      category: formData.category.trim().toLowerCase(),
      price: Number(formData.price),
      condition: formData.condition,
      description: formData.description.trim() || null,
      video_url: formData.video_url.trim() || null,
      cover_image: formData.cover_image.trim() || null,
      storage: formData.storage.trim() || null,
      color: formData.color.trim() || null,
      screen_size: formData.screen_size.trim() || null,
      camera: formData.camera.trim() || null,
      stock_status: formData.stock_status.trim().toLowerCase() || "disponivel",
      featured: formData.featured,
      is_active: formData.is_active,
    };

    const { data, error } =
      editingProductId === null
        ? await supabase.from("products").insert(payload).select("id").single()
        : await supabase
            .from("products")
            .update(payload)
            .select("id")
            .eq("id", editingProductId);

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    const savedProductId =
      editingProductId ?? (Array.isArray(data) ? data[0]?.id : data?.id);

    if (!savedProductId) {
      setErrorMessage("Nao foi possivel identificar o produto salvo.");
      setIsSubmitting(false);
      return;
    }

    try {
      await saveGalleryImages(savedProductId);
    } catch (galleryError) {
      const message =
        galleryError instanceof Error
          ? galleryError.message
          : "Erro ao salvar a galeria do produto.";
      setErrorMessage(message);
      setIsSubmitting(false);
      return;
    }

    resetForm();
    setFeedback(
      editingProductId === null
        ? "Produto cadastrado com sucesso."
        : "Produto atualizado com sucesso.",
    );
    setIsSubmitting(false);
    await loadProducts();
  }

  async function handleImageUpload(file: File) {
    setFeedback(null);
    setErrorMessage(null);
    setIsUploadingImage(true);

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(storageBucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setErrorMessage(uploadError.message);
      setIsUploadingImage(false);
      return;
    }

    const { data } = supabase.storage
      .from(storageBucket)
      .getPublicUrl(filePath);

    updateField("cover_image", data.publicUrl);
    setFeedback("Imagem enviada com sucesso.");
    setIsUploadingImage(false);
  }

  async function handleGalleryUpload(files: FileList) {
    setFeedback(null);
    setErrorMessage(null);
    setIsUploadingGallery(true);

    try {
      const uploadedImages: ProductImage[] = [];

      for (const file of Array.from(files)) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const filePath = `products/gallery/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(storageBucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage
          .from(storageBucket)
          .getPublicUrl(filePath);

        uploadedImages.push({
          image_url: data.publicUrl,
          sort_order: 0,
          is_primary: false,
        });
      }

      setGalleryImages((current) => {
        const next = [...current, ...uploadedImages];
        return next.map((image, index) => ({
          ...image,
          sort_order: index,
          is_primary: index === 0,
        }));
      });
      setFeedback("Imagens adicionais enviadas com sucesso.");
    } catch (galleryError) {
      const message =
        galleryError instanceof Error
          ? galleryError.message
          : "Erro ao enviar as imagens adicionais.";
      setErrorMessage(message);
    } finally {
      setIsUploadingGallery(false);
    }
  }

  async function handleDelete(productId: number) {
    setFeedback(null);
    setErrorMessage(null);
    setDeletingProductId(productId);

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      setErrorMessage(error.message);
      setDeletingProductId(null);
      return;
    }

    setProducts((current) =>
      current.filter((product) => product.id !== productId),
    );
    if (editingProductId === productId) {
      resetForm();
    }
    setFeedback("Produto excluido com sucesso.");
    setDeletingProductId(null);
  }

  const filteredProducts = products.filter((product) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return true;
    }

    return [
      product.name,
      product.slug,
      product.category,
      product.description ?? "",
      product.color ?? "",
      product.storage ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-8 text-foreground sm:px-8">
        <div className="w-full max-w-md rounded-[28px] border border-border bg-card p-6 sm:p-8">
          <div className="mb-6 inline-flex rounded-full border border-brand/30 bg-brand-dark px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand">
            083 Sertao Admin
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Entrar no painel
          </h1>
          <p className="mt-3 text-sm leading-7 text-card-foreground">
            Use o usuario administrador criado no Supabase Auth para acessar o
            CRUD de produtos.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white">E-mail</span>
              <input
                className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="admin@083sertao.com"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-white">Senha</span>
              <input
                className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Sua senha"
              />
            </label>

            {feedback ? (
              <div className="rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-white">
                {feedback}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            <button
              className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isAuthenticating}
            >
              {isAuthenticating ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-[28px] border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-brand/30 bg-brand-dark px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand">
                083 Sertao Admin
              </div>

              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                CRUD de produtos conectado ao Supabase com login do admin.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-card-foreground sm:text-base">
                Voce entrou como {session.user.email}. A partir daqui, o painel
                fica pronto para operar com seguranca basica de autenticacao.
              </p>
            </div>

            <button
              className="rounded-full border border-border px-4 py-2 text-sm text-card-foreground transition hover:border-white hover:text-white"
              type="button"
              onClick={() => void handleLogout()}
            >
              Sair
            </button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[24px] border border-border bg-card p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold text-white">
                {editingProductId === null ? "Novo produto" : "Editar produto"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-card-foreground">
                {editingProductId === null
                  ? "Preencha os dados principais do produto para salvar no banco."
                  : "Voce esta editando um produto existente. Altere os campos e salve novamente."}
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-white">Nome</span>
                <input
                  className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                  value={formData.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="iPhone 15 Pro Max 256GB"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-white">
                  Categoria
                </span>
                <input
                  className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                  value={formData.category}
                  onChange={(event) =>
                    updateField("category", event.target.value)
                  }
                  placeholder="iphone"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-white">
                    Armazenamento
                  </span>
                  <input
                    className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                    value={formData.storage}
                    onChange={(event) =>
                      updateField("storage", event.target.value)
                    }
                    placeholder="128 GB"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-white">Cor</span>
                  <input
                    className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                    value={formData.color}
                    onChange={(event) =>
                      updateField("color", event.target.value)
                    }
                    placeholder="Preto"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-white">Preco</span>
                  <input
                    className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(event) =>
                      updateField("price", event.target.value)
                    }
                    placeholder="5999.90"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-white">
                    Condicao
                  </span>
                  <select
                    className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                    value={formData.condition}
                    onChange={(event) =>
                      updateField(
                        "condition",
                        event.target.value as ProductFormData["condition"],
                      )
                    }
                  >
                    <option value="novo">Novo</option>
                    <option value="usado">Usado</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-white">
                  Descricao
                </span>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                  value={formData.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  placeholder="Aparelho em excelente estado, bateria em dia e garantia."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-white">
                    Tamanho da tela
                  </span>
                  <input
                    className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                    value={formData.screen_size}
                    onChange={(event) =>
                      updateField("screen_size", event.target.value)
                    }
                    placeholder='6,1"'
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-white">
                    Camera
                  </span>
                  <input
                    className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                    value={formData.camera}
                    onChange={(event) =>
                      updateField("camera", event.target.value)
                    }
                    placeholder="48 MP"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-white">
                  URL da imagem de capa
                </span>
                <input
                  className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                  value={formData.cover_image}
                  onChange={(event) =>
                    updateField("cover_image", event.target.value)
                  }
                  placeholder="https://..."
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-white">
                  Upload da imagem
                </span>
                <input
                  className="w-full rounded-2xl border border-dashed border-border bg-black/30 px-4 py-3 text-sm text-card-foreground outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:border-brand"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (!file) {
                      return;
                    }

                    void handleImageUpload(file);
                    event.target.value = "";
                  }}
                />
                <p className="text-xs leading-5 text-card-foreground">
                  Envie a foto do produto para preencher automaticamente a capa.
                </p>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-white">
                  Galeria adicional
                </span>
                <input
                  className="w-full rounded-2xl border border-dashed border-border bg-black/30 px-4 py-3 text-sm text-card-foreground outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:border-brand"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const files = event.target.files;

                    if (!files || files.length === 0) {
                      return;
                    }

                    void handleGalleryUpload(files);
                    event.target.value = "";
                  }}
                />
                <p className="text-xs leading-5 text-card-foreground">
                  Adicione mais fotos reais do produto para usar em carrossel ou
                  galeria.
                </p>
              </label>

              {galleryImages.length > 0 ? (
                <div className="space-y-3 rounded-2xl border border-border bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-white">
                      Imagens da galeria
                    </span>
                    <span className="text-xs text-card-foreground">
                      A primeira imagem da lista vira a principal da galeria.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {galleryImages.map((image, index) => (
                      <div
                        key={`${image.image_url}-${index}`}
                        className="overflow-hidden rounded-2xl border border-border bg-black/30"
                      >
                        <Image
                          src={image.image_url}
                          alt={`Imagem ${index + 1} da galeria`}
                          width={240}
                          height={240}
                          className="h-28 w-full object-cover"
                        />
                        <div className="space-y-2 p-3">
                          <div className="text-xs text-card-foreground">
                            Ordem {index + 1}
                            {index === 0 ? " • principal" : ""}
                          </div>
                          <button
                            type="button"
                            className="w-full rounded-full border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/10"
                            onClick={() => removeGalleryImage(index)}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-medium text-white">
                  URL do video
                </span>
                <input
                  className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                  value={formData.video_url}
                  onChange={(event) =>
                    updateField("video_url", event.target.value)
                  }
                  placeholder="https://..."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-white">
                    Status de estoque
                  </span>
                  <select
                    className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                    value={formData.stock_status}
                    onChange={(event) =>
                      updateField("stock_status", event.target.value)
                    }
                  >
                    <option value="disponivel">Disponivel</option>
                    <option value="sob-consulta">Sob consulta</option>
                    <option value="esgotado">Esgotado</option>
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-card-foreground sm:mt-7">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(event) =>
                      updateField("featured", event.target.checked)
                    }
                  />
                  Produto em destaque
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-card-foreground">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(event) =>
                    updateField("is_active", event.target.checked)
                  }
                />
                Produto ativo na vitrine
              </label>

              {feedback ? (
                <div className="rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-white">
                  {feedback}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              <button
                className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={
                  isSubmitting || isUploadingImage || isUploadingGallery
                }
              >
                {isSubmitting
                  ? "Salvando..."
                  : isUploadingImage
                    ? "Enviando imagem..."
                  : isUploadingGallery
                    ? "Enviando galeria..."
                  : editingProductId === null
                    ? "Salvar produto"
                    : "Atualizar produto"}
              </button>

              {editingProductId !== null ? (
                <button
                  className="w-full rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-card-foreground transition hover:border-white hover:text-white"
                  type="button"
                  onClick={resetForm}
                >
                  Cancelar edicao
                </button>
              ) : null}
            </form>
          </div>

          <div className="rounded-[24px] border border-border bg-card p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Produtos cadastrados
                </h2>
                <p className="mt-2 text-sm leading-6 text-card-foreground">
                  Esta lista esta vindo diretamente da tabela products.
                </p>
              </div>

              <button
                className="rounded-full border border-border px-4 py-2 text-sm text-card-foreground transition hover:border-brand hover:text-white"
                type="button"
                onClick={() => void loadProducts()}
              >
                Atualizar
              </button>
            </div>

            <label className="mb-5 block space-y-2">
              <span className="text-sm font-medium text-white">
                Buscar no painel
              </span>
              <input
                className="w-full rounded-2xl border border-border bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-brand"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nome, slug, categoria, cor..."
              />
            </label>

            {isLoading ? (
              <div className="rounded-2xl border border-border bg-black/20 px-4 py-6 text-sm text-card-foreground">
                Carregando produtos...
              </div>
            ) : null}

            {!isLoading && filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-black/20 px-4 py-6 text-sm text-card-foreground">
                Nenhum produto encontrado com esse filtro.
              </div>
            ) : null}

            {!isLoading && filteredProducts.length > 0 ? (
              <div className="space-y-3">
                {filteredProducts.map((product) => (
                  <article
                    key={product.id}
                    className="rounded-[22px] border border-border bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-white">
                          {product.name}
                        </h3>
                        <div className="flex flex-wrap gap-2 text-xs text-card-foreground">
                          <span className="rounded-full border border-border px-2 py-1">
                            {product.category}
                          </span>
                          <span className="rounded-full border border-border px-2 py-1">
                            {product.condition}
                          </span>
                          {product.featured ? (
                            <span className="rounded-full border border-brand/40 bg-brand/10 px-2 py-1 text-brand">
                              destaque
                            </span>
                          ) : null}
                          <span className="rounded-full border border-border px-2 py-1">
                            slug: {product.slug}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          product.is_active
                            ? "bg-brand/15 text-brand"
                            : "bg-zinc-700/40 text-zinc-300"
                        }`}
                      >
                        {product.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-card-foreground sm:grid-cols-2">
                      <div className="rounded-2xl border border-border px-3 py-2">
                        Preco: R$ {Number(product.price).toFixed(2)}
                      </div>
                      <div className="rounded-2xl border border-border px-3 py-2">
                        Criado em:{" "}
                        {new Date(product.created_at).toLocaleDateString(
                          "pt-BR",
                        )}
                      </div>
                    </div>

                    {(product.storage ||
                      product.color ||
                      product.screen_size ||
                      product.camera ||
                      product.stock_status) && (
                      <div className="mt-3 grid gap-3 text-sm text-card-foreground sm:grid-cols-2">
                        {product.storage ? (
                          <div className="rounded-2xl border border-border px-3 py-2">
                            Armazenamento: {product.storage}
                          </div>
                        ) : null}
                        {product.color ? (
                          <div className="rounded-2xl border border-border px-3 py-2">
                            Cor: {product.color}
                          </div>
                        ) : null}
                        {product.screen_size ? (
                          <div className="rounded-2xl border border-border px-3 py-2">
                            Tela: {product.screen_size}
                          </div>
                        ) : null}
                        {product.camera ? (
                          <div className="rounded-2xl border border-border px-3 py-2">
                            Camera: {product.camera}
                          </div>
                        ) : null}
                        {product.stock_status ? (
                          <div className="rounded-2xl border border-border px-3 py-2">
                            Estoque: {product.stock_status}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {product.description ? (
                      <p className="mt-4 text-sm leading-6 text-card-foreground">
                        {product.description}
                      </p>
                    ) : null}

                    {product.cover_image ? (
                      <div className="mt-4 overflow-hidden rounded-[20px] border border-border">
                        <Image
                          src={product.cover_image}
                          alt={product.name}
                          width={640}
                          height={320}
                          className="h-44 w-full object-cover"
                        />
                      </div>
                    ) : null}

                    {product.product_images && product.product_images.length > 0 ? (
                      <div className="mt-3">
                        <div className="mb-2 text-xs text-card-foreground">
                          Galeria adicional: {product.product_images.length} imagem(ns)
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {product.product_images
                            .slice()
                            .sort((left, right) => left.sort_order - right.sort_order)
                            .slice(0, 3)
                            .map((image) => (
                              <div
                                key={image.id ?? image.image_url}
                                className="overflow-hidden rounded-2xl border border-border"
                              >
                                <Image
                                  src={image.image_url}
                                  alt={`Imagem de ${product.name}`}
                                  width={180}
                                  height={180}
                                  className="h-20 w-full object-cover"
                                />
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                      <div className="text-xs text-card-foreground">
                        ID: {product.id}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-full border border-border px-4 py-2 text-sm text-card-foreground transition hover:border-white hover:text-white"
                          type="button"
                          onClick={() => startEditing(product)}
                        >
                          Editar
                        </button>

                        <button
                          className="rounded-full border border-red-500/40 px-4 py-2 text-sm text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                          type="button"
                          onClick={() => void handleDelete(product.id)}
                          disabled={deletingProductId === product.id}
                        >
                          {deletingProductId === product.id
                            ? "Excluindo..."
                            : "Excluir"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
