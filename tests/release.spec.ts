import { expect, test, type Page } from "@playwright/test";

async function percorrerTelas(
  page: Page,
  conferir: (nome: string) => Promise<void>,
) {
  await page.goto("/");
  const catalogo = page.locator("#catalogo");
  await expect(
    catalogo.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
  await conferir("inicio");

  await page.goto("/nft/1");
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
  await conferir("detalhe");

  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".detail [role=status]")).toContainText(
    "Adicionado",
  );
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Subtotal · 1.19 ETH",
      exact: true,
    }),
  ).toBeVisible();
  await conferir("carrinho");

  await page.getByRole("link", { name: "Ir para pagamento" }).click();
  await page.getByRole("link", { name: "Criar uma conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Colecionador Demo");
  await page.getByLabel("E-mail").fill("release@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("Colecao123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/pagamento$/);
  await expect(
    page.getByRole("heading", {
      name: "Total · 1.20 ETH",
      exact: true,
    }),
  ).toBeVisible();
  await conferir("pagamento");
}

for (const width of [390, 768, 1440]) {
  test(`responsivo em ${width} px`, async ({ page }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Larguras explícitas neste cenário.",
    );
    await page.setViewportSize({ width, height: 900 });

    await percorrerTelas(page, async (nome) => {
      await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const root = document.documentElement;
              return root.scrollWidth - root.clientWidth;
            }),
          {
            message: `${nome} com overflow horizontal em ${width} px`,
          },
        )
        .toBeLessThanOrEqual(1);
    });
  });
}

test("regressão visual de início, detalhe, carrinho e pagamento", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  await percorrerTelas(page, async (nome) => {
    if (nome === "pagamento") {
      const saved = await page.evaluate(async () => {
        const response = await fetch("/api/wallets/primary", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + sessionStorage.getItem("forma:token"),
          },
          body: JSON.stringify({
            label: "Principal",
            address: "0x" + "a".repeat(40),
            network: "Ethereum Demo",
          }),
        });
        return response.ok;
      });
      expect(saved).toBe(true);
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Total · 1.20 ETH", exact: true }),
      ).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect(page).toHaveScreenshot(`${nome}.png`, {
      fullPage: true,
      animations: "disabled",
    });
  });
});
