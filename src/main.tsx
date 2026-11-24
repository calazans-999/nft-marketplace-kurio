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
import { CartCoupon } from "./CartCoupon";
import { FavoriteButton } from "./FavoriteButton";
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
    sessionStorage.getItem(returnKey) || "/carrinho",
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
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      if (register) await api.post("/accounts", { name, email, password });
      const { data } = await api.post<{ token: string; adjusted: boolean }>(
        "/login",
        { email, password },
      );
      sessionStorage.setItem(tokenKey, data.token);
      if (data.adjusted) sessionStorage.setItem("forma:adjusted", "1");
      resume();
    },
  });
  return (
    <section className="account auth-page">
      <p className="auth-brand">KURIO</p>
      <h1>{register ? "Criar conta" : "Entrar"}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {register && (
          <label>
            Nome
            <input
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label>
          E-mail
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            required
            minLength={register ? 8 : 1}
            autoComplete={register ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {register && <p>Use pelo menos 8 caracteres.</p>}
        {mutation.isError && <p role="alert">{msg(mutation.error)}</p>}
        <button className="action" disabled={mutation.isPending}>
          {register ? "Criar conta" : "Entrar"}
        </button>
      </form>
      <Link to={register ? "/login" : "/cadastro"}>
        {register ? "Já tenho conta" : "Criar uma conta"}
      </Link>
    </section>
  );
}
function useCart() {
  return useQuery({
    queryKey: ["cart", user?.id ?? "guest"],
    queryFn: async ({ signal }) =>
      (await api.get<Cart>("/cart", { signal })).data,
  });
}
function useChange() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      quantity: number;
      mode?: string;
    }) => (await api.put<Cart>("/cart/" + input.id, input)).data,
    onSuccess: (data) =>
      client.setQueryData(["cart", user?.id ?? "guest"], data),
  });
}
function Problem({ retry }: { retry: () => void }) {
  return (
    <div role="alert">
      Falha ao carregar. <button onClick={retry}>Tentar novamente</button>
    </div>
  );
}
function Loading() {
  return (
    <div className="skeleton" role="status" aria-label="Carregando conteúdo" />
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
  const count = cart.data?.lines.reduce((s, l) => s + l.quantity, 0);
  return (
    <>
      <a className="skip" href="#content">
        Pular para o conteúdo
      </a>
      <header>
        <Link to="/" search={initialSearch} className="brand">
          KURIO
        </Link>
        <nav aria-label="Navegação principal">
          <Link className="nav-home" to="/" search={initialSearch}>
            Início
          </Link>
          <Link to="/" search={initialSearch}>
            Explorar
          </Link>
          <Link className="pill nav-cart" to="/carrinho">
            Carrinho{count !== undefined ? " · " + count : ""}
          </Link>
          {user ? (
            <>
              <Link to="/carteiras">Minhas carteiras</Link>
              <ProfileLink account={user} />
              <button
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
              >
                Sair
              </button>
            </>
          ) : (
            <Link className="nav-signin" to="/login" onClick={rememberPage}>
              Entrar
            </Link>
          )}
        </nav>
      </header>
      <main id="content" tabIndex={-1}>
        <p role="status">{notice}</p>
        {logout.isError && <p role="alert">{msg(logout.error)}</p>}
        <Outlet />
        {import.meta.env.VITE_MOCKS !== "false" && (
          <footer className="site-footer">
            <div>
              <strong>KURIO</strong>
              <p>Mercado de arte digital</p>
            </div>
            <nav aria-label="Links do rodapé">
              <Link to="/" search={initialSearch}>
                Mercado
              </Link>
              <Link to="/carrinho">Meu carrinho</Link>
            </nav>
            <DemoPanel api={api} />
          </footer>
        )}
      </main>
    </>
  );
}
function Catalog() {
  const search = home.useSearch();
  const navigate = home.useNavigate();
  const change = (next: Partial<Search>) =>
    void navigate({ search: { ...search, page: 1, ...next } });
  const result = useQuery({
    queryKey: ["nfts", search],
    queryFn: async ({ signal }) =>
      (
        await api.get<{ items: Nft[]; total: number }>("/nfts", {
          params: search,
          signal,
        })
      ).data,
  });
  return (
    <>
      <section className="hero">
        <div>
          <p className="kicker">Bem-vindo à Kurio</p>
          <h1>Seja dono do futuro da arte digital.</h1>
          <p className="hero-description">
            Descubra NFTs selecionados de criadores emergentes e consagrados.
          </p>
          <a href="#catalogo" className="action">
            Explorar coleção
          </a>
        </div>
        <img
          src={artSrc("1")}
          alt="Colecionável ilustrado com óculos e jaqueta verde"
          width={355}
          height={355}
          fetchPriority="high"
        />
      </section>
      <section id="catalogo">
        <h2>Explore o marketplace</h2>
        <div className="columns">
          <aside>
            <h3>Filtros</h3>
            <label>
              Buscar obra
              <input
                type="search"
                value={search.q}
                onChange={(e) => change({ q: e.target.value })}
              />
            </label>
            <label htmlFor="catalogo-colecao">Coleção</label>
            <select
              id="catalogo-colecao"
              value={search.series}
              onChange={(e) => change({ series: e.target.value })}
            >
              <option value="">Todas</option>
              <option>Órbitas</option>
              <option>Ondas</option>
            </select>
            <label>
              Ordenar por
              <select
                value={search.sort}
                onChange={(e) => change({ sort: e.target.value })}
              >
                <option value="featured">Destaques</option>
                <option value="price">Menor preço</option>
              </select>
            </label>
          </aside>
          <div>
            {result.isPending ? (
              <Loading />
            ) : result.isError ? (
              <Problem retry={result.refetch} />
            ) : (
              <>
                <div className="grid gap-4 cards">
                  {result.data.items.map((n) => (
                    <Link
                      className="card"
                      key={n.id}
                      to="/nft/$id"
                      params={{ id: n.id }}
                    >
                      <img src={artSrc(n.id)} alt="" width={355} height={355} />
                      <div>
                        <small>
                          {n.series} · {n.artist}
                        </small>
                        <h3>{n.title}</h3>
                        <strong>{n.price} ETH</strong>
                      </div>
                    </Link>
                  ))}
                </div>
                {!result.data.items.length && <p>Nenhuma obra encontrada.</p>}
                <div className="pager">
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
  const edition = nft.editions.find((item) => item.id === editionId) ?? nft;
  const [quantity, setQuantity] = useState(1);
  const update = useChange();
  return (
    <section className="detail">
      <div className="breadcrumbs">
        <Link to="/" search={initialSearch}>
          Início
        </Link>{" "}
        / Mercado
      </div>
      <div className="art-preview">
        <img src={artSrc(nft.id)} alt={nft.title} width={355} height={355} />
        <Dialog>
          <DialogTrigger>Ampliar obra</DialogTrigger>
          <DialogContent>
            <DialogTitle>{nft.title}</DialogTitle>
            <DialogDescription>
              Visualização da obra em tamanho maior.
            </DialogDescription>
            <img
              src={artSrc(nft.id)}
              alt={nft.title}
              width={355}
              height={355}
            />
          </DialogContent>
        </Dialog>
      </div>
      <div>
        <small>
          {nft.series} · {nft.artist}
        </small>
        <h1>{nft.title}</h1>
        <h2 className="nft-price">{edition.price} ETH</h2>
        <p>Sobre este NFT</p>
        <p className="muted">
          Colecionável digital da coleção {nft.series}, de {nft.artist}.
        </p>
        <label htmlFor="edition">Edição</label>
        <select
          id="edition"
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
        <p>
          {edition.stock
            ? edition.stock + " unidades disponíveis"
            : "Edição esgotada"}
        </p>
        <form
          className="purchase-actions"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ id: edition.id, quantity, mode: "add" });
          }}
        >
          <label>
            Quantidade
            <input
              type="number"
              required
              min="1"
              max={edition.stock}
              disabled={!edition.stock}
              value={quantity || ""}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <button
            className="action"
            disabled={update.isPending || !edition.stock}
          >
            Adicionar ao carrinho
          </button>
        </form>
        <p role="status">
          {update.isSuccess
            ? "Adicionado ao carrinho."
            : update.isError
              ? "Falha ao adicionar. Confira a quantidade e o estoque."
              : ""}
        </p>
        {user ? (
          <FavoriteButton
            key={nft.id}
            api={api}
            owner={user.id}
            nftId={nft.id}
          />
        ) : (
          <Link to="/login" onClick={rememberPage}>
            Entrar para favoritar
          </Link>
        )}
        <Link to="/carrinho">Ver carrinho</Link>
      </div>
    </section>
  );
}
function Basket() {
  const cart = useCart(),
    update = useChange();
  if (cart.isPending) return <Loading />;
  if (cart.isError) return <Problem retry={cart.refetch} />;
  return (
    <>
      <div className="breadcrumbs">
        <Link to="/" search={initialSearch}>
          Início
        </Link>{" "}
        / Mercado / Carrinho
      </div>
      <h1>Seu carrinho</h1>
      {cart.data.lines.length === 0 ? (
        <p>
          Seu carrinho está vazio.{" "}
          <Link to="/" search={initialSearch}>
            Explorar coleção
          </Link>
        </p>
      ) : (
        <div className="basket-grid">
          <div className="basket-items">
            <div className="basket-labels" aria-hidden="true">
              <b>NFTs</b>
              <b>Edições</b>
            </div>
            {cart.data.lines.map(({ nft, quantity }) => (
              <article className="row" key={nft.id}>
                <img src={artSrc(nft.artworkId ?? nft.id)} alt="" />
                <div>
                  <h3>{nft.title}</h3>
                  <p>
                    {nft.edition && nft.edition + " · "}
                    {nft.price} ETH por unidade
                  </p>
                </div>
                <label>
                  Quantidade
                  <select
                    disabled={update.isPending}
                    value={quantity}
                    onChange={(e) =>
                      update.mutate({
                        id: nft.id,
                        quantity: Number(e.target.value),
                      })
                    }
                  >
                    {Array.from({ length: nft.stock }, (_, i) => (
                      <option key={i}>{i + 1}</option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: nft.id, quantity: 0 })}
                >
                  Remover
                </button>
              </article>
            ))}
          </div>
          <aside className="basket-summary">
            <h2>Resumo da carteira</h2>
            <h2 className="basket-subtotal">
              Subtotal · {cart.data.subtotal} ETH
            </h2>
            <CartCoupon
              api={api}
              owner={user?.id ?? "guest"}
              cart={cart.data}
            />
            <Link className="action" to="/pagamento">
              Ir para pagamento
            </Link>
            {!user && (
              <Link className="nav-signin" to="/login" onClick={rememberPage}>
                Entrar e guardar meu carrinho
              </Link>
            )}
          </aside>
        </div>
      )}
      <p role="status">
        {update.isError
          ? "Falha ao atualizar o carrinho. Tente novamente."
          : ""}
      </p>
    </>
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
const router = createRouter({
  routeTree: root.addChildren([
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
