import { test, expect, type Locator, type Page } from "@playwright/test";

async function chegarComTab(page: Page, alvo: Locator, limite = 30) {
  await expect(alvo).toBeVisible();
  for (let i = 0; i < limite; i++) {
    if (await alvo.evaluate(el => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(alvo).toBeFocused();
}

test("teclado permite pular o menu, buscar uma obra e adicioná-la ao carrinho", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Emerald Ape #042", exact: true })).toBeVisible();

  const salto = page.getByRole("link", { name: "Pular para o conteúdo" });
  await page.keyboard.press("Tab");
  await expect(salto).toBeFocused();
  await expect(salto).toBeInViewport();

  await page.keyboard.press("Enter");
  await expect(page.locator("main#content")).toBeFocused();

  const nomeDaBusca =
    testInfo.project.name === "mobile" ? "Busca rápida" : "Buscar obra";

  if (testInfo.project.name === "desktop") {
    const abrirBusca = page.getByRole("button", {
      name: "Buscar no marketplace",
    });

    await abrirBusca.focus();
    await expect(abrirBusca).toBeFocused();
    await page.keyboard.press("Enter");
  }

  const busca = page.getByRole("searchbox", { name: nomeDaBusca });

  if (testInfo.project.name === "mobile") {
    await chegarComTab(page, busca);
  } else {
    await expect(busca).toBeFocused();
  }

  await page.keyboard.type("Neon");

  const catalogo = page.locator("#catalogo");
  await expect(catalogo.locator(".card")).toHaveCount(1);
  const obra = catalogo.getByRole("link", { name: /Neon Vessel #552/ });
  await chegarComTab(page, obra);
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/nft\/3$/);
  await expect(page.getByRole("heading", { name: "Neon Vessel #552", exact: true })).toBeVisible();

  const adicionar = page.getByRole("button", { name: "Adicionar ao carrinho" });
  await chegarComTab(page, adicionar);
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("status").filter({ hasText: "Adicionado" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Carrinho · 1", exact: true })).toBeVisible();
});