import { test, expect } from "@playwright/test";

test("diálogo da obra retém foco e a edição limitada pode ser adicionada", async ({
  page,
}) => {
  await page.goto("/nft/1");
  const trigger = page.getByRole("button", { name: "Ampliar obra" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Órbita Solar" });
  const close = dialog.getByRole("button", { name: "Fechar" });
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await page.getByLabel("Edição", { exact: true }).selectOption("1-limited");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText(
    "Adicionado",
  );
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await expect(page.getByText("Limitada · 0.32 ETH por unidade")).toBeVisible();
});

test("checkout recupera a conexão recusada e permite trocar a rede", async ({
  page,
}) => {
  await page.goto("/cadastro");
  await page.getByLabel("Nome", { exact: true }).fill("Teste Rede");
  await page.getByLabel("E-mail").fill("rede@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("Colecao123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/carrinho$/);
  await page.goto("/nft/1");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText(
    "Adicionado",
  );
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await page.getByRole("link", { name: "Ir para pagamento" }).click();

  await page.getByText("Simulação de falha", { exact: true }).click();
  const scenario = page.getByLabel("Conexão da carteira");
  const connect = page.getByRole("button", {
    name: "Conectar carteira simulada",
  });
  const review = page.getByRole("button", { name: "Revisar compra" });
  await scenario.selectOption("decline");
  await connect.click();
  await expect(
    page.getByText("Conexão recusada pela carteira simulada."),
  ).toBeVisible();
  await expect(review).toBeDisabled();

  await scenario.selectOption("allow");
  const network = page.getByRole("combobox", { name: "Rede", exact: true });
  await network.selectOption("Ethereum Testnet Demo");
  await connect.click();
  await expect(review).toBeEnabled();
  await expect(network).toBeDisabled();
  await page.getByRole("button", { name: "Desconectar carteira" }).click();
  await expect(network).toBeEnabled();
  await expect(review).toBeDisabled();
});
