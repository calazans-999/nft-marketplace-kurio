import { test, expect, type Locator, type Page } from "@playwright/test";

async function chegarComTab(page: Page, alvo: Locator, limite = 30) {
  await expect(alvo).toBeVisible();
  for (let i = 0; i < limite; i++) {
    if (await alvo.evaluate(el => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(alvo).toBeFocused();
}

test("teclado permite pular o menu, buscar uma obra e adicioná-la ao carrinho", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Órbita Solar", exact: true })).toBeVisible();

  const salto = page.getByRole("link", { name: "Pular para o conteúdo" });
  await page.keyboard.press("Tab");
  await expect(salto).toBeFocused();
  await expect(salto).toBeInViewport();

  await page.keyboard.press("Enter");
  await expect(page.locator("main#content")).toBeFocused();

  const busca = page.getByRole("searchbox", { name: "Buscar obra" });
  await chegarComTab(page, busca);
  await page.keyboard.type("Jade");

  const catalogo = page.locator("#catalogo");
  await expect(catalogo.locator(".card")).toHaveCount(1);
  const obra = catalogo.getByRole("link", { name: /Anel de Jade/ });
  await chegarComTab(page, obra);
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/nft\/3$/);
  await expect(page.getByRole("heading", { name: "Anel de Jade", exact: true })).toBeVisible();

  const adicionar = page.getByRole("button", { name: "Adicionar ao carrinho" });
  await chegarComTab(page, adicionar);
  await page.keyboard.press("Enter");

  await expect(page.locator(".detail [role=status]")).toContainText("Adicionado");
  await expect(page.getByRole("link", { name: "Carrinho · 1", exact: true })).toBeVisible();
});