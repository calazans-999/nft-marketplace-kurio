import { test, expect } from "@playwright/test";

test("recupera o pedido pendente após perda da resposta e reconexão", async ({
  page,
}) => {
  await page.clock.install();

  await page.goto("/cadastro");
  await page.getByLabel("Nome", { exact: true }).fill("Cris");
  await page.getByLabel("E-mail").fill("compra@example.test");
  await page.getByLabel("Senha").fill("Colecao123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/carrinho$/);

  await page.goto("/nft/1");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText(
    "Adicionado",
  );
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await page.getByRole("link", { name: "Ir para pagamento" }).click();

  await page
    .getByRole("button", { name: "Conectar carteira simulada" })
    .click();
  await page.getByText("Simulação de falha", { exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await page.getByRole("button", { name: "Confirmar compra" }).click();

  await expect(page.getByText(/Resposta indisponível/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Recuperar tentativa" }).click();

  const pendente = page.getByRole("heading", {
    name: "Pagamento em processamento",
  });
  await expect(pendente).toBeVisible();
  await expect(page).toHaveURL(/\/pedido\/[^/]+$/);
  const urlDoPedido = page.url();

  await page.getByRole("button", { name: "Simular desconexão" }).click();
  await expect(
    page.getByText("Conexão da demonstração interrompida."),
  ).toBeVisible();

  // O prazo vence enquanto a tela está desconectada.
  await page.clock.fastForward(13_000);
  await expect(pendente).toBeVisible();

  await page.getByRole("button", { name: "Reconectar" }).click();
  await expect(
    page.getByRole("heading", { name: "Compra confirmada" }),
  ).toBeVisible();
  await expect(page).toHaveURL(urlDoPedido);
  await expect(
    page.getByRole("heading", { name: "Total · 0.33 ETH" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Carrinho · 0" })).toBeVisible();

  const transacao = page.getByText(/^Transação simulada/);
  await expect(transacao).toContainText("SIM-");
  const referencia = await transacao.innerText();

  await page.reload();
  await expect(page).toHaveURL(urlDoPedido);
  await expect(transacao).toHaveText(referencia);
});

test("recebe a recusa com o pedido conectado e preserva o carrinho", async ({
  page,
}) => {
  await page.clock.install();

  await page.goto("/cadastro");
  await page.getByLabel("Nome", { exact: true }).fill("Teste Recusa");
  await page.getByLabel("E-mail").fill("recusa-socket@example.test");
  await page.getByLabel("Senha").fill("Colecao123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/carrinho$/);

  await page.goto("/nft/4");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText(
    "Adicionado",
  );
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await page.getByRole("link", { name: "Ir para pagamento" }).click();

  await page
    .getByRole("button", { name: "Conectar carteira simulada" })
    .click();
  await page.getByText("Simulação de falha", { exact: true }).click();
  await page.getByLabel("Resultado do pagamento").selectOption("declined");
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await page.getByRole("button", { name: "Confirmar compra" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Pagamento em processamento",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Aguardando o resultado do pagamento.", {
      exact: true,
    }),
  ).toBeVisible();

  const urlDoPedido = page.url();
  await page.clock.fastForward(13_000);

  const recusado = page.getByRole("heading", { name: "Pagamento recusado" });
  await expect(recusado).toBeVisible();
  await expect(page).toHaveURL(urlDoPedido);

  await page.reload();
  await expect(recusado).toBeVisible();
  await expect(page).toHaveURL(urlDoPedido);

  await page.getByRole("link", { name: "Voltar ao carrinho" }).click();
  await expect(
    page.getByRole("heading", { name: "Eclipse de Cobre" }),
  ).toBeVisible();
  await expect(page.getByLabel("Quantidade")).toHaveValue("1");
  await expect(
    page.getByRole("heading", { name: "Subtotal · 0.26 ETH" }),
  ).toBeVisible();
});

test("mudança de preço exige nova revisão antes de confirmar", async ({
  page,
}) => {
  await page.goto("/cadastro");
  await page.getByLabel("Nome", { exact: true }).fill("Teste Cotação");
  await page.getByLabel("E-mail").fill("cotacao@example.test");
  await page.getByLabel("Senha").fill("Colecao123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/carrinho$/);

  await page.goto("/nft/1");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText(
    "Adicionado",
  );
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await page.getByRole("link", { name: "Ir para pagamento" }).click();

  await page
    .getByRole("button", { name: "Conectar carteira simulada" })
    .click();
  const revisar = page.getByRole("button", { name: "Revisar compra" });
  const confirmar = page.getByRole("button", { name: "Confirmar compra" });

  await revisar.click();
  await expect(confirmar).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Total · 0.33 ETH" }),
  ).toBeVisible();

  // O handler MSW altera o catálogo e envia nft.updated pelo Socket.IO.
  const status = await page.evaluate(async () => {
    const resposta = await fetch("/api/demo/price", { method: "POST" });
    return resposta.status;
  });
  expect(status).toBe(200);

  await expect(
    page.getByText("A cotação mudou. Revise o novo total.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Total · 0.37 ETH" }),
  ).toBeVisible();
  await expect(confirmar).toHaveCount(0);
  await expect(page).toHaveURL(/\/pagamento$/);

  await revisar.click();
  await expect(confirmar).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Total · 0.37 ETH" }),
  ).toBeVisible();
});

test("obra esgotada durante a revisão bloqueia a compra", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Nome", { exact: true }).fill("Teste Estoque");
  await page.getByLabel("E-mail").fill("estoque@example.test");
  await page.getByLabel("Senha").fill("Colecao123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/carrinho$/);

  await page.goto("/nft/1");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText(
    "Adicionado",
  );
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await page.getByRole("link", { name: "Ir para pagamento" }).click();
  await page
    .getByRole("button", { name: "Conectar carteira simulada" })
    .click();
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await expect(
    page.getByRole("button", { name: "Confirmar compra" }),
  ).toBeEnabled();

  const status = await page.evaluate(async () => {
    const response = await fetch("/api/demo/sold-out", { method: "POST" });
    return response.status;
  });
  expect(status).toBe(200);

  await expect(
    page.getByRole("heading", { name: "Disponibilidade alterada" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Órbita Solar está esgotada.",
  );
  await expect(
    page.getByRole("button", { name: "Confirmar compra" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/pagamento$/);

  await page.getByRole("link", { name: "Ajustar carrinho" }).click();
  await expect(
    page.getByRole("heading", { name: "Órbita Solar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remover" }).click();
  await expect(
    page.getByText("Seu carrinho está vazio.", { exact: false }),
  ).toBeVisible();
});

test("timeout após criação preserva a chave e recupera um só pedido", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/cadastro");
  await page.getByLabel("Nome", { exact: true }).fill("Teste Timeout");
  await page.getByLabel("E-mail").fill("timeout@example.test");
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
  await page
    .getByRole("button", { name: "Conectar carteira simulada" })
    .click();
  await page.getByText("Simulação de falha", { exact: true }).click();
  await page.getByLabel("Prazo da resposta do pedido").selectOption("timeout");
  await page.getByRole("button", { name: "Revisar compra" }).click();
  const confirm = page.getByRole("button", { name: "Confirmar compra" });
  const isNewOrder = (request: import("@playwright/test").Request) =>
    request.method() === "POST" &&
    new URL(request.url()).pathname === "/api/orders";
  const [first] = await Promise.all([
    page.waitForRequest(isNewOrder),
    confirm.click(),
  ]);
  const key = first.headers()["idempotency-key"];
  expect(key).toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Recuperar tentativa" }),
  ).toBeDisabled();
  await page.clock.fastForward(8_500);
  await expect(page.getByText(/Resposta indisponível/)).toBeVisible();
  const [second] = await Promise.all([
    page.waitForRequest(isNewOrder),
    page.getByRole("button", { name: "Recuperar tentativa" }).click(),
  ]);
  expect(second.headers()["idempotency-key"]).toBe(key);
  await expect(page).toHaveURL(new RegExp("/pedido/" + key + "$"));
  await page.goto("/pagamento");
  const pending = page.getByRole("link", { name: "Acompanhar pedido" });
  await expect(pending).toHaveAttribute("href", "/pedido/" + key);
  await pending.click();
  await expect(page).toHaveURL(new RegExp("/pedido/" + key + "$"));
  await expect(
    page.getByText("Aguardando o resultado do pagamento.", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(13_000);
  await expect(
    page.getByRole("heading", { name: "Compra confirmada" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Carrinho · 0", exact: true }),
  ).toBeVisible();
});
