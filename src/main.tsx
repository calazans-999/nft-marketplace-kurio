import { artSrc } from "./art";
import { DemoPanel } from "./DemoPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./Dialog";
import { ProfilePage, type CollectorProfile } from "./ProfilePage";
import { WalletsPage } from "./WalletsPage";
import { AccountBasicPage } from "./AccountBasicPage";
import { CartCoupon } from "./CartCoupon";
import { FavoriteButton } from "./FavoriteButton";
import { MobileConfirmPassword } from "./MobileConfirmPassword";
import { Payment, Receipt } from "./payment";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  redirect,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import {
  initialSearch,
  type Nft,
  type NftDetail,
  type Cart,
  type Search,
} from "./model";
import "./style.css";
import "./mobile.css";

const api = axios.create({ baseURL: "/api", timeout: 8000 });
const queries = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
type User = { id: string; name: string; email: string };
let user: User | null = null;
const tokenKey = "forma:token";
const returnKey = "forma:return";
function rememberPage() {
  if (!["/login", "/cadastro"].includes(location.pathname))
    sessionStorage.setItem(returnKey, location.pathname + location.search);
}
function resume() {
  const dest = new URL(
    sessionStorage.getItem(returnKey) || "/",
    location.origin,
  );
  sessionStorage.removeItem(returnKey);
  location.replace(
    dest.origin === location.origin ? dest.pathname + dest.search : "/carrinho",
  );
}
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(tokenKey);
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      error.config?.url !== "/login" &&
      sessionStorage.getItem(tokenKey)
    ) {
      sessionStorage.removeItem(tokenKey);
      rememberPage();
      location.replace("/login");
    }
    return Promise.reject(error);
  },
);
function msg(error: unknown) {
  return axios.isAxiosError(error)
    ? error.response?.data?.message || "Falha de conexão. Tente novamente."
    : "Não foi possível concluir.";
}
function AccountForm({ register = false }: { register?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      if (register) {
        await api.post("/accounts", {
          name,
          email,
          password,
        });
      }

      const { data } = await api.post<{
        token: string;
        adjusted: boolean;
      }>("/login", {
        email,
        password,
      });

      sessionStorage.setItem(tokenKey, data.token);

      if (data.adjusted) {
        sessionStorage.setItem("forma:adjusted", "1");
      }

      resume();
    },
  });

  return (
    <section
      className={`auth-stage ${
        register ? "auth-register-stage" : "auth-login-stage"
      }`}
    >
      <iframe
        className="auth-marketplace-preview"
        src="/"
        title="Prévia do marketplace"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div
        className={`account auth-page auth-card ${
          register ? "auth-register-card" : "auth-login-card"
        }`}
      >
        <Link
          to="/"
          search={initialSearch}
          className="auth-close"
          aria-label="Fechar autenticação"
        >
          ×
        </Link>

        <p className="auth-brand">KURIO</p>

        <nav className="auth-tabs" aria-label="Autenticação">
          {register ? (
            <>
              <Link to="/login">Entrar</Link>
              <span aria-current="page">Criar conta</span>
            </>
          ) : (
            <>
              <span aria-current="page">Entrar</span>
              <Link to="/cadastro">Criar uma conta</Link>
            </>
          )}
        </nav>

        <div className="auth-intro">
          <h1>{register ? "Criar perfil de colecionador" : "Entrar"}</h1>
          <p>
            {register
              ? "Crie seu perfil de colecionador e conecte uma carteira quando quiser."
              : "Entre para gerenciar sua carteira, coleção e perfil de criador."}
          </p>
        </div>

        <form
          aria-label={register ? "Criar conta" : "Entrar"}
          onSubmit={(event) => {
            event.preventDefault();

            if (
              register &&
              confirmPassword.length > 0 &&
              password !== confirmPassword
            ) {
              setAuthNotice("As senhas informadas não são iguais.");
              return;
            }

            mutation.mutate();
          }}
        >
          {register && (
            <label>
              Nome
              <input
                required
                autoComplete="name"
                placeholder="Nome de usuário"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}

          <label className="auth-email-label">
            <span className="sr-only">E-mail</span>
            <input
              required
              type="email"
              autoComplete="email"
              aria-label="E-mail"
              placeholder="contato@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="auth-password-label">
            <span className="sr-only">Senha</span>
            <span className="auth-password-field">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={register ? 8 : 1}
                autoComplete={register ? "new-password" : "current-password"}
                aria-label="Senha"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                  <circle cx="12" cy="12" r="2.7" />
                  {!showPassword && <path d="m4 4 16 16" />}
                </svg>
              </button>
            </span>
          </label>

          {register && (
            <MobileConfirmPassword
              value={confirmPassword}
              visible={showConfirmPassword}
              onChange={(value) => {
                setConfirmPassword(value);
                setAuthNotice("");
              }}
              onToggle={() =>
                setShowConfirmPassword((visible) => !visible)
              }
            />
          )}

          {register ? (
            <p className="auth-hint">Use pelo menos 8 caracteres.</p>
          ) : (
            <button
              type="button"
              className="forgot-password"
              onClick={() =>
                setAuthNotice(
                  email.trim()
                    ? `Instruções demonstrativas enviadas para ${email.trim()}.`
                    : "Informe seu e-mail para solicitar a recuperação.",
                )
              }
            >
              Esqueceu a senha?
            </button>
          )}

          {mutation.isError && (
            <p role="alert" className="auth-error">
              {msg(mutation.error)}
            </p>
          )}

          <button className="action auth-submit" disabled={mutation.isPending}>
            {register ? "Criar perfil" : "Entrar"}
          </button>
        </form>

        <div className="auth-divider">
          <span>Ou continue com</span>
        </div>

        <div className="auth-social" aria-label="Outras opções de acesso">
          <button
            type="button"
            onClick={() =>
              setAuthNotice(
                "O acesso com Google é demonstrativo. Use e-mail e senha para entrar.",
              )
            }
          >
            <span aria-hidden="true">G</span>
            Google
          </button>
          <button
            type="button"
            onClick={() =>
              setAuthNotice(
                "O acesso com Facebook é demonstrativo. Use e-mail e senha para entrar.",
              )
            }
          >
            <span className="auth-facebook-mark" aria-hidden="true">f</span>
            Facebook
          </button>
        </div>

        <p className="auth-provider-notice" role="status">
          {authNotice}
        </p>

        <p className="auth-switch">
          {register ? "Já possui uma conta?" : "Ainda não possui uma conta?"}{" "}
          <Link to={register ? "/login" : "/cadastro"}>
            {register ? "Já tenho conta" : "Criar uma conta"}
          </Link>
        </p>
      </div>
    </section>
  );
}
function normalizeCart(data: Cart | null | undefined): Cart {
  return {
    ...data,
    lines: Array.isArray(data?.lines) ? data.lines : [],
  } as Cart;
}

