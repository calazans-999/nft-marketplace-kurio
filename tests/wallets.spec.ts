import { test, expect } from "@playwright/test";

test("colecionador edita a principal e cadastra a secundária após corrigir o endereço", async ({ page }) => {
  await page.goto("/carteiras");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Criar uma conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Teste Carteiras");
  await page.getByLabel("E-mail").fill("carteiras-e2e@example.test");
  await page.getByLabel("Senha").fill("Colecao123");
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/carteiras$/);
  await expect(page.getByRole("heading", { name: "Minhas carteiras" })).toBeVisible();

  const primary = page.getByRole("form", { name: "Carteira principal" });
  const secondary = page.getByRole("form", { name: "Carteira secundária" });
  const addressA = "0x" + "a".repeat(40);
  const addressB = "0x" + "b".repeat(40);

  await primary.getByLabel("Nome da carteira").fill("Minha principal");
  await primary.getByLabel("Endereço da carteira").fill(addressA);
  await primary.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(primary.getByRole("status")).toHaveText("Carteira salva.");

  await secondary.getByLabel("Nome da carteira").fill("Reserva");
  const address = secondary.getByLabel("Endereço da carteira");
  const create = secondary.getByRole("button", { name: "Cadastrar carteira" });

  await address.fill("0x12");
  await create.click();
  await expect(address).toHaveAttribute("aria-invalid", "true");
  await expect(secondary.getByRole("alert")).toHaveText(
    "Use 0x seguido de 40 caracteres hexadecimais."
  );

  await address.fill(addressA);
  await create.click();
  await expect(secondary.getByRole("alert")).toHaveText(
    "Este endereço já está na outra carteira."
  );

  await address.fill(addressB);
  await create.click();
  await expect(secondary.getByRole("status")).toHaveText("Carteira salva.");

  await page.reload();
  await expect(primary.getByLabel("Nome da carteira")).toHaveValue("Minha principal");
  await expect(primary.getByLabel("Endereço da carteira")).toHaveValue(addressA);
  await expect(secondary.getByLabel("Nome da carteira")).toHaveValue("Reserva");
  await expect(secondary.getByLabel("Endereço da carteira")).toHaveValue(addressB);
});

test("compra com a secundária preserva a carteira original no recibo", async ({ page }) => {
  await page.clock.install();
  const original = "0x" + "b".repeat(40);
  const novo = "0x" + "c".repeat(40);

  await page.goto("/carteiras");
  await page.getByRole("link", { name: "Criar uma conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Compra Reserva");
  await page.getByLabel("E-mail").fill("compra-reserva@example.test");
  await page.getByLabel("Senha").fill("Colecao123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/carteiras$/);

  const secondary = page.getByRole("form", { name: "Carteira secundária" });
  await secondary.getByLabel("Nome da carteira").fill("Reserva");
  await secondary.getByLabel("Endereço da carteira").fill(original);
  await secondary.getByRole("button", { name: "Cadastrar carteira" }).click();
  await expect(secondary.getByRole("status")).toHaveText("Carteira salva.");

  await page.goto("/nft/1");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText("Adicionado");
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await page.getByRole("link", { name: "Ir para pagamento" }).click();

  const selector = page.getByRole("combobox", { name: "Carteira", exact: true });
  await expect(selector.locator("option")).toHaveCount(2);
  await selector.selectOption({ label: "Reserva · bbbbbbbb" });
  await page.getByRole("button", { name: "Conectar carteira simulada" }).click();
  await expect(selector).toBeDisabled();
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await page.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByText("Aguardando o resultado do pagamento.", { exact: true })).toBeVisible();
  await page.clock.fastForward(13_000);

  await expect(page.getByRole("heading", { name: "Compra confirmada" })).toBeVisible();
  const receipt = page.url();
  await expect(page.getByText("Carteira · Reserva", { exact: true })).toBeVisible();
  await expect(page.getByText(`Endereço · ${original}`, { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Minhas carteiras" }).click();
  await secondary.getByLabel("Nome da carteira").fill("Reserva atualizada");
  await secondary.getByLabel("Endereço da carteira").fill(novo);
  await secondary.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(secondary.getByRole("status")).toHaveText("Carteira salva.");
  await page.reload();
  await expect(secondary.getByLabel("Endereço da carteira")).toHaveValue(novo);

  await page.goto(receipt);
  await expect(page.getByText("Carteira · Reserva", { exact: true })).toBeVisible();
  await expect(page.getByText(`Endereço · ${original}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Endereço · ${novo}`, { exact: true })).toHaveCount(0);
});
