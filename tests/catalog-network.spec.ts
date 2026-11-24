import { test, expect, type Page } from "@playwright/test";

async function scenario(page: Page, action: "arm" | "status" | "release") {
  return page.evaluate(async (action) => {
    const response = await fetch("/api/demo/catalog-failure/" + action, {
      method: "POST",
    });
    if (!response.ok)
      throw new Error("Falha no controle do cenário: " + response.status);
    return response.json();
  }, action);
}

test("catálogo mostra skeleton, informa erro 503 e recupera pela nova tentativa", async ({
  page,
}) => {
  await page.goto("/nft/1");
  await expect(
    page.getByRole("heading", { name: "Órbita Solar" }),
  ).toBeVisible();

  await scenario(page, "arm");
  await page.getByRole("link", { name: "Explorar", exact: true }).click();

  const catalogo = page.locator("#catalogo");
  const loading = catalogo.getByRole("status", { name: "Carregando conteúdo" });
  const obra = catalogo.getByRole("heading", {
    name: "Órbita Solar",
    exact: true,
  });

  try {
    await expect
      .poll(async () => (await scenario(page, "status")).started)
      .toBe(true);
    await expect(loading).toBeVisible();
    await expect(obra).toHaveCount(0);
  } finally {
    await scenario(page, "release");
  }

  const erro = catalogo.getByRole("alert");
  await expect(erro).toContainText("Falha ao carregar.");
  await expect(loading).toHaveCount(0);

  const urlDaBusca = page.url();
  await erro.getByRole("button", { name: "Tentar novamente" }).click();

  await expect(obra).toBeVisible();
  await expect(erro).toHaveCount(0);
  await expect(loading).toHaveCount(0);
  await expect(page).toHaveURL(urlDaBusca);
});

test("busca antiga liberada depois mantém o resultado e a URL da busca atual", async ({
  page,
}) => {
  async function race(action: "arm" | "release" | "status"): Promise<string> {
    return page.evaluate(async (action) => {
      const response = await fetch("/api/demo/catalog-race/" + action, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Falha no cenário: " + response.status);
      return (await response.json()).phase;
    }, action);
  }

  await page.goto("/");
  const catalogo = page.locator("#catalogo");
  const busca = catalogo.getByRole("searchbox", { name: "Buscar obra" });
  const jade = catalogo.getByRole("heading", {
    name: "Anel de Jade",
    exact: true,
  });
  const mare = catalogo.getByRole("heading", {
    name: "Maré Lunar",
    exact: true,
  });

  await expect(
    catalogo.getByRole("heading", { name: "Órbita Solar" }),
  ).toBeVisible();
  await race("arm");

  try {
    await busca.fill("Maré");
    await expect.poll(() => race("status")).toBe("waiting");

    await busca.fill("Jade");
    await expect(jade).toBeVisible();
    await expect(catalogo.locator(".card")).toHaveCount(1);
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"))
      .toBe("Jade");
  } finally {
    await race("release");
  }

  await expect.poll(() => race("status")).toBe("finished");
  await expect(busca).toHaveValue("Jade");
  await expect(jade).toBeVisible();
  await expect(mare).toHaveCount(0);
  await expect(catalogo.locator(".card")).toHaveCount(1);
  await expect
    .poll(() => new URL(page.url()).searchParams.get("q"))
    .toBe("Jade");
});

test("skeleton do catálogo respeita movimento reduzido durante a mesma consulta", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/nft/1");
  await expect(
    page.getByRole("heading", { name: "Órbita Solar" }),
  ).toBeVisible();

  await scenario(page, "arm");
  try {
    await page.getByRole("link", { name: "Explorar", exact: true }).click();
    await expect
      .poll(async () => (await scenario(page, "status")).started)
      .toBe(true);

    const skeleton = page.locator("#catalogo").getByRole("status", {
      name: "Carregando conteúdo",
    });

    await expect(skeleton).toBeVisible();
    await expect(skeleton).not.toHaveCSS("animation-name", "none");
    await expect(skeleton).not.toHaveCSS("animation-duration", "0s");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(skeleton).toBeVisible();
    await expect(skeleton).toHaveCSS("animation-name", "none");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(skeleton).not.toHaveCSS("animation-name", "none");
  } finally {
    await scenario(page, "release");
  }
});

test("eventos de preço duplicado e antigo preservam a versão atual", async ({
  page,
}) => {
  await page.goto("/nft/1");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText(
    "Adicionado",
  );
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  const subtotal = (value: string) =>
    page.getByRole("heading", {
      name: "Subtotal · " + value + " ETH",
      exact: true,
    });
  await expect(subtotal("0.32")).toBeVisible();

  const send = (action: string) =>
    page.evaluate(async (action) => {
      const result = await fetch("/api/demo/" + action, { method: "POST" });
      if (!result.ok) throw new Error("Cenário indisponível: " + result.status);
      return result.json();
    }, action);
  await send("price");
  await expect(subtotal("0.36")).toBeVisible();
  await send("price");
  await expect(subtotal("0.32")).toBeVisible();
  expect(await send("replay-price")).toEqual({ replayed: 2 });
  await expect(subtotal("0.32")).toBeVisible();
  await expect(subtotal("0.36")).toHaveCount(0);
});
