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
    page.getByRole("heading", { name: "Subtotal · 0.64 ETH" }),
  ).toBeVisible();
  await page.getByLabel("Quantidade").selectOption("1");
  await expect(
    page.getByRole("heading", { name: "Subtotal · 0.32 ETH" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remover" }).click();
  await expect(
    page.getByText("Seu carrinho está vazio.", { exact: false }),
  ).toBeVisible();
});
test("Consulta e paginação sobrevivem ao histórico e refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Próxima" }).click();
  await expect(page.getByText("Página 2")).toBeVisible();
  await page.getByLabel("Coleção", { exact: true }).selectOption("Ondas");
  await expect(page.getByText("Página 1")).toBeVisible();
  await page.getByLabel("Ordenar por").selectOption("price");
  await page.getByLabel("Buscar obra").fill("Maré");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Maré Lunar" })).toBeVisible();
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
  await expect(page.getByText("Subtotal · 0.32 ETH")).toBeVisible();
  await page.evaluate(() => fetch("/api/demo/price", { method: "POST" }));
  await expect(page.getByText("Subtotal · 0.36 ETH")).toBeVisible();
  await expect(
    page.getByText("Preço atualizado.", { exact: false }),
  ).toBeVisible();
});
