# Validação do pacote

- Build TypeScript/Vite e lint aprovados.
- 15 testes de contrato aprovados. Inclui quantidades inválidas em carrinho.
- Playwright em Chromium com 53 execuções aprovadas e 3 ignoradas por configuração. As três larguras explícitas rodam no projeto desktop. O relatório HTML está em playwright-report/index.html.
- Oito referências Linux de início, detalhe, carrinho e pagamento aprovadas em desktop e mobile.
- A interface usa os frames fornecidos como referência visual. Os retratos WebP são recortes desses frames. Os dados simulados de catálogo foram preservados.
- O layout adapta navegação, formulários e áreas editoriais ao escopo implementado. A versão usa tipografia monoespaçada de sistema. A fidelidade exata fica condicionada à revisão dos assets e propriedades originais no Figma.
- O deploy ainda precisa ser executado e verificado em sua URL pública.

## Lighthouse

Medianas de três execuções para cada combinação, sobre o build de produção no ambiente Linux com Chromium headless. Os relatórios HTML e JSON ficam em reports/lighthouse/. LCP e TBT estão em milissegundos.

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Inicio | Mobile | 95 | 100 | 100 | 100 | 2876 | 0.001 | 0 |
| Inicio | Desktop | 100 | 100 | 100 | 100 | 607 | 0.000 | 0 |
| Detalhe | Mobile | 95 | 100 | 100 | 100 | 2867 | 0.001 | 0 |
| Detalhe | Desktop | 100 | 100 | 100 | 100 | 609 | 0.007 | 0 |
