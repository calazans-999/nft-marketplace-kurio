import type { AxiosInstance } from "axios";

type BasicPageKind =
  | "activity"
  | "watchlist"
  | "offers"
  | "downloads";

const pages: Record<
  BasicPageKind,
  {
    title: string;
    description: string;
    emptyTitle: string;
    emptyText: string;
    icon: string;
  }
> = {
  activity: {
    title: "Atividade",
    description: "Acompanhe suas compras e movimentações recentes.",
    emptyTitle: "Nenhuma atividade recente",
    emptyText:
      "As compras e movimentações realizadas na Kurio aparecerão aqui.",
    icon: "♢",
  },
  watchlist: {
    title: "Lista de interesse",
    description: "Consulte as obras que você deseja acompanhar.",
    emptyTitle: "Sua lista está vazia",
    emptyText:
      "Adicione obras à sua lista de interesse para encontrá-las rapidamente.",
    icon: "♡",
  },
  offers: {
    title: "Ofertas",
    description: "Acompanhe ofertas recebidas e enviadas.",
    emptyTitle: "Nenhuma oferta disponível",
    emptyText:
      "Quando uma oferta for criada ou recebida, ela aparecerá nesta página.",
    icon: "◉",
  },
  downloads: {
    title: "Arquivos baixados",
    description: "Encontre os arquivos digitais disponíveis para download.",
    emptyTitle: "Nenhum arquivo baixado",
    emptyText:
      "Os arquivos associados às suas obras adquiridas aparecerão aqui.",
    icon: "⇩",
  },
};

function AccountSidebar({
  api,
  active,
}: {
  api: AxiosInstance;
  active: BasicPageKind;
}) {
  const logout = async () => {
    await api.delete("/session");
    sessionStorage.removeItem("forma:token");
    sessionStorage.removeItem("forma:return");
    location.replace("/");
  };

  return (
    <aside className="profile-sidebar" aria-label="Menu do perfil">
      <h1>Meu perfil</h1>

      <a href="/perfil">
        ♙ <span>Dados do perfil</span>
      </a>

      <a href="/carteiras">
        ⌾ <span>Carteiras</span>
      </a>

      <a
        className={active === "activity" ? "active" : undefined}
        href="/atividade"
      >
        ♢ <span>Atividade</span>
      </a>

      <a
        className={active === "watchlist" ? "active" : undefined}
        href="/lista-de-interesse"
      >
        ♡ <span>Lista de interesse</span>
      </a>

      <a
        className={active === "offers" ? "active" : undefined}
        href="/ofertas"
      >
        ◉ <span>Ofertas</span>
      </a>

      <a
        className={active === "downloads" ? "active" : undefined}
        href="/downloads"
      >
        ⇩ <span>Arquivos baixados</span>
      </a>

      <a href="mailto:contato@kurio.test?subject=Suporte">
        △ <span>Suporte</span>
      </a>

      <button type="button" onClick={() => void logout()}>
        ⇥ <span>Sair</span>
      </button>
    </aside>
  );
}

export function AccountBasicPage({
  api,
  kind,
}: {
  api: AxiosInstance;
  kind: BasicPageKind;
}) {
  const page = pages[kind];

  return (
    <section className="account-basic-page">
      <a
        className="mobile-account-back"
        href="/perfil"
        aria-label="Voltar ao meu perfil"
      >
        ‹
      </a>

      <AccountSidebar api={api} active={kind} />

      <div className="account-basic-content">
        <header className="account-basic-heading">
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </header>

        <div className="account-empty-state">
          <span className="account-empty-icon" aria-hidden="true">
            {page.icon}
          </span>

          <h2>{page.emptyTitle}</h2>
          <p>{page.emptyText}</p>

          <div className="account-empty-actions">
            <a className="action" href="/">
              Explorar o mercado
            </a>

            {kind === "activity" && (
              <a className="account-secondary-action" href="/carrinho">
                Ver carrinho
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}