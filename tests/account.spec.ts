import { test, expect } from "@playwright/test";
test("cadastro retoma carrinho e logout separa o visitante", async ({
  page,
}) => {
  await page.goto("/nft/1");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText(
    "Adicionado",
  );
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await page
    .getByRole("link", { name: "Entrar e guardar meu carrinho" })
    .click();
  await page.getByRole("link", { name: "Criar uma conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Ana");
  await page.getByLabel("E-mail").fill("ana@example.test");
  await page.getByLabel("Senha").fill("Colecao123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/carrinho$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Subtotal · 0.32 ETH" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(
    page.getByRole("link", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Carrinho/ }).click();
  await expect(
    page.getByText("Seu carrinho está vazio.", { exact: false }),
  ).toBeVisible();
});


test("troca de conta bloqueia o recibo anterior e preserva o acesso do proprietário", async ({ page }) => {
  await page.clock.install();
  const senha = "Colecao123";
  const emailAna = "ana-recibo@example.test";

  async function cadastrar(nome: string, email: string) {
    await page.goto("/cadastro");
    await page.getByLabel("Nome", { exact: true }).fill(nome);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(senha);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByRole("link", { name: `Meu perfil de ${nome}` })).toBeVisible();
  }

  async function sair() {
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
  }

  await cadastrar("Ana", emailAna);
  await page.goto("/nft/1");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText("Adicionado");
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await page.getByRole("link", { name: "Ir para pagamento" }).click();
  await page.getByRole("button", { name: "Conectar carteira simulada" }).click();
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await page.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByText("Aguardando o resultado do pagamento.", { exact: true })).toBeVisible();
  await page.clock.fastForward(13_000);

  const confirmado = page.getByRole("heading", { name: "Compra confirmada" });
  const transacao = page.getByText(/^Transação simulada/);
  await expect(confirmado).toBeVisible();
  await expect(transacao).toContainText("SIM-");
  const urlDoRecibo = page.url();
  const referencia = await transacao.innerText();

  await sair();
  await cadastrar("Bruno", "bruno-recibo@example.test");
  await page.goto(urlDoRecibo);

  await expect(page.getByRole("link", { name: "Meu perfil de Bruno" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Não foi possível consultar este pedido.");
  await expect(confirmado).toHaveCount(0);
  await expect(transacao).toHaveCount(0);

  await sair();
  await page.goto(urlDoRecibo);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("E-mail").fill(emailAna);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(urlDoRecibo);
  await expect(confirmado).toBeVisible();
  await expect(transacao).toHaveText(referencia);
});
