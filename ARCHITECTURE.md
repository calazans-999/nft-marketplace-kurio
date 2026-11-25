# Arquitetura

React e TypeScript formam a interface. TanStack Router controla rotas privadas e parâmetros de catálogo. TanStack Query mantém estado remoto e usa cancelamento via Axios. Tailwind e a camada de diálogo adaptada do shadcn/ui compõem a interface. O diálogo usa Radix para foco inicial, contenção do foco, Escape e retorno ao acionador.

## Contratos

| Método e caminho | Comportamento |
| --- | --- |
| POST /api/accounts, POST /api/login | Cria conta, valida credenciais e associa a cesta de visitante. |
| GET e DELETE /api/session | Consulta a sessão e encerra o token. |
| GET /api/nfts, GET /api/nfts/:id | Filtra, ordena e pagina obras. O detalhe devolve as edições disponíveis e os estoques correspondentes. |
| GET /api/cart, PUT /api/cart/:id | Consulta e altera itens pelo identificador de edição. Quantidade zero remove a linha. |
| PUT e DELETE /api/cart-coupon | Valida, aplica ou remove código e devolve os totais recalculados. |
| GET /api/checkout, POST /api/checkout/connect | Carrega cotação, carteiras e pedido pendente para retomada, valida a rede e simula a conexão ou recusa. |
| POST /api/orders, GET /api/orders/:id | Cria pedido idempotente e consulta exclusivamente os dados do comprador. |
| GET /api/favorites, PUT e DELETE /api/favorites/:id | Consulta e altera favoritos da conta. |
| GET e PATCH /api/profile, PATCH /api/profile/password | Consulta e atualiza perfil. A alteração de senha revoga as outras sessões da conta. |
| GET /api/wallets, PUT /api/wallets/:slot | Consulta, cadastra e edita as carteiras demonstrativas. |
| POST /api/demo/* | Seleciona cenários determinísticos e restaura os dados locais de demonstração. |

As respostas HTTP distinguem erro de autenticação, recurso inexistente, conflito e entrada inválida. Favoritos alteram o cache de forma otimista e fazem rollback em caso de falha. As chaves de consulta privadas incluem a conta. Login e logout recarregam a aplicação para reconstruir o cache e as conexões.

## Sessão, cesta e pedidos

A sessão simulada expira após uma hora. O token fica em sessionStorage. Contas, estoque e pedidos persistem no armazenamento local. Senhas fictícias são derivadas com PBKDF2 e salt. Em caso de expiração, a aplicação guarda o endereço para retornar após o login.

A cesta distingue as edições pelo identificador de estoque. No login, as quantidades da cesta de visitante são somadas até o estoque disponível. O cupom acompanha a cesta. Valores ETH usam representação decimal no contrato e inteiros na aritmética. A revisão inclui os itens e totais calculados. O pedido valida novamente a cotação e grava uma cópia dos valores e da carteira. Reenvios da mesma tentativa usam a mesma chave. A recusa preserva os itens e a confirmação registra a baixa de estoque.

## Tempo real e mocks

MSW intercepta REST. A integração com Socket.IO usa WebSocket e socket.io-client. Eventos nft.updated e order.updated carregam identidade do recurso e versão. A interface descarta versões já observadas e consulta os recursos ativos pela API ao receber uma atualização ou reconectar. A inscrição de pedido valida proprietário e sessão. Se o navegador encerrar a página durante um pedido pendente, a próxima consulta pode concluir o processamento pelo prazo persistido.

A simulação é local ao navegador. Origens e dispositivos diferentes começam com dados próprios. Ela usa a rede e as carteiras fictícias da interface.

## Auditoria e limites

O script usa o build otimizado, um navegador novo por medição, os perfis padrão mobile e desktop do Lighthouse e as categorias Performance, Accessibility, Best Practices e SEO. São três execuções por perfil em / e /nft/1. O JSON inclui a versão do navegador, o perfil efetivo e o ambiente. O resumo registra a mediana das categorias e de LCP, CLS e TBT.

As referências fornecidas orientaram a paleta, a tipografia monoespaçada,
a grade, os formulários e os resumos da compra. Quatro retratos foram recortados
das imagens fornecidas e convertidos em WebP. O catálogo associa esses retratos
às fixtures existentes e conserva seus nomes, valores, estoque e edições.
A galeria permite ampliar a obra. As telas de autenticação usam rotas
dedicadas e o recibo apresenta uma transação simulada.

## Referências técnicas

- [Componente Dialog do shadcn/ui](https://ui.shadcn.com/docs/components/dialog)
- [Lighthouse executado como módulo Node](https://github.com/GoogleChrome/lighthouse/blob/main/docs/readme.md#using-programmatically)
- [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite)

## Política de cache e sincronização

As consultas públicas usam chaves formadas pelo recurso e pelos parâmetros da URL. Consultas privadas incluem o identificador da conta para impedir compartilhamento entre usuários. Mutations atualizam ou invalidam apenas os recursos relacionados.

O catálogo envia busca, coleção, ordenação e página à API. Alterações de filtro reiniciam a página. O sinal de cancelamento do TanStack Query é encaminhado ao Axios, permitindo descartar respostas obsoletas.

Após login ou logout, a aplicação é recarregada para reconstruir cache, sessão e subscriptions. Alterações de favoritos usam atualização otimista e restauração do valor anterior em caso de falha. Carrinho, checkout e pedidos usam a resposta da API como fonte dos valores finais.

Eventos Socket.IO não substituem a API REST. Ao receber `nft.updated` ou `order.updated`, o cliente verifica identidade e versão e reconcilia os recursos ativos por nova consulta. Reconexões também provocam reconciliação. Listeners são removidos no cleanup dos efeitos.

## Rotas e autorização

TanStack Router controla as rotas públicas e privadas. Checkout, perfil, carteiras, favoritos e pedidos exigem sessão válida. Quando uma sessão expira, a localização atual é preservada para retomada depois do login.

Rotas de detalhe e pedido aceitam acesso direto. Recursos inexistentes apresentam estado de erro coerente. A configuração da Vercel redireciona rotas da SPA para `index.html`, preservando refresh e acesso por URL.

## Responsividade, UX e acessibilidade

A interface utiliza os mesmos componentes e dados em desktop e mobile. Media queries reorganizam cabeçalho, catálogo, galerias, carrinho, checkout e autenticação sem duplicar regras de negócio.

Os frames mobile disponíveis foram aplicados a início, detalhe, carrinho, pagamento, login e cadastro. Perfil, carteiras e recibo receberam comportamento responsivo derivado da identidade visual.

Decisões de acessibilidade incluem semântica nativa, labels, mensagens associadas, regiões de status, foco visível, skip link e diálogo baseado em Radix. Controles relevantes conservam nomes acessíveis mesmo quando o texto visual é adaptado ao frame móvel.

Os componentes dependentes de dados preservam espaço por meio de skeletons. Animações e transições devem respeitar `prefers-reduced-motion`.

## Assets e desvios do Figma

As artes originais disponíveis foram consolidadas em `public/art/`, com alternativas WebP para reduzir transferência. Ícones sem asset exportável foram recriados com SVG local ou símbolos textuais acessíveis. A fonte do design foi substituída por uma pilha monoespaçada de sistema para manter execução offline e reproduzível.

O campo “Confirmar senha” exibido no frame mobile de cadastro não faz parte do contrato atual de contas e não foi adicionado apenas como elemento visual. O cadastro valida nome, e-mail, senha mínima e conflitos retornados pela API.

Autenticação social, newsletter, links editoriais e redes sociais são ações auxiliares sem integração externa. Elas não apresentam confirmação falsa. Blockchain, carteiras reais e pagamentos reais permanecem fora do escopo.

## Limitações do ambiente simulado

O MSW mantém o estado da demonstração no navegador. A simulação Socket.IO usa o transporte compatível disponibilizado pelo projeto e não representa uma rede blockchain. Dados não são compartilhados entre origens ou dispositivos.

Os relatórios visuais versionados foram gerados em Linux. Diferenças de renderização de fonte e navegador podem exigir snapshots específicos para Windows depois de inspeção manual. A publicação, a rodada final do Playwright e as medianas finais do Lighthouse permanecem pendentes até autorização.