import { artSrc } from "./art";
import type { Wallet } from "./wallets";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios, { type AxiosInstance } from "axios";
import type { Quote, Order, Purchase } from "./model";
type Attempt = { id: string; input: Purchase };
function Amounts({ quote }: { quote: Quote }) {
  return (
    <>
      <ul className="quote-items">
        {quote.lines.map((line) => (
          <li key={line.id}>
            <img
              src={artSrc(line.nft.artworkId ?? line.nft.id)}
              alt=""
              width={52}
              height={52}
            />
            <span>
              {line.quantity} × {line.nft.title}{" "}
              {line.nft.edition && "· " + line.nft.edition} · {line.nft.price}{" "}
              ETH por unidade
            </span>
          </li>
        ))}
      </ul>
      <p>Subtotal · {quote.subtotal} ETH</p>
      {quote.coupon && (
        <>
          <p>Cupom aplicado · {quote.coupon}</p>
          <p>Desconto · {quote.discount} ETH</p>
        </>
      )}
      <p>Taxa de rede · {quote.fee} ETH</p>
      <h2>Total · {quote.total} ETH</h2>
    </>
  );
}
export function Payment({
  api,
  owner,
  name,
}: {
  api: AxiosInstance;
  owner: string;
  name: string;
}) {
  const storage = "forma:attempt:" + owner;
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [network, setNetwork] = useState("Ethereum Demo");
  const [timeoutAfterOrder, setTimeoutAfterOrder] = useState(false);
  const [declineConnection, setDeclineConnection] = useState(false);
  const [outcome, setOutcome] = useState<"confirmed" | "declined">("confirmed");
  const [attempt, setAttempt] = useState<Attempt | null>(() =>
    JSON.parse(sessionStorage.getItem(storage) || "null"),
  );
  const [connected, connect] = useState(false),
    [lose, setLose] = useState(false),
    [notice, setNotice] = useState("");
  const [review, setReview] = useState<Quote | null>(null);
  const data = useQuery({
    queryKey: ["checkout", owner],
    queryFn: async ({ signal }) =>
      (
        await api.get<{
          quote: Quote;
          wallet: string;
          wallets: Wallet[];
          pendingOrderId?: string | null;
        }>("/checkout", { signal })
      ).data,
  });
  const connection = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ connected: boolean }>("/checkout/connect", {
          wallet: selectedWalletId || data.data?.wallet,
          network,
          decline: declineConnection,
        })
      ).data,
    onSuccess: (result) => {
      connect(result.connected);
      setNotice("");
    },
    onError: (error) => {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      setNotice(message ?? "Falha ao conectar a carteira. Tente novamente.");
    },
  });
  const pay = useMutation({
    mutationFn: async () => {
      const next: Attempt = attempt ?? {
        id: crypto.randomUUID(),
        input: {
          revision: review!.revision,
          outcome,
          wallet: selectedWalletId || data.data!.wallet,
          network,
        },
      };
      sessionStorage.setItem(storage, JSON.stringify(next));
      setAttempt(next);
      const result = await api.post<Order>("/orders", next.input, {
        headers: {
          "Idempotency-Key": next.id,
          "X-Demo-Lost-Response": attempt
            ? "0"
            : timeoutAfterOrder
              ? "timeout"
              : lose
                ? "1"
                : "0",
        },
      });
      sessionStorage.removeItem(storage);
      location.replace("/pedido/" + result.data.id);
    },
    onError: async (error) => {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 409 &&
        typeof error.response.data?.orderId === "string"
      ) {
        sessionStorage.removeItem(storage);
        location.replace(
          "/pedido/" + encodeURIComponent(error.response.data.orderId),
        );
        return;
      }
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        sessionStorage.removeItem(storage);
        setAttempt(null);
        setReview(null);
        await data.refetch();
        setNotice("A cotação mudou. Confira os valores e revise novamente.");
      } else
        setNotice(
          "Resposta indisponível. Recupere a tentativa para consultar o mesmo pedido.",
        );
    },
  });
  if (attempt)
    return (
      <section>
        <h1>Consultar compra</h1>
        <p role="status">
          {notice || "Sua tentativa foi registrada nesta aba."}
        </p>
        <button disabled={pay.isPending} onClick={() => pay.mutate()}>
          Recuperar tentativa
        </button>
      </section>
    );
  if (data.isPending) return <p role="status">Carregando cotação…</p>;
  if (data.isError)
    return (
      <button onClick={() => data.refetch()}>
        Tentar carregar a cotação novamente
      </button>
    );
  const { wallet, quote, pendingOrderId } = data.data;
  if (pendingOrderId)
    return (
      <section className="account">
        <h1>Pagamento em processamento</h1>
        <a
          className="action"
          href={"/pedido/" + encodeURIComponent(pendingOrderId)}
        >
          Acompanhar pedido
        </a>
      </section>
    );

  const unavailableLines = quote.lines.filter(
    (line) => line.quantity > line.nft.stock,
  );

  if (unavailableLines.length > 0) {
    return (
      <section className="account">
        <h1>Disponibilidade alterada</h1>
        <div role="alert">
          {unavailableLines.map(({ id, nft, quantity }) => (
            <p key={id}>
              {nft.stock === 0
                ? `${nft.title} está esgotada.`
                : `${nft.title}: você selecionou ${quantity}, mas há apenas ${nft.stock} disponível(is).`}
            </p>
          ))}
        </div>
        <a className="action" href="/carrinho">
          Ajustar carrinho
        </a>
      </section>
    );
  }
  if (!quote.lines.length)
    return (
      <p>
        Seu carrinho está vazio. <a href="/">Explorar coleção</a>
      </p>
    );
  const changed = review && review.revision !== quote.revision;
  return (
    <section className="checkout">
      <div className="breadcrumbs">
        <a href="/">Início</a> / Mercado / Pagamento
      </div>
      <div className="checkout-title">
        <div>
          <small>CHECKOUT SEGURO</small>
          <h1>Pagamento</h1>
        </div>
        <p>Revise sua carteira e confirme a aquisição dos NFTs.</p>
      </div>

      <ol className="checkout-steps" aria-label="Etapas do pagamento">
        <li className="complete">
          <span>1</span>
          Carrinho
        </li>
        <li className="active">
          <span>2</span>
          Pagamento
        </li>
        <li>
          <span>3</span>
          Confirmação
        </li>
      </ol>

      <div className="checkout-grid">
        <section className="checkout-form">
          <div className="checkout-section-heading">
            <span aria-hidden="true">W</span>
            <div>
              <small>CARTEIRA DIGITAL</small>
              <h2>Perfil do colecionador</h2>
            </div>
          </div>
          <dl className="collector-details">
            <div>
              <dt>Nome de exibição</dt>
              <dd>{name}</dd>
            </div>
            <div>
              <dt>Endereço da carteira</dt>
              <dd>
                {
                  data.data.wallets.find(
                    (item) => item.id === (selectedWalletId || wallet),
                  )?.address
                }
              </dd>
            </div>
          </dl>
          <label>
            Carteira
            <select
              disabled={connected || connection.isPending}
              aria-label="Carteira"
              value={selectedWalletId || wallet}
              onChange={(event) => {
                setSelectedWalletId(event.target.value);
                setReview(null);
              }}
            >
              {data.data.wallets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} · {item.address.slice(-8)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rede
            <select
              aria-label="Rede"
              disabled={connected || connection.isPending}
              value={network}
              onChange={(event) => {
                setNetwork(event.target.value);
                setReview(null);
              }}
            >
              <option>Ethereum Demo</option>
              <option>Ethereum Testnet Demo</option>
            </select>
          </label>
          <button
            disabled={connection.isPending}
            onClick={() => {
              setReview(null);
              if (connected) {
                connect(false);
                setNotice("");
              } else {
                connection.mutate();
              }
            }}
          >
            {connected ? "Desconectar carteira" : "Conectar carteira simulada"}
          </button>

          <p role="status">
            {changed ? "A cotação mudou. Revise o novo total." : notice}
          </p>
          <details>
            <summary>Simulação de falha</summary>
            <label htmlFor="wallet-connection">Conexão da carteira</label>
            <select
              id="wallet-connection"
              value={declineConnection ? "decline" : "allow"}
              onChange={(event) =>
                setDeclineConnection(event.target.value === "decline")
              }
            >
              <option value="allow">Aceitar conexão</option>
              <option value="decline">Recusar conexão</option>
            </select>
            <label>
              Resultado do pagamento
              <select
                value={outcome}
                onChange={(e) =>
                  setOutcome(
                    e.target.value === "declined" ? "declined" : "confirmed",
                  )
                }
              >
                <option value="confirmed">Aprovar após 12 segundos</option>
                <option value="declined">Recusar após 12 segundos</option>
              </select>
            </label>
            <label htmlFor="order-response">Prazo da resposta do pedido</label>
            <select
              id="order-response"
              value={timeoutAfterOrder ? "timeout" : "normal"}
              onChange={(event) =>
                setTimeoutAfterOrder(event.target.value === "timeout")
              }
            >
              <option value="normal">Prazo normal</option>
              <option value="timeout">Expirar após criar o pedido</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={lose}
                onChange={(e) => setLose(e.target.checked)}
              />
              Perder resposta após criação do pedido
            </label>
          </details>
        </section>
        <aside className="checkout-summary">
          <h2>{review ? "Revisão da compra" : "Seus NFTs"}</h2>
          <Amounts quote={quote} />
          {review && !changed ? (
            <button
              className="action"
              disabled={pay.isPending}
              onClick={() => pay.mutate()}
            >
              Confirmar compra
            </button>
          ) : (
            <button
              className="action"
              disabled={!connected || data.isFetching}
              onClick={() => {
                setReview(quote);
                setNotice("Confira os itens e o total antes de confirmar.");
              }}
            >
              Revisar compra
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}

export function Receipt({
  api,
  owner,
  id,
}: {
  api: AxiosInstance;
  owner: string;
  id: string;
}) {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(false);
  const [paused, setPaused] = useState(false);

  const result = useQuery({
    queryKey: ["order", owner, id],
    queryFn: async ({ signal }) =>
      (await api.get<Order>("/orders/" + id, { signal })).data,
    refetchOnWindowFocus: !paused,
    refetchOnReconnect: !paused,
    refetchInterval: (query) =>
      !paused && !online && query.state.data?.status === "pending"
        ? 2500
        : false,
  });

  const terminal =
    result.data !== undefined && result.data.status !== "pending";

  useEffect(() => {
    if (paused || terminal) return;
    let disposed = false;
    let cleanup = () => {};
    async function connect() {
      const { io } = await import("socket.io-client");
      if (disposed) return;
      const socket = io(location.origin, {
        path: "/order-stream",
        transports: ["websocket"],
        forceNew: true,
        autoConnect: false,
      });
      const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["order", owner, id] });
      };
      socket.on("connect", () => {
        socket.emit("order.watch", {
          id,
          token: sessionStorage.getItem("forma:token"),
        });
        refresh();
      });
      socket.on("order.watching", () => {
        if (!disposed) {
          setOnline(true);
          refresh();
        }
      });
      socket.on("disconnect", () => {
        if (!disposed) setOnline(false);
      });
      let latestVersion = 0;
      socket.on(
        "order.updated",
        (event: { resourceId: string; version: number }) => {
          if (
            disposed ||
            event.resourceId !== id ||
            event.version <= latestVersion
          )
            return;
          latestVersion = event.version;
          refresh();
        },
      );
      cleanup = () => {
        socket.removeAllListeners();
        socket.disconnect();
      };
      socket.connect();
    }
    void connect().catch(() => {
      if (!disposed) setOnline(false);
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [id, owner, paused, terminal, queryClient]);

  useEffect(() => {
    if (!terminal) return;
    for (const key of ["cart", "nft", "nfts", "checkout"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [terminal, queryClient]);

  if (result.isPending) return <p role="status">Consultando pedido…</p>;
  if (result.isError)
    return (
      <p role="alert">
        Não foi possível consultar este pedido.{" "}
        <button onClick={() => result.refetch()}>Tentar novamente</button>
      </p>
    );
  const order = result.data;

  if (order.status === "pending")
    return (
      <section className="receipt-state receipt-pending">
        <div className="receipt-state-icon" aria-hidden="true">
          …
        </div>
        <small>PROCESSANDO TRANSAÇÃO</small>
        <h1>Pagamento em processamento</h1>
        <p role="status">
          {paused
            ? "Conexão da demonstração interrompida."
            : online
              ? "Aguardando o resultado do pagamento."
              : "Consultando o estado do pedido."}
        </p>

        <div className="receipt-state-order">
          <p>Pedido · {order.id}</p>
          <Amounts quote={order.quote} />
        </div>

        <button
          onClick={() => {
            setOnline(false);
            setPaused(!paused);
            if (paused) void result.refetch();
          }}
        >
          {paused ? "Reconectar" : "Simular desconexão"}
        </button>
      </section>
    );

  if (order.status === "declined")
    return (
      <section className="receipt-state receipt-declined">
        <div className="receipt-state-icon" aria-hidden="true">
          ×
        </div>
        <small>TRANSAÇÃO NÃO CONCLUÍDA</small>
        <h1>Pagamento recusado</h1>
        <p role="status">
          A compra não foi concluída. Os itens continuam no carrinho.
        </p>
        <p className="receipt-order-id">Pedido · {order.id}</p>
        <a className="action" href="/carrinho">
          Voltar ao carrinho
        </a>
      </section>
    );

  return (
    <section className="receipt-page">
      <div className="breadcrumbs">
        <a href="/">Início</a>
        <span aria-hidden="true"> / </span>
        <a href="/carrinho">Carrinho</a>
        <span aria-hidden="true"> / </span>
        Confirmação
      </div>

      <header className="receipt-success">
        <div className="receipt-success-icon" aria-hidden="true">
          ✓
        </div>
        <small>PAGAMENTO APROVADO</small>
        <h1>Compra confirmada</h1>
        <p>Seus NFTs foram adicionados à carteira simulada.</p>
      </header>

      <div className="receipt-layout">
        <article className="receipt-card">
          <div className="receipt-card-heading">
            <div>
              <small>RESUMO DO PEDIDO</small>
              <h2>Detalhes da transação</h2>
            </div>
            <span>Confirmado</span>
          </div>

          <dl className="receipt-metadata">
            <div>
              <dt>Pedido</dt>
              <dd>{order.id}</dd>
            </div>
            <div>
              <dt>Rede</dt>
              <dd>Rede · {order.network}</dd>
            </div>
          </dl>

          <div className="receipt-wallet">
            {order.walletSnapshot ? (
              <div aria-label="Carteira usada no pagamento">
                <p>Carteira · {order.walletSnapshot.label}</p>
                <p>Endereço · {order.walletSnapshot.address}</p>
              </div>
            ) : (
              <p>Carteira · {order.wallet}</p>
            )}
          </div>

          <a className="receipt-wallet-link" href="/carteiras">
            Minhas carteiras
          </a>

          <p className="receipt-transaction">
            Transação simulada · {order.transaction}
          </p>

          <div className="receipt-amounts">
            <Amounts quote={order.quote} />
          </div>
        </article>

        <aside className="receipt-next">
          <span aria-hidden="true">K</span>
          <h2>Agora eles são seus</h2>
          <p>
            As obras desta compra já aparecem na sua carteira simulada e no
            histórico do colecionador.
          </p>
          <a className="action" href="/">
            Voltar ao catálogo
          </a>
          <a href="/perfil">Ver meu perfil</a>
        </aside>
      </div>
    </section>
  );
}
