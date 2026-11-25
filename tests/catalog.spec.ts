import { test, expect } from "@playwright/test";
test("Carrinho de visitante persiste e respeita o estoque", async ({
  page,
}) => {
  await page.goto("/nft/1");
  await page.getByLabel("Quantidade").fill("2");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toHaveText(
    "Adicionado ao carrinho.",
  );
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText("estoque");
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Subtotal · 2.38 ETH" }),
  ).toBeVisible();
  await page.getByLabel("Quantidade").selectOption("1");
  await expect(
    page.getByRole("heading", { name: "Subtotal · 1.19 ETH" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remover" }).click();
  await expect(
    page.getByText("Seu carrinho está vazio.", { exact: false }),
  ).toBeVisible();
});
test("Consulta e paginação sobrevivem ao histórico e refresh", async (
  { page },
  testInfo,
) => {
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    const proxima = page.getByRole("button", { name: "Próxima" });
    await proxima.click();
    await expect(page.getByText("Página 2")).toBeVisible();
  } else {
    await expect(page.locator("#catalogo .card")).toHaveCount(8);
    await expect(
      page.getByRole("button", { name: "1", exact: true }),
    ).toHaveAttribute("aria-current", "page");

    await page
      .getByRole("button", { name: "Buscar no marketplace" })
      .click();
  }

  const colecao =
    testInfo.project.name === "mobile"
      ? page.locator(".mobile-quick-filters").getByLabel("Coleção")
      : page
          .getByRole("dialog", { name: "Buscar no marketplace" })
          .getByLabel("Coleção");

  await colecao.selectOption("Nomads");

  if (testInfo.project.name === "mobile") {
    await expect(page.getByText("Página 1")).toBeVisible();
  } else {
    await expect(
      page.getByRole("button", { name: "1", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
  await page.getByLabel("Ordenar por").selectOption("price");
  const busca =
    testInfo.project.name === "mobile"
      ? page.getByRole("searchbox", { name: "Busca rápida" })
      : page.getByRole("searchbox", { name: "Buscar obra" });
  await busca.fill("Sage");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sage Nomad #009" })).toBeVisible();
  await expect(page.locator(".card")).toHaveCount(1);
  await page.goBack();
  await expect(page.locator(".card")).toHaveCount(3);
});
test("Detalhe inexistente", async ({ page }) => {
  await page.goto("/nft/ausente");
  await expect(
    page.getByRole("heading", { name: "Obra não encontrada" }),
  ).toBeVisible();
});

test("Evento de preço atualiza o subtotal aberto", async ({ page }) => {
  await page.goto("/nft/1");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText(
    "Adicionado",
  );
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await expect(page.getByText("Subtotal · 1.19 ETH")).toBeVisible();
  await page.evaluate(() => fetch("/api/demo/price", { method: "POST" }));
  await expect(page.getByText("Subtotal · 1.29 ETH")).toBeVisible();
  await expect(
    page.getByText("Preço atualizado.", { exact: false }),
  ).toBeVisible();
});
