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

## Layout KURIO

A página inicial utiliza a identidade visual KURIO com:

- cabeçalho responsivo e navegação preservada;
- hero editorial com chamada para o marketplace;
- catálogo com busca, coleção, ordenação, filtros visuais e paginação;
- grade responsiva de NFTs;
- banners de coleções;
- seção Diário da Cunhagem;
- rodapé com newsletter, links e carteiras compatíveis.

Os fluxos existentes de conta, perfil, favoritos, carrinho, cupom, carteiras e pagamento foram preservados.
## Cobertura da entrega

### Stack utilizada

- React e TypeScript na interface;
- TanStack Router para rotas, parâmetros de busca e proteção dos fluxos privados;
- TanStack Query para consultas, mutations, cache e invalidação;
- Axios para todas as chamadas REST;
- MSW para sessão, catálogo, favoritos, carrinho, checkout, pedidos, perfil e carteiras;
- Socket.IO Client para `nft.updated` e `order.updated`;
- Tailwind CSS e componentes adaptados do shadcn/ui/Radix;
- Playwright para E2E, acessibilidade e regressão visual;
- Lighthouse para auditorias mobile e desktop.

### Rotas

| Rota | Tela |
| --- | --- |
| `/` | Início, busca, filtros, ordenação e catálogo |
| `/nft/:id` | Detalhes, galeria, edição, favorito e compra |
| `/carrinho` | Carrinho, quantidades, cupom e totais |
| `/pagamento` | Carteira, rede, revisão e envio do pedido |
| `/pedido/:id` | Pedido pendente, confirmado ou recusado |
| `/login` | Login e retomada do fluxo anterior |
| `/cadastro` | Cadastro de colecionador |
| `/perfil` | Dados, avatar e alteração de senha |
| `/carteiras` | Carteiras principal e secundária |

As mesmas rotas atendem desktop, tablet e mobile. Não existem páginas móveis duplicadas.

### Estados e falhas

A interface possui estados de carregamento, vazio, erro e recuperação. Os cenários configuráveis incluem:

- resultado vazio e falha de catálogo;
- latência variável e respostas fora de ordem;
- sessão expirada;
- conflito de cadastro;
- cupom inválido ou expirado;
- preço alterado ou edição esgotada;
- conexão de carteira recusada;
- pagamento recusado;
- timeout depois da criação do pedido;
- desconexão e retomada de pedido pendente;
- eventos duplicados ou antigos.

Favoritos usam atualização otimista com rollback. Pedidos usam chave de idempotência e o recibo conserva o snapshot da compra.

### Responsividade e acessibilidade

Os layouts foram preparados para `390px`, `768px` e `1440px`. Os frames entregues de início, detalhe, carrinho, pagamento, login e cadastro foram adaptados para mobile. Perfil, carteiras e confirmação utilizam composição responsiva mesmo sem frames móveis específicos.

A aplicação mantém:

- link para pular ao conteúdo;
- labels e nomes acessíveis;
- feedback por `role="status"` e `role="alert"`;
- foco visível;
- diálogo com contenção e restauração de foco;
- navegação por teclado;
- alternativas textuais para imagens relevantes;
- suporte a redução de movimento;
- prevenção de overflow horizontal nas composições móveis.

### Assets

As artes ficam em `public/art/`, com versões SVG, PNG e WebP locais. O projeto não depende de CDN privada para imagens ou fontes. A tipografia usa uma pilha monoespaçada de sistema como substituição reproduzível para a fonte do arquivo de design.

## Limitações e desvios conhecidos

- Login social, newsletter, redes sociais e links editoriais são demonstrativos e não informam sucesso funcional.
- Integrações reais com blockchain, extensões de carteira e gateways de pagamento estão fora do escopo.
- O cadastro mantém nome, e-mail e senha, conforme o contrato da API simulada. O campo visual adicional “Confirmar senha” do frame mobile não foi incluído porque o contrato atual não o recebe; a senha continua validada por tamanho mínimo e pelos erros da API.
- Alguns ícones do Figma foram substituídos por SVGs locais ou símbolos acessíveis para evitar dependências privadas.
- A navegação móvel inferior é apresentada na página inicial; as telas de fluxo usam cabeçalho contextual para voltar.
- Os filtros visuais sem contrato de API permanecem demonstrativos. Busca, coleção, ordenação e paginação continuam integradas à URL e à API.
- Os botões sociais mantêm comportamento neutro, pois autenticação social não integra o escopo funcional.

## Pendências para a rodada final

Validações concluídas nesta etapa:

- `npm run typecheck`: aprovado;
- `npm run lint`: aprovado;
- `npm test`: 15 testes de contrato aprovados;
- `npm run build`: aprovado;
- grupos funcionais corrigidos do Playwright aprovados em desktop e mobile.

Requisitos que permanecem pendentes:

- executar a suíte completa do Playwright em uma única rodada;
- executar separadamente os testes visuais de `release.spec.ts`;
- revisar ou atualizar snapshots somente após inspeção visual;
- executar Lighthouse e registrar as medianas finais;
- validar acesso direto e refresh das rotas no ambiente publicado;
- publicar somente após autorização;
- informar a URL pública e o repositório quando estiverem disponíveis;
- os avisos `MODULE_LEVEL_DIRECTIVE` de dependências TanStack/Radix são conhecidos e não bloqueiam a compilação.
