# Kurio · NFT Marketplace

Projeto do Frontend Challenge. O catálogo, a sessão, a carteira e os pagamentos são simulados no navegador. A aplicação inclui descoberta, carrinho de visitante, cupom, checkout, recibo, favoritos, perfil e carteiras principal e secundária.

## Executar

Use Node.js 24 e npm. Na pasta que contém o package.json, execute:

```sh
npm ci
npm run dev
```

O Vite indica a URL local. O mock fica habilitado por padrão no desenvolvimento e no build. Definir `VITE_MOCKS=false` desliga a interceptação e exige uma API compatível. A demonstração publicada funciona com os mocks habilitados. Use HTTPS ou localhost para permitir o service worker. Cada origem mantém dados próprios.

## Demonstrar

Abra **Cenários de demonstração**, no fim da página, e escolha **Criar contas de demonstração**. As duas contas são `demo-a@example.test` e `demo-b@example.test`, ambas com senha `DemoForma123`. Também é possível cadastrar um usuário. Use apenas dados fictícios.

- **Compra e cupom.** Adicione uma obra, escolha a edição e aplique `FORMA10`. `EXPIRADO10` reproduz cupom expirado. Conecte a carteira no checkout, revise a cotação e confirme.
- **Preço ou estoque alterado.** Durante a revisão, use a opção de alterar preço ou esgotar a edição original da Órbita Solar. O carrinho e o checkout são consultados novamente após o evento.
- **Recusa e perda da resposta.** Em **Simulação de falha**, selecione a recusa da conexão, a recusa do pagamento ou a perda da resposta após criação. Para o último caso, use **Recuperar tentativa**. A tentativa mantém a chave de idempotência.
- **Rede.** O painel pode armar uma falha de rede ou timeout para a próxima consulta ao catálogo. Navegue para o catálogo na mesma aba e selecione **Tentar novamente** após o erro. Os cenários determinísticos de 503 e respostas fora de ordem também estão em `tests/catalog-network.spec.ts`.
- **Pedido pendente.** Use **Simular desconexão** e **Reconectar** na tela de processamento. Se fechar a página, abra novamente o endereço do pedido para recuperar o estado.
- **Reset.** A seção **Restaurar os dados iniciais** apaga os dados simulados locais do marketplace após confirmação e recarrega o catálogo inicial.

## Validar

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Para ponta a ponta, com o build já realizado:

```sh
npx playwright install chromium
npm run test:e2e -- --workers=1
npx playwright show-report
```

O relatório HTML fica em `playwright-report/`. Falhas guardam traces em `test-results/`. O Playwright usa referências visuais por sistema operacional. As referências Linux foram geradas para este pacote. Após conferir as telas no Windows, gere as referências locais atualizadas com:

```sh
npx playwright test tests/release.spec.ts --grep "regressão visual" --update-snapshots --workers=1
```

Depois execute novamente sem `--update-snapshots` para validar a comparação. O projeto desktop executa os três testes de largura e os equivalentes são ignorados no projeto mobile.

## Auditar

Com Chrome ou Chromium instalado, execute:

```sh
npm run audit
```

O script gera 12 pares HTML/JSON e um resumo com medianas em `reports/lighthouse/`. Use `CHROMIUM_PATH` para indicar um executável, se necessário. Para a metodologia, veja [ARCHITECTURE.md](ARCHITECTURE.md).

## Hospedar

A configuração da Vercel usa `npm run build`, publica `dist/` e encaminha rotas internas da SPA ao HTML. A publicação e sua URL devem ser validadas separadamente, incluindo acesso direto a uma rota, interceptação pelo MSW e compra simulada.

A interface foi ajustada com base nos frames fornecidos. Foram usados recortes
das artes em WebP e tipografia monoespaçada de sistema. O catálogo permanece
simulado, com nomes e preços das fixtures da aplicação. O layout preserva as
rotas e ações testáveis, com adaptações para formulários, lista de itens e
navegação. A fidelidade exata depende dos assets vetoriais e das propriedades
de tipografia e espaçamento no Figma. Os fluxos de autenticação social e os
links editoriais ficam fora desta implementação.
