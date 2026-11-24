import { test, expect, type Page } from "@playwright/test";

async function scenario(page: Page, action: "arm" | "status" | "release") {
  return page.evaluate(async (action) => {
    const token = sessionStorage.getItem("forma:token");
    const response = await fetch("/api/demo/favorite-failure/" + action, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    });
    if (!response.ok) throw new Error("Falha ao controlar cenário: " + response.status);
    return response.json();
  }, action);
}

test("favorito otimista volta ao estado anterior na falha e persiste após nova tentativa", async ({ page }) => {
  await page.goto("/nft/1");
  await page.getByRole("link", { name: "Entrar para favoritar" }).click();
  await page.getByRole("link", { name: "Criar uma conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Teste Favoritos");
  await page.getByLabel("E-mail").fill("favorito-e2e@example.test");
  await page.getByLabel("Senha").fill("Colecao123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/nft\/1$/);

  const add = page.getByRole("button", { name: "Favoritar obra", exact: true });
  const remove = page.getByRole("button", { name: "Remover dos favoritos" });
  const alert = page.getByRole("alert").filter({ hasText: "atualizar os favoritos" });

  await expect(add).toHaveAttribute("aria-pressed", "false");
  await scenario(page, "arm");
  await add.click();

  try {
    await expect.poll(async () => (await scenario(page, "status")).started).toBe(true);
    await expect(remove).toHaveAttribute("aria-pressed", "true");
    await expect(remove).toBeDisabled();
  } finally {
    await scenario(page, "release");
  }

  await expect(alert).toBeVisible();
  await expect(add).toHaveAttribute("aria-pressed", "false");
  await expect(add).toBeEnabled();

  await add.click();
  await expect(remove).toBeEnabled();
  await expect(alert).toHaveCount(0);
  await page.reload();
  await expect(remove).toHaveAttribute("aria-pressed", "true");

  await remove.click();
  await expect(add).toBeEnabled();
  await page.reload();
  await expect(add).toHaveAttribute("aria-pressed", "false");
});