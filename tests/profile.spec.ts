import { test, expect } from "@playwright/test";

test("perfil persiste dados e avatar e permite entrar com a nova senha", async ({ page }) => {
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Criar uma conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Perfil Inicial");
  await page.getByLabel("E-mail").fill("perfil-ui@example.test");
  await page.getByLabel("Senha").fill("Inicial123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/perfil$/);

  const dados = page.getByRole("form", { name: "Dados do perfil" });
  await dados.getByLabel("Nome", { exact: true }).fill("Colecionador Atualizado");
  await dados.getByLabel("E-mail").fill("perfil-editado@example.test");
  await dados.getByLabel("Avatar").selectOption("3");
  await dados.getByRole("button", { name: "Salvar perfil" }).click();

  await expect(dados.getByRole("status")).toHaveText("Perfil salvo.");
  await expect(page.getByRole("link", {
    name: "Meu perfil de Colecionador Atualizado"
  })).toBeVisible();

  await page.reload();
  await expect(dados.getByLabel("Nome", { exact: true })).toHaveValue("Colecionador Atualizado");
  await expect(dados.getByLabel("E-mail")).toHaveValue("perfil-editado@example.test");
  await expect(dados.getByLabel("Avatar")).toHaveValue("3");
  await expect(dados.getByRole("img", { name: "Avatar selecionado: Neon Vessel #552" })).toBeVisible();

  const senha = page.getByRole("form", { name: "Alteração de senha" });
  await senha.getByLabel("Senha atual").fill("Incorreta123");
  await senha.getByLabel("Nova senha").fill("Alterada456");
  await senha.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(senha.getByRole("alert")).toHaveText("Senha atual incorreta.");
  await expect(senha.getByLabel("Senha atual")).toHaveAttribute("aria-invalid", "true");

  await senha.getByLabel("Senha atual").fill("Inicial123");
  await senha.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(senha.getByRole("status")).toHaveText("Senha alterada.");
  await expect(senha.getByLabel("Senha atual")).toHaveValue("");
  await expect(senha.getByLabel("Nova senha")).toHaveValue("");

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
  await page.goto("/perfil");
  await page.getByLabel("E-mail").fill("perfil-editado@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("Alterada456");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(dados.getByLabel("Avatar")).toHaveValue("3");
});