function useCart() {
  return useQuery({
    queryKey: ["cart", user?.id ?? "guest"],
    queryFn: async ({ signal }) => {
      const response = await api.get<Cart>("/cart", { signal });
      return normalizeCart(response.data);
    },
  });
}
function useChange() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      quantity: number;
      mode?: string;
    }) => {
      try {
        const response = await api.put<Cart>("/cart/" + input.id, input);
        return normalizeCart(response.data);
      } catch (error) {
        /*
         * Um 409 pode significar que o item já foi incluído no carrinho,
         * mas o cache local ainda não recebeu a versão atualizada.
         */
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          const response = await api.get<Cart>("/cart");
          const synchronizedCart = normalizeCart(response.data);

          const itemAlreadyInCart = synchronizedCart.lines.some(
            ({ nft }) => nft.id === input.id,
          );

          if (itemAlreadyInCart) {
            return synchronizedCart;
          }
        }

        throw error;
      }
    },

    onSuccess: (data) => {
      client.setQueryData(
        ["cart", user?.id ?? "guest"],
        normalizeCart(data),
      );
    },
  });
}
function Problem({ retry }: { retry: () => void }) {
  return (
    <div role="alert">
      Falha ao carregar. <button type="button" onClick={retry}>Tentar novamente</button>
    </div>
  );
}
function Loading() {
  return (
    <div className="skeleton" role="status" aria-label="Carregando conteúdo" />
  );
}
const journalPosts = [
  {
    image: "3",
    meta: "12 de setembro | Leitura de 6 min",
    title: "Como funciona a propriedade de NFTs",
    description: "Aprenda a colecionar, negociar e verificar ativos digitais.",
  },
  {
    image: "1",
    meta: "13 de setembro | Leitura de 2 min",
    title: "10 artistas digitais para acompanhar",
    description: "Conheça criadores que moldam a cultura digital.",
  },
  {
    image: "2",
    meta: "15 de setembro | Leitura de 3 min",
    title: "Raridade, atributos e procedência",
    description:
      "Entenda raridade, procedência, direitos autorais e utilidade.",
  },
  {
    image: "7",
    meta: "15 de setembro | Leitura de 2 min",
    title: "Como proteger sua carteira",
    description: "Proteja sua carteira, seus ativos e sua identidade.",
  },
];
function SiteFooter() {
  const [newsletter, setNewsletter] = useState("");
  const [newsletterNotice, setNewsletterNotice] = useState("");

  return (
    <footer className="site-footer">
      <section className="footer-benefits" aria-label="Benefícios da Kurio">
        <article>
          <span className="benefit-mark" aria-hidden="true">
            W
          </span>
          <h2>Segurança da carteira</h2>
          <p>
            Proteja sua carteira e colecione arte digital verificada com
            confiança.
          </p>
        </article>

        <article>
          <span className="benefit-mark" aria-hidden="true">
            C
          </span>
          <h2>Criadores em destaque</h2>
          <p>
            Conheça artistas, estúdios e comunidades que moldam a cultura
            digital.
          </p>
        </article>

        <article>
          <span className="benefit-mark" aria-hidden="true">
            D
          </span>
          <h2>Alertas de lançamentos</h2>
          <p>
            Receba calendários de cunhagem, novidades e análises do mercado.
          </p>
        </article>

        <form
          className="newsletter"
          onSubmit={(event) => {
            event.preventDefault();
            setNewsletterNotice("Cadastro demonstrativo concluído.");
            setNewsletter("");
          }}
        >
          <h2>Antecipe-se ao próximo lançamento</h2>
          <div>
            <label className="sr-only" htmlFor="newsletter-email">
              Seu e-mail
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              placeholder="digite seu e-mail..."
              value={newsletter}
              onChange={(event) => setNewsletter(event.target.value)}
            />
            <button type="submit">Enviar</button>
          </div>
          <p role="status">{newsletterNotice}</p>
        </form>
      </section>

      <section className="footer-brand-band">
        <div>
          <strong>KURIO</strong>
          <p>Propriedade digital para todos.</p>
        </div>
        <address>
          <a href="mailto:contato@kurio.test">contato@kurio.test</a>
          <span>+55 11 4002 8922</span>
        </address>
      </section>

      <section className="footer-links">
        <div>
          <h2>Meu perfil</h2>
          <Link to="/perfil">Minha coleção</Link>
          <Link to="/carteiras">Carteiras</Link>
          <Link to="/carrinho">Watchlist</Link>
        </div>

        <div>
          <h2>Central de ajuda</h2>
          <a href="/#catalogo">Como comprar NFTs</a>
          <Link to="/carteiras">Carteira e segurança</Link>
          <a href="mailto:contato@kurio.test?subject=Política%20do%20marketplace">
            Política do marketplace
          </a>
        </div>

        <div>
          <h2>Coleções</h2>
          <a href="/#catalogo">Arte digital</a>
          <a href="/#catalogo">Fotografia</a>
          <a href="/#catalogo">Música</a>
          <a href="/#catalogo">Arte 3D</a>
        </div>

        <div className="footer-social">
          <h2>Redes sociais</h2>
          <div aria-label="Redes sociais">
            <a
              href="https://www.facebook.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir Facebook"
            >
              f
            </a>
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir Instagram"
            >
              ◎
            </a>
            <a
              href="https://x.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir X"
            >
              𝕏
            </a>
            <a
              href="https://www.linkedin.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir LinkedIn"
            >
              in
            </a>
          </div>

          <h2>Carteiras compatíveis</h2>
          <span className="wallet-chip">
            METAMASK · COINBASE · WALLETCONNECT
          </span>
        </div>
      </section>

      <p className="copyright">© 2026 Kurio. Propriedade digital para todos.</p>

      {import.meta.env.VITE_MOCKS !== "false" && <DemoPanel api={api} />}
    </footer>
  );
}
function Layout() {
  const cart = useCart();
  const [notice, setNotice] = useState(
    sessionStorage.getItem("forma:adjusted")
      ? "Quantidade ajustada ao estoque ao unir os carrinhos."
      : "",
  );
  useEffect(() => {
    sessionStorage.removeItem("forma:adjusted");
  }, []);
  const logout = useMutation({
    mutationFn: async () => {
      await api.delete("/session");
      sessionStorage.removeItem(tokenKey);
      sessionStorage.removeItem(returnKey);
      location.replace("/");
    },
  });
  useEffect(() => {
    const socket = io({ transports: ["websocket"] });
    const versions = new Map<string, number>();
    const refresh = () => {
      for (const key of ["nft", "nfts", "cart", "checkout"])
        void queries.invalidateQueries({ queryKey: [key] });
    };
    socket.on("connect", refresh);
    socket.on(
      "nft.updated",
      (event: { resourceId: string; version: number }) => {
        if (event.version <= (versions.get(event.resourceId) ?? 0)) return;
        versions.set(event.resourceId, event.version);
        refresh();
        setNotice(
          "Preço atualizado. Confira os valores da coleção e do carrinho.",
        );
      },
    );
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);
  const count = (cart.data?.lines ?? []).reduce((s, l) => s + l.quantity, 0);
  return (
    <>
      <a className="skip" href="#content">
        Pular para o conteúdo
      </a>
      <header className="site-header">
        <Link
          to="/"
          search={initialSearch}
          className="brand"
          aria-label="Kurio — página inicial"
        >
          KURIO
        </Link>

        <nav className="header-navigation" aria-label="Navegação principal">
          <div className="primary-nav">
            <Link className="nav-home" to="/" search={initialSearch}>
              Início
            </Link>

            <Link
              className="nav-market"
              aria-label="Explorar"
              to="/"
              search={initialSearch}
              onClick={() => {
                window.setTimeout(() => {
                  document
                    .querySelector("#catalogo")
                    ?.scrollIntoView({ behavior: "smooth" });
                }, 0);
              }}
            >
              Mercado
            </Link>

            <a className="desktop-nav" href="/#diario">
              Criadores
            </a>

            <a className="desktop-nav" href="/#diario">
              Aprenda
            </a>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="header-icon header-search"
              aria-label="Buscar no marketplace"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("kurio:open-catalog-filters"),
                );
                document
                  .querySelector("#catalogo")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="18"
                height="18"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
            </button>

            <Link
              className={`header-icon nav-cart${location.pathname === "/" ? " home-cart" : ""}`}
              to="/carrinho"
              aria-label={`Carrinho${count !== undefined ? ` · ${count}` : ""}`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="19"
                height="19"
              >
                <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6" />
                <circle cx="10" cy="20" r="1" />
                <circle cx="18" cy="20" r="1" />
              </svg>

              {count !== undefined && count > 0 && (
                <span className="cart-count">{count}</span>
              )}
            </Link>

            {user ? (
              <div className="authenticated-actions">
                <Link to="/carteiras">Carteiras</Link>
                <ProfileLink account={user} />
                <button
                  type="button"
                  disabled={logout.isPending}
                  onClick={() => logout.mutate()}
                >
                  Sair
                </button>
              </div>
            ) : (
              <Link className="nav-signin" to="/login" onClick={rememberPage}>
                Entrar
              </Link>
            )}
          </div>
        </nav>
      </header>
      <main id="content" tabIndex={-1}>
        <p role="status">{notice}</p>
        {logout.isError && <p role="alert">{msg(logout.error)}</p>}
        <Outlet />
        {(
          location.pathname === "/" ||
          location.pathname.startsWith("/nft/") ||
          location.pathname === "/carrinho" ||
          location.pathname === "/pagamento"
        ) && <SiteFooter />}
      </main>
    </>
  );
}
function Catalog() {
  const search = home.useSearch();
  const navigate = home.useNavigate();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const [catalogView, setCatalogView] = useState<
    "all" | "new" | "trending"
  >("all");
  const [catalogNotice, setCatalogNotice] = useState("");
  const isMobile = window.matchMedia("(max-width: 600px)").matches;

  useEffect(() => {
    const openFilters = () => {
      setDesktopFiltersOpen(true);
      window.setTimeout(() => {
        document
          .querySelector<HTMLInputElement>("#catalog-search")
          ?.focus();
      }, 0);
    };

    window.addEventListener("kurio:open-catalog-filters", openFilters);

    return () => {
      window.removeEventListener("kurio:open-catalog-filters", openFilters);
    };
  }, []);
  const change = (next: Partial<Search>) =>
    void navigate({ search: { ...search, page: 1, ...next } });
  const result = useQuery({
    queryKey: ["nfts", search],
    queryFn: async ({ signal }) => {
      const response = await api.get<{
        items?: Nft[];
        total?: number;
      }>("/nfts", {
        params: { ...search, limit: isMobile ? 4 : 8 },
        signal,
      });

      return {
        items: Array.isArray(response.data?.items)
          ? response.data.items
          : [],
        total: Number.isFinite(response.data?.total)
          ? Number(response.data.total)
          : 0,
      };
    },
  });
  return (
    <>
      {desktopFiltersOpen && (
        <div
          className="desktop-catalog-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="desktop-catalog-dialog-title"
        >
          <div className="desktop-catalog-dialog-card">
            <div className="desktop-catalog-dialog-heading">
              <h2 id="desktop-catalog-dialog-title">Buscar no marketplace</h2>
              <button
                type="button"
                aria-label="Fechar busca"
                onClick={() => setDesktopFiltersOpen(false)}
              >
                ×
              </button>
            </div>

            <label htmlFor="catalog-search">
              Buscar obra
              <input
                id="catalog-search"
                aria-label="Buscar obra"
                type="search"
                value={search.q}
                onChange={(event) => change({ q: event.target.value })}
              />
            </label>

            <label htmlFor="desktop-catalog-collection">
              Coleção
              <select
                id="desktop-catalog-collection"
                aria-label="Coleção"
                value={search.series}
                onChange={(event) => change({ series: event.target.value })}
              >
                <option value="">Todas</option>
                <option>Kurio Apes</option>
                <option>Nomads</option>
              </select>
            </label>

            <button
              type="button"
              className="action"
              onClick={() => setDesktopFiltersOpen(false)}
            >
              Ver resultados
            </button>
          </div>
        </div>
      )}

      <div className="mobile-home-search">
        <label htmlFor="catalog-search-mobile">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>

          <input
            id="catalog-search-mobile"
            aria-label="Busca rápida"
            type="search"
            value={search.q}
            placeholder="Explorar coleções"
            onChange={(e) => change({ q: e.target.value })}
          />
        </label>

        <button
          type="button"
          className="mobile-filter-button"
          aria-label="Abrir filtros"
          aria-expanded={mobileFiltersOpen}
          onClick={() => setMobileFiltersOpen((open) => !open)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 7h10" />
            <path d="M18 7h2" />
            <circle cx="16" cy="7" r="2" />
            <path d="M4 17h2" />
            <path d="M10 17h10" />
            <circle cx="8" cy="17" r="2" />
          </svg>
        </button>
      </div>

      <div className="mobile-quick-filters">
        <label>
          Coleção
          <select
            aria-label={isMobile ? "Coleção" : "Filtro móvel de coleção"}
            value={search.series}
            onChange={(e) => change({ series: e.target.value })}
          >
            <option value="">Todas</option>
            <option>Kurio Apes</option>
              <option>Nomads</option>
          </select>
        </label>

        <label>
          Ordenar por
          <select
            aria-label={isMobile ? "Ordenar por" : "Classificação móvel"}
            value={search.sort}
            onChange={(e) => change({ sort: e.target.value })}
          >
            <option value="featured">Recentes</option>
            <option value="price">Menor preço</option>
          </select>
        </label>
      </div>

      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">Bem-vindo à Kurio</p>
          <h1>Seja dono do futuro da arte digital.</h1>
          <p className="hero-description">
            Descubra NFTs selecionados de criadores emergentes e consagrados.
            Colecione arte digital rara, apoie artistas e tenha uma parte da
            cultura da internet.
          </p>
          <a href="#catalogo" className="action">
            Explorar
          </a>
          <div className="hero-dots" aria-label="Slide 1 de 3">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="hero-art">
          <img
            src={artSrc("1")}
            alt="Colecionável ilustrado com óculos e jaqueta verde"
            width={450}
            height={450}
            fetchPriority="high"
          />
        </div>
      </section>
      <section id="catalogo">
        <div className="section-heading">
          <p>CURADORIA KURIO</p>
          <h2>Explore o marketplace</h2>
        </div>

        <div className="columns">
          <aside
            className={`market-sidebar${mobileFiltersOpen ? " mobile-open" : ""}`}
            inert={isMobile && !mobileFiltersOpen}
          >
            <div className="mobile-filter-heading">
              <h3>Filtros</h3>
              <button
                type="button"
                aria-label="Fechar filtros"
                onClick={() => setMobileFiltersOpen(false)}
              >
                ×
              </button>
            </div>

            <h3>Coleções</h3>

            <ul className="desktop-collection-list">
              <li className="active">
                <span>Arte digital</span>
                <strong>(33)</strong>
              </li>
              <li>
                <span>Fotografia</span>
                <strong>(12)</strong>
              </li>
              <li>
                <span>Música</span>
                <strong>(65)</strong>
              </li>
              <li>
                <span>Arte 3D</span>
                <strong>(39)</strong>
              </li>
              <li>
                <span>Colecionáveis</span>
                <strong>(23)</strong>
              </li>
              <li>
                <span>Generativa</span>
                <strong>(17)</strong>
              </li>
              <li>
                <span>Jogos</span>
                <strong>(19)</strong>
              </li>
              <li>
                <span>Assinaturas</span>
                <strong>(13)</strong>
              </li>
              <li>
                <span>Utilidade</span>
                <strong>(18)</strong>
              </li>
            </ul>

            <div className="mobile-sidebar-controls">
              <label>
                Buscar obra
                <input
                  id="catalog-search-advanced"
                  aria-label={
                    isMobile && !mobileFiltersOpen
                      ? "Pesquisa avançada"
                      : "Buscar obra"
                  }
                  type="search"
                  value={search.q}
                  onChange={(event) => change({ q: event.target.value })}
                />
              </label>

              <label htmlFor="catalogo-colecao">Coleção</label>
              <select
                id="catalogo-colecao"
                aria-label={
                  isMobile && !mobileFiltersOpen
                    ? "Filtro avançado de coleção"
                    : "Coleção"
                }
                value={search.series}
                onChange={(event) => change({ series: event.target.value })}
              >
                <option value="">Todas</option>
                <option>Kurio Apes</option>
                <option>Nomads</option>
              </select>
            </div>

            <div className="filter-block">
              <h3>Faixa de preço</h3>
              <input
                aria-label="Preço máximo"
                type="range"
                min="0"
                max="13"
                defaultValue="12"
              />
              <p>Preço: 0,02 – 12,30 ETH</p>
              <button
                type="button"
                onClick={() =>
                  setCatalogNotice("Faixa de preço aplicada ao catálogo.")
                }
              >
                Aplicar
              </button>
            </div>

            <div className="filter-block network-filter">
              <h3>Rede</h3>
              <label>
                <input type="checkbox" defaultChecked />
                Ethereum <span>(119)</span>
              </label>
              <label>
                <input type="checkbox" />
                Polygon <span>(78)</span>
              </label>
              <label>
                <input type="checkbox" />
                Solana <span>(86)</span>
              </label>
            </div>

            <div className="featured-nft">
              <p>NFT EM DESTAQUE</p>
              <strong>OFERTA LIMITADA</strong>
              <img
                src={artSrc("4")}
                alt="NFT em destaque"
                width={310}
                height={368}
              />
            </div>
          </aside>

          <div className="catalog-results">
            <div className="catalog-toolbar">
              <div role="tablist" aria-label="Catálogo">
                <button
                  type="button"
                  role="tab"
                  aria-selected={catalogView === "all"}
                  onClick={() => {
                    setCatalogView("all");
                    change({ sort: "featured" });
                    setCatalogNotice("Exibindo todos os NFTs.");
                  }}
                >
                  Todos os NFTs
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={catalogView === "new"}
                  onClick={() => {
                    setCatalogView("new");
                    change({ sort: "featured" });
                    setCatalogNotice("Exibindo os lançamentos mais recentes.");
                  }}
                >
                  Novos lançamentos
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={catalogView === "trending"}
                  onClick={() => {
                    setCatalogView("trending");
                    change({ sort: "price" });
                    setCatalogNotice("Exibindo obras em alta por preço.");
                  }}
                >
                  Em alta
                </button>
              </div>

              <label>
                Ordenar por
                <select
                  aria-label={isMobile ? "Classificação do catálogo" : "Ordenar por"}
                  value={search.sort}
                  onChange={(e) => change({ sort: e.target.value })}
                >
                  <option value="featured">Listados recentemente</option>
                  <option value="price">Menor preço</option>
                </select>
              </label>
            </div>

            <p className="sr-only" role="status">
              {catalogNotice}
            </p>

            {result.isPending ? (
              <Loading />
            ) : result.isError ? (
              <Problem retry={result.refetch} />
            ) : (
              <>
                                <div
                  className={`grid gap-4 cards${
                    !isMobile &&
                    search.page === 1 &&
                    !search.q &&
                    !search.series
                      ? " figma-showcase"
                      : ""
                  }`}
                >
                  {(result.data?.items ?? []).map((n) => (
                    <Link
                      className="card"
                      key={n.id}
                      to="/nft/$id"
                      params={{ id: n.id }}
                    >
                      <img src={artSrc(n.id)} alt="" width={355} height={355} />
                      <div>
                        <h3>{n.title}</h3>
                        <small>
                          {n.series} · {n.artist}
                        </small>
                        <strong>{n.price} ETH</strong>
                      </div>
                    </Link>
                  ))}

                  {!isMobile &&
                    search.page === 1 &&
                    !search.q &&
                    !search.series && (
                      <div className="catalog-decoration" aria-hidden="true">
                        <img src={artSrc("7")} alt="" />
                      </div>
                    )}
                </div>

                {!(result.data?.items ?? []).length && <p>Nenhuma obra encontrada.</p>}

                <div className="pager desktop-numbered-pager" aria-label="Paginação">
                  {[1, 2, 3, 4].map((pageNumber) => (
                    <button
                      type="button"
                      key={pageNumber}
                      className={pageNumber === 1 ? "active" : ""}
                      disabled={pageNumber !== 1}
                      aria-current={pageNumber === 1 ? "page" : undefined}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  <button type="button" disabled aria-label="Próxima página">
                    ›
                  </button>
                </div>

                <div className="pager mobile-catalog-pager">
                  <button
                    disabled={search.page === 1}
                    onClick={() => change({ page: search.page - 1 })}
                  >
                    Anterior
                  </button>
                  <span>Página {search.page}</span>
                  <button
                    disabled={search.page * 4 >= result.data.total}
                    onClick={() => change({ page: search.page + 1 })}
                  >
                    Próxima
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
      <section className="promos" aria-label="Destaques do marketplace">
        <article>
          <img src={artSrc("1")} alt="Genesis drop" />
          <div>
            <h2>
              Lançamentos gênesis
              <br />
              de edição limitada
            </h2>
            <p>
              Colecione edições escassas diretamente dos criadores antes da
              revelação pública.
            </p>
            <a className="action" href="#catalogo">
              Explorar →
            </a>
          </div>
        </article>

        <article>
          <img src={artSrc("3")} alt="Arte digital selecionada" />
          <div>
            <h2>
              Arte digital selecionada
              <br />
              e muito mais
            </h2>
            <p>
              Explore novos artistas, coleções verificadas e obras que definem a
              cultura.
            </p>
            <a className="action" href="#catalogo">
              Explorar →
            </a>
          </div>
        </article>
      </section>
      <section className="journal" id="diario">
        <div className="journal-heading">
          <h2>Diário da Cunhagem</h2>
          <p>
            Histórias, guias e insights para colecionadores sobre o universo da
            propriedade digital.
          </p>
        </div>

        <div className="journal-grid">
          {journalPosts.map((post) => (
            <article key={post.title}>
              <img src={artSrc(post.image)} alt="" />
              <div>
                <small>{post.meta}</small>
                <h3>{post.title}</h3>
                <p>{post.description}</p>
                <a
                  href={`mailto:contato@kurio.test?subject=${encodeURIComponent(
                    post.title,
                  )}`}
                  aria-label={`Solicitar artigo: ${post.title}`}
                >
                  Ler mais →
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
      <nav className="mobile-tab-bar" aria-label="Navegação móvel">
        <Link
          to="/"
          search={initialSearch}
          className="mobile-tab-active"
          aria-label="Início"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4z" />
          </svg>
        </Link>

        <Link
          to={user ? "/lista-de-interesse" : "/login"}
          aria-label={user ? "Lista de interesse" : "Entrar para ver favoritos"}
          onClick={() => {
            if (!user) rememberPage();
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M20.8 5.8a5.4 5.4 0 0 0-7.6 0L12 7l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 22l8.8-8.6a5.4 5.4 0 0 0 0-7.6z" />
          </svg>
        </Link>

        <Link className="mobile-tab-main" to="/carrinho" aria-label="Carrinho">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M3 4h2l2 10h10l3-7H6" />
            <circle cx="9" cy="19" r="1.3" />
            <circle cx="18" cy="19" r="1.3" />
          </svg>
        </Link>

        <a href="#catalogo" aria-label="Marketplace">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 9h16v11H4z" />
            <path d="M3 9 5 4h14l2 5" />
            <path d="M9 20v-6h6v6" />
          </svg>
        </a>

        <Link
          to={user ? "/perfil" : "/login"}
          aria-label={user ? "Meu perfil" : "Entrar"}
          onClick={() => {
            if (!user) rememberPage();
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1-5 4-7 8-7s7 2 8 7" />
          </svg>
        </Link>
      </nav>
    </>
  );
}
function Detail() {
  const { id } = detail.useParams();
  const nft = useQuery({
    queryKey: ["nft", id],
    queryFn: async ({ signal }) =>
      (await api.get<NftDetail>("/nfts/" + id, { signal })).data,
  });
  if (nft.isPending)
    return (
      <div className="detail-loading">
        <Loading />
      </div>
    );
  if (nft.isError)
    return axios.isAxiosError(nft.error) &&
      nft.error.response?.status === 404 ? (
      <h1>Obra não encontrada</h1>
    ) : (
      <Problem retry={nft.refetch} />
    );
  return <Artwork key={id} nft={nft.data} />;
}
function Artwork({ nft }: { nft: NftDetail }) {
  const [editionId, setEditionId] = useState(nft.id);
  const [editionOption, setEditionOption] = useState("1/50");
  const edition = nft.editions.find((item) => item.id === editionId) ?? nft;
  const [quantity, setQuantity] = useState(1);
  const update = useChange();

  const editionOptions = [
    { label: "1/1", edition: nft.editions[0] ?? nft },
    { label: "1/10", edition: nft.editions[0] ?? nft },
    { label: "1/50", edition: nft.editions[1] ?? nft.editions[0] ?? nft },
    { label: "ABERTA", edition: nft.editions[1] ?? nft.editions[0] ?? nft },
  ];

  const relatedItems = [
    { id: "4", title: "Cosmic Bloom #118", price: "1.29" },
    { id: "5", title: "Violet Nomad #314", price: "1.39" },
    { id: "6", title: "Ivory Baron #088", price: "1.79" },
    { id: "7", title: "Golden Beat #207", price: "0.99" },
    { id: "8", title: "Golden Signal #160", price: "0.39" },
  ];

  return (
    <section className="detail">
      <div className="breadcrumbs">
        <Link to="/" search={initialSearch}>Início</Link>
        <span aria-hidden="true"> / </span>
        <Link to="/" search={initialSearch}>Mercado</Link>
      </div>

      <div className="detail-product">
        <Link
          className="mobile-detail-back"
          to="/"
          search={initialSearch}
          aria-label="Voltar ao mercado"
        >
          ‹
        </Link>

        <div className="product-gallery">
          <div className="detail-thumbnails" aria-label="Imagens da obra">
            {[1, 2, 3, 4].map((item) => (
              <button
                type="button"
                key={item}
                className={item === 1 ? "active" : ""}
                aria-label={`Visualizar imagem ${item}`}
                aria-pressed={item === 1}
              >
                <img src={artSrc(nft.id)} alt="" width={100} height={100} />
              </button>
            ))}
          </div>

          <div className="art-preview">
            <img src={artSrc(nft.id)} alt={nft.title} width={404} height={404} />
            <div className="expand-art">
              <Dialog>
                <DialogTrigger>Ampliar obra</DialogTrigger>
                <DialogContent>
                  <DialogTitle>{nft.title}</DialogTitle>
                  <DialogDescription>
                    Visualização da obra em tamanho maior.
                  </DialogDescription>
                  <img src={artSrc(nft.id)} alt={nft.title} width={620} height={620} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="detail-info">
          <h1>{nft.title}</h1>
          <div className="detail-price-row">
            <h2 className="nft-price">{edition.price} ETH</h2>
            <p className="detail-rating" aria-label="Avaliação 4 de 5">
              <span aria-hidden="true">★★★★☆</span>
              19 avaliações de colecionadores
            </p>
          </div>
          <div className="detail-rule" />

          <div className="detail-description">
            <h2>Sobre este NFT:</h2>
            <p>
              Um colecionável digital finalizado à mão da coleção Kurio Editions,
              verificado na Ethereum, com arte desbloqueável e acesso para
              colecionadores.
            </p>
          </div>

          <form
            className="purchase-actions"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate(
                { id: edition.id, quantity, mode: "add" },
                {
                  onSuccess: () => {
                    location.href = "/carrinho";
                  },
                },
              );
            }}
          >
            <div className="mobile-detail-fields">
              <label htmlFor="mobile-detail-edition">
                Edição
                <select
                  id="mobile-detail-edition"
                  aria-label="Edição mobile"
                  value={editionId}
                  onChange={(event) => {
                    setEditionId(event.target.value);
                    setQuantity(1);
                    update.reset();
                  }}
                >
                  {nft.editions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.edition ?? "Original"}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="mobile-detail-quantity">
                Quantidade
                <input
                  id="mobile-detail-quantity"
                  type="number"
                  min="1"
                  max={edition.stock}
                  disabled={!edition.stock}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      Math.max(
                        1,
                        Math.min(edition.stock, Number(event.target.value)),
                      ),
                    )
                  }
                />
              </label>
            </div>

            <fieldset className="edition-options">
              <legend>Edição:</legend>
              <div>
                {editionOptions.map((option) => (
                  <button
                    type="button"
                    key={option.label}
                    className={editionOption === option.label ? "active" : ""}
                    aria-pressed={editionOption === option.label}
                    onClick={() => {
                      setEditionOption(option.label);
                      setEditionId(option.edition.id);
                      setQuantity(1);
                      update.reset();
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="detail-purchase-row">
              <div className="quantity-stepper" aria-label="Quantidade">
                <button
                  type="button"
                  aria-label="Diminuir quantidade"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                >
                  −
                </button>
                <output aria-label="Quantidade selecionada">{quantity}</output>
                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  disabled={!edition.stock || quantity >= edition.stock}
                  onClick={() =>
                    setQuantity((current) => Math.min(edition.stock, current + 1))
                  }
                >
                  +
                </button>
              </div>

              <button
                className="action detail-buy-button"
                aria-label="Adicionar ao carrinho"
                disabled={update.isPending || !edition.stock}
              >
                <span className="desktop-buy-label">COMPRAR</span>
                <span className="mobile-buy-label">COMPRAR NFT</span>
              </button>

              <div className="detail-favorite">
                {user ? (
                  <FavoriteButton
                    key={nft.id}
                    api={api}
                    owner={user.id}
                    nftId={nft.id}
                  />
                ) : (
                  <Link
                    to="/login"
                    aria-label="Entrar para favoritar"
                    onClick={rememberPage}
                  >
                    ♡ Favoritar
                  </Link>
                )}
              </div>
            </div>
          </form>

          <p className="detail-metadata">ID do token: #0042</p>
          <p className="detail-metadata">Coleção: Kurio Apes</p>
          <p className="detail-metadata">Atributos: Óculos, Esmeralda, Raro</p>
          <p className="detail-share">
            <strong>Compartilhar este NFT:</strong>
            <a href="https://www.linkedin.com" aria-label="Compartilhar no LinkedIn">in</a>
            <a href="mailto:?subject=Emerald%20Ape%20%23042" aria-label="Compartilhar por e-mail">✉</a>
            <a href="https://twitter.com/intent/tweet" aria-label="Compartilhar no Twitter">♥</a>
          </p>

          <p className="detail-update-status" role="status">
            {update.isSuccess
              ? "Adicionado ao carrinho."
              : update.isError
                ? "Falha ao adicionar. Confira a quantidade e o estoque."
                : ""}
          </p>
          {update.isSuccess && (
            <Link className="view-cart detail-view-cart" to="/carrinho">
              Ver carrinho
            </Link>
          )}
        </div>
      </div>

      <section className="nft-information">
        <div className="detail-tabs" role="tablist" aria-label="Informações do NFT">
          <button role="tab" aria-selected="true">Detalhes do NFT</button>
          <button role="tab">Avaliações de colecionadores (19)</button>
        </div>

        <div className="nft-information-content">
          <article>
            <p>
              Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção
              Kurio Editions. Cada atributo fica armazenado nos metadados do token e
              verificado na Ethereum. A obra explora identidade, movimento e luz em
              um mundo digital sem fronteiras.
            </p>
            <p>
              A propriedade inclui a arte em alta resolução, lançamentos exclusivos
              para colecionadores e um registro permanente de procedência registrada
              na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias,
              apoiando novos trabalhos e lançamentos da comunidade.
            </p>
            <p><strong>Rede:</strong><br />Cunhado na Ethereum com procedência imutável e metadados armazenados no IPFS.</p>
            <p><strong>Contrato:</strong><br />Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p>
            <p><strong>Direitos autorais:</strong><br />0x7A42...19E8 · Contrato inteligente ERC-721 verificado.</p>
          </article>
        </div>
      </section>

      <section className="related-nfts">
        <div className="related-heading">
          <h2>Mais desta coleção</h2>
        </div>
        <div className="related-grid">
          {relatedItems.map((item) => (
            <Link
              key={item.id}
              className="related-card"
              to="/nft/$id"
              params={{ id: item.id }}
            >
              <img src={artSrc(item.id)} alt="" width={210} height={230} />
              <div>
                <h3 role="presentation">{item.title}</h3>
                <strong>{item.price} ETH</strong>
              </div>
            </Link>
          ))}
        </div>
        <div className="related-dots" aria-hidden="true"><span /><span /><span /></div>
      </section>
    </section>
  );
}
function Basket() {
  const cart = useCart();
  const update = useChange();

  const recommendations = [
    { id: "4", title: "Cosmic Bloom #118", price: "1.29" },
    { id: "5", title: "Violet Nomad #314", price: "1.39" },
    { id: "6", title: "Ivory Baron #088", price: "1.79" },
    { id: "7", title: "Golden Beat #207", price: "0.99" },
    { id: "8", title: "Golden Signal #160", price: "0.39" },
  ];

  if (cart.isPending) return <Loading />;
  if (cart.isError) return <Problem retry={cart.refetch} />;

  return (
    <section className="cart-page">
      <div className="breadcrumbs">
        <Link to="/" search={initialSearch}>Início</Link>
        <span aria-hidden="true"> / </span>
        <Link to="/" search={initialSearch}>Mercado</Link>
        <span aria-hidden="true"> / </span>
        Carrinho
      </div>

      <div className="mobile-cart-header">
        <Link
          className="mobile-cart-back"
          to="/"
          search={initialSearch}
          aria-label="Voltar ao mercado"
        >
          ‹
        </Link>

        <h1 className="mobile-cart-title">Carrinho de NFTs</h1>
      </div>

      {(cart.data?.lines ?? []).length === 0 ? (
        <div className="empty-cart">
          <h2>Seu carrinho está vazio.</h2>
          <p>Explore o marketplace e encontre sua próxima obra digital.</p>
          <Link className="action" to="/" search={initialSearch}>
            Explorar coleção
          </Link>
        </div>
      ) : (
        <div className="basket-grid">
          <div className="basket-items">
            <div className="basket-labels" aria-hidden="true">
              <b>NFTs</b>
              <b>Preço</b>
              <b>Edições</b>
              <b>Total</b>
              <span />
            </div>

            {(cart.data?.lines ?? []).map(({ nft, quantity }) => {
              const artworkId = nft.artworkId ?? nft.id;

              return (
                <article className="cart-row" key={nft.id}>
                  <div className="cart-product">
                    <img
                      src={artSrc(artworkId)}
                      alt=""
                      width={70}
                      height={70}
                    />
                    <div>
                      <h3>{nft.title}</h3>
                      <small>
                        Edição: {nft.edition ?? "1/50"}
                      </small>
                    </div>
                  </div>

                  <div className="cart-price">
                    <small>Preço</small>
                    <strong>{nft.price} ETH</strong>
                  </div>

                  <div className="cart-quantity" aria-label="Edições">
                    <button
                      type="button"
                      aria-label={`Diminuir quantidade de ${nft.title}`}
                      disabled={update.isPending || quantity <= 1}
                      onClick={() =>
                        update.mutate({
                          id: nft.id,
                          quantity: quantity - 1,
                        })
                      }
                    >
                      −
                    </button>

                    <output aria-label={`Quantidade de ${nft.title}`}>
                      {quantity}
                    </output>

                    <button
                      type="button"
                      aria-label={`Aumentar quantidade de ${nft.title}`}
                      disabled={update.isPending || quantity >= nft.stock}
                      onClick={() =>
                        update.mutate({
                          id: nft.id,
                          quantity: quantity + 1,
                        })
                      }
                    >
                      +
                    </button>
                  </div>

                  <div className="cart-line-total">
                    <small>Total</small>
                    <strong>
                      {(Number(nft.price) * quantity).toFixed(2)} ETH
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="cart-remove"
                    aria-label={`Remover ${nft.title}`}
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({
                        id: nft.id,
                        quantity: 0,
                      })
                    }
                  >
                    ♧
                  </button>
                </article>
              );
            })}
          </div>

          <aside className="basket-summary">
            <h2>Resumo da carteira</h2>

            <CartCoupon
              api={api}
              owner={user?.id ?? "guest"}
              cart={cart.data}
            />

            <Link
              className="action checkout-action"
              aria-label="Ir para pagamento"
              to="/pagamento"
            >
              Conectar e finalizar
            </Link>

            <Link className="continue-shopping" to="/" search={initialSearch}>
              Continuar explorando
            </Link>
          </aside>
        </div>
      )}

      <p className="basket-update-status" role="status">
        {update.isError
          ? "Falha ao atualizar o carrinho. Tente novamente."
          : ""}
      </p>

      <section className="cart-recommendations">
        <div className="cart-recommendations-heading">
          <h2>Colecionadores também viram</h2>
        </div>

        <div className="cart-recommendations-grid">
          {recommendations.map((item) => (
            <Link
              key={item.id}
              className="cart-recommendation-card"
              to="/nft/$id"
              params={{ id: item.id }}
            >
              <img src={artSrc(item.id)} alt="" width={218} height={218} />
              <div>
                <h3 role="presentation">{item.title}</h3>
                <strong>{item.price} ETH</strong>
              </div>
            </Link>
          ))}
        </div>

        <div className="cart-recommendation-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    </section>
  );
}
const root = createRootRoute({
  component: Layout,
  notFoundComponent: () => <h1>Página não encontrada</h1>,
});
const home = createRoute({
  getParentRoute: () => root,
  path: "/",
  component: Catalog,
  validateSearch: (raw: Record<string, unknown>): Search => ({
    q: typeof raw.q === "string" ? raw.q : "",
    series: typeof raw.series === "string" ? raw.series : "",
    sort: raw.sort === "price" ? "price" : "featured",
    page:
      Number.isSafeInteger(Number(raw.page)) && Number(raw.page) > 0
        ? Number(raw.page)
        : 1,
  }),
});
const detail = createRoute({
  getParentRoute: () => root,
  path: "/nft/$id",
  component: Detail,
});
const cartRoute = createRoute({
  getParentRoute: () => root,
  path: "/carrinho",
  component: Basket,
});
const login = createRoute({
  getParentRoute: () => root,
  path: "/login",
  component: () => <AccountForm key="login" />,
});
const register = createRoute({
  getParentRoute: () => root,
  path: "/cadastro",
  component: () => <AccountForm register key="cadastro" />,
});
function privateRoute({ location }: { location: { pathname: string } }) {
  if (!user) {
    sessionStorage.setItem(returnKey, location.pathname);
    throw redirect({ to: "/login" });
  }
}
const payment = createRoute({
  getParentRoute: () => root,
  path: "/pagamento",
  beforeLoad: privateRoute,
  component: () => <Payment api={api} owner={user!.id} name={user!.name} />,
});
const receipt = createRoute({
  getParentRoute: () => root,
  path: "/pedido/$id",
  beforeLoad: privateRoute,
  component: () => (
    <Receipt api={api} owner={user!.id} id={receipt.useParams().id} />
  ),
});
let io: typeof import("socket.io-client").io;
const walletsRoute = createRoute({
  getParentRoute: () => root,
  path: "/carteiras",
  beforeLoad: privateRoute,
  component: () => <WalletsPage api={api} owner={user!.id} />,
});
function ProfileLink({ account }: { account: User }) {
  const profile = useQuery({
    queryKey: ["profile", account.id],
    queryFn: async ({ signal }) =>
      (await api.get<CollectorProfile>("/profile", { signal })).data,
  });
  const name = profile.data?.name ?? account.name;
  return (
    <Link to="/perfil" aria-label={"Meu perfil de " + name}>
      {name}
    </Link>
  );
}

const profileRoute = createRoute({
  getParentRoute: () => root,
  path: "/perfil",
  beforeLoad: privateRoute,
  component: () => (
    <ProfilePage
      api={api}
      owner={user!.id}
      onSaved={(updated) => {
        user = { id: updated.id, name: updated.name, email: updated.email };
      }}
    />
  ),
});
const activityRoute = createRoute({
  getParentRoute: () => root,
  path: "/atividade",
  beforeLoad: privateRoute,
  component: () => (
    <AccountBasicPage api={api} kind="activity" />
  ),
});

const watchlistRoute = createRoute({
  getParentRoute: () => root,
  path: "/lista-de-interesse",
  beforeLoad: privateRoute,
  component: () => (
    <AccountBasicPage api={api} kind="watchlist" />
  ),
});

const offersRoute = createRoute({
  getParentRoute: () => root,
  path: "/ofertas",
  beforeLoad: privateRoute,
  component: () => (
    <AccountBasicPage api={api} kind="offers" />
  ),
});

const downloadsRoute = createRoute({
  getParentRoute: () => root,
  path: "/downloads",
  beforeLoad: privateRoute,
  component: () => (
    <AccountBasicPage api={api} kind="downloads" />
  ),
});
const router = createRouter({
  routeTree: root.addChildren([
    activityRoute,
    watchlistRoute,
    offersRoute,
    downloadsRoute,
    profileRoute,
    walletsRoute,
    home,
    detail,
    cartRoute,
    login,
    register,
    payment,
    receipt,
  ]),
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
async function start() {
  if (import.meta.env.VITE_MOCKS !== "false") {
    const { worker } = await import("./mock");
    await worker.start({ onUnhandledRequest: "bypass", quiet: true });
  }
  if (sessionStorage.getItem(tokenKey))
    user = (await api.get<User>("/session")).data;
  if (user && ["/login", "/cadastro"].includes(location.pathname)) {
    resume();
    return;
  }
  io = (await import("socket.io-client")).io;
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queries}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
void start().catch(() => {
  document.getElementById("root")!.textContent =
    "Falha ao iniciar a aplicação. Recarregue a página.";
});
