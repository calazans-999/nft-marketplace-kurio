import { test, expect } from "@playwright/test";

test("sessão expirada durante a revisão retoma o checkout e preserva o cupom", async ({ page }) => {
  await page.clock.install();

  const email = "retomada-checkout@example.test";
  const password = "Colecao123";

  await page.goto("/cadastro");
  await page.getByLabel("Nome", { exact: true }).fill("Teste Retomada");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/carrinho$/);

  await page.goto("/nft/1");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText("Adicionado");
  await page.getByRole("link", { name: "Ver carrinho" }).click();

  await page.getByLabel("Código do cupom").fill("FORMA10");
  await page.getByRole("button", { name: "Aplicar cupom" }).click();
  const total = page.getByRole("heading", { name: "Total · 0.298 ETH", exact: true });
  await expect(total).toBeVisible();

  await page.getByRole("link", { name: "Ir para pagamento" }).click();
  await page.getByRole("button", { name: "Conectar carteira simulada" }).click();
  await page.getByRole("button", { name: "Revisar compra" }).click();
  const confirmar = page.getByRole("button", { name: "Confirmar compra" });
  await expect(confirmar).toBeEnabled();

  // Expira a sessão pelo relógio, preservando token, carrinho e estado dos mocks.
  const agora = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(new Date(agora + 61 * 60 * 1000));
  await page.reload();

  await expect(page).toHaveURL(/\/login$/);
  await expect(confirmar).toHaveCount(0);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(/\/pagamento$/);
  await expect(page.getByText(/1\s*×\s*Órbita Solar/)).toBeVisible();
  await expect(page.getByText("Cupom aplicado · FORMA10", { exact: true })).toBeVisible();
  await expect(total).toBeVisible();

  const revisar = page.getByRole("button", { name: "Revisar compra" });
  await expect(confirmar).toHaveCount(0);
  await expect(revisar).toBeDisabled();
  await page.getByRole("button", { name: "Conectar carteira simulada" }).click();
  await revisar.click();
  await expect(confirmar).toBeEnabled();
  await expect(total).toBeVisible();
});