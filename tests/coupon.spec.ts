import { test, expect } from "@playwright/test";

test("cupom do visitante mantém o desconto até o recibo", async ({ page }) => {
  await page.clock.install();
  await page.goto("/nft/1");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText("Adicionado");
  await page.getByRole("link", { name: "Ver carrinho" }).click();

  const code = page.getByLabel("Código do cupom");
  const apply = page.getByRole("button", { name: "Aplicar cupom" });
  const total = (value: string) =>
    page.getByRole("heading", { name: `Total · ${value} ETH`, exact: true });

  await expect(total("0.33")).toBeVisible();
  await code.fill("forma10");
  await apply.click();
  await expect(total("0.298")).toBeVisible();
  await expect(page.getByText("Desconto · 0.032 ETH", { exact: true })).toBeVisible();

  for (const [invalid, message] of [
    ["DESCONHECIDO", "Cupom inválido."],
    ["EXPIRADO10", "Cupom expirado."],
  ]) {
    await code.fill(invalid);
    await apply.click();
    await expect(page.getByRole("alert")).toHaveText(message);
    await expect(page.getByText("Cupom aplicado · FORMA10")).toBeVisible();
    await expect(total("0.298")).toBeVisible();
  }

  await page.getByRole("button", { name: "Remover cupom" }).click();
  await expect(total("0.33")).toBeVisible();
  await expect(page.getByText("Cupom aplicado · FORMA10")).toHaveCount(0);

  await code.fill("FORMA10");
  await apply.click();
  await expect(total("0.298")).toBeVisible();
  await page.reload();
  await expect(total("0.298")).toBeVisible();

  await page.getByRole("link", { name: "Ir para pagamento" }).click();
  await page.getByRole("link", { name: "Criar uma conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Teste Cupom");
  await page.getByLabel("E-mail").fill("cupom-e2e@example.test");
  await page.getByLabel("Senha").fill("Colecao123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/pagamento$/);

  await page.getByRole("button", { name: "Conectar carteira simulada" }).click();
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await expect(page.getByText("Cupom aplicado · FORMA10")).toBeVisible();
  await expect(total("0.298")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByRole("heading", { name: "Pagamento em processamento" })).toBeVisible();
  await expect(page.getByText("Aguardando o resultado do pagamento.", { exact: true })).toBeVisible();

  await page.clock.fastForward(13_000);
  await expect(page.getByRole("heading", { name: "Compra confirmada" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Cupom aplicado · FORMA10")).toBeVisible();
  await expect(page.getByText("Desconto · 0.032 ETH", { exact: true })).toBeVisible();
  await expect(total("0.298")).toBeVisible();
});