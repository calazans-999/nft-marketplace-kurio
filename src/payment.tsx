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
  const tokenIds: Record<string, string> = {
    "1": "#0042",
    "2": "#0009",
    "3": "#0552",
    "4": "#0118",
    "5": "#0314",
    "6": "#0088",
    "7": "#0207",
    "8": "#0160",
  };

  return (
    <div className="checkout-amounts">
      <div className="checkout-items-labels" aria-hidden="true">
        <strong>NFTs</strong>
        <strong>Subtotal</strong>
      </div>

      <ul className="quote-items">
        {quote.lines.map((line) => {
          const artworkId = line.nft.artworkId ?? line.nft.id;

          return (
            <li key={line.id}>
              <img
                src={artSrc(artworkId)}
                alt=""
                width={60}
                height={60}
              />
              <span className="quote-item-name">
                <strong>{line.nft.title}</strong>
                <small>
                  ID do token: {tokenIds[artworkId] ?? `#${artworkId}`}
                </small>
              </span>
              <span className="quote-item-quantity">
                (× {line.quantity})
              </span>
              <strong className="quote-item-total">
                {(Number(line.nft.price) * line.quantity).toFixed(2)} ETH
              </strong>
            </li>
          );
        })}
      </ul>

      <p className="checkout-coupon-hint">
        Tem um código promocional? Aplique aqui
      </p>

      <div className="checkout-totals">
        <p>
          <span>Subtotal<span className="payment-separator"> · </span></span>
          <strong>{quote.subtotal} ETH</strong>
        </p>

        {quote.coupon && (
          <p>
            <span>Desconto do lançamento<span className="payment-separator"> · </span></span>
            <strong>(-) {quote.discount}</strong>
          </p>
        )}

        {!quote.coupon && (
          <p>
            <span>Desconto do lançamento<span className="payment-separator"> · </span></span>
            <strong>(-) 00.00</strong>
          </p>
        )}

        <p>
          <span>Taxa de rede<span className="payment-separator"> · </span></span>
          <strong>{quote.fee} ETH</strong>
        </p>

        <small>Taxa estimada</small>

        <h2>
          <span>Total<span className="payment-separator"> · </span></span>
          <strong>{quote.total} ETH</strong>
        </h2>
      </div>
    </div>
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
  const [useOtherWallet, setUseOtherWallet] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<
    "walletconnect" | "metamask" | "coinbase"
  >("coinbase");
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
  useEffect(() => {
    if (!data.data || selectedWalletId) return;

    const defaultWallet =
      data.data.wallets.find((item) => item.id === data.data?.wallet) ??
      data.data.wallets[0];

    if (defaultWallet) {
      setSelectedWalletId(defaultWallet.id);
    }
  }, [data.data, selectedWalletId]);

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

      if (result.connected && data.data?.quote) {
        setReview(data.data.quote);
        setNotice("Carteira conectada. Confira os valores e confirme a compra.");
      } else {
        setNotice("");
      }
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

  const selectedWallet =
    data.data.wallets.find(
      (item) => item.id === (selectedWalletId || wallet),
    ) ?? data.data.wallets[0];

  const paymentActionName = !connected
    ? "Conectar carteira simulada"
    : review && !changed
      ? "Confirmar compra"
      : "Revisar compra";

  const handlePaymentAction = () => {
    if (!connected) {
      connection.mutate();
      return;
    }

    if (!review || changed) {
      setReview(quote);
      setNotice("Confira os itens e o total antes de confirmar.");
      return;
    }

    pay.mutate();
  };

  return (
    <section className="checkout checkout-figma">
      <div className="breadcrumbs">
        <a href="/">Início</a> / Mercado / Pagamento
      </div>

      {/* === KURIO: PAGAMENTO MOBILE === */}
      <section
        className="checkout-mobile-wallet"
        aria-label="Pagamento com carteira"
      >
        <header className="checkout-mobile-header">
          <a
            href="/carrinho"
            className="checkout-mobile-back"
            aria-label="Voltar ao carrinho"
          >
            ‹
          </a>

          <h1>Pagamento com carteira</h1>
        </header>

        <div className="checkout-mobile-heading">
          <h2>Carteira conectada</h2>

          <button
            type="button"
            disabled={connection.isPending || pay.isPending}
            onClick={() => {
              const currentIndex = data.data.wallets.findIndex(
                (item) => item.id === selectedWallet?.id,
              );

              const nextWallet =
                data.data.wallets[
                  (currentIndex + 1) % data.data.wallets.length
                ];

              if (nextWallet) {
                setSelectedWalletId(nextWallet.id);
                connect(false);
                setReview(null);
                setNotice(`${nextWallet.label} selecionada.`);
              }
            }}
          >
            Trocar carteira
          </button>
        </div>

        <div
          className="checkout-mobile-wallet-list"
          role="radiogroup"
          aria-label="Carteiras cadastradas"
        >
          {data.data.wallets.slice(0, 2).map((item, index) => {
            const selected = item.id === selectedWallet?.id;
            const walletTitle =
              item.label?.trim() ||
              (index === 0 ? "Principal" : "Reserva");

            const shortAddress =
              item.address.length > 15
                ? `${item.address.slice(0, 7)}…${item.address.slice(-4)}`
                : item.address;

            return (
              <button
                key={item.id}
                type="button"
                className={selected ? "selected" : undefined}
                role="radio"
                aria-checked={selected}
                disabled={connection.isPending || pay.isPending}
                onClick={() => {
                  setSelectedWalletId(item.id);
                  connect(false);
                  setReview(null);
                  setNotice(`${walletTitle} selecionada.`);
                }}
              >
                <span className="checkout-mobile-radio" aria-hidden="true" />

                <span className="checkout-mobile-wallet-copy">
                  <strong>{walletTitle}</strong>
                  <span>{shortAddress}</span>
                  <small>
                    Rede {network.replace(" Demo", "")}
                  </small>
                </span>

                <span
                  className="checkout-mobile-wallet-menu"
                  aria-hidden="true"
                >
                  ⋮
                </span>
              </button>
            );
          })}
        </div>

        <h2 className="checkout-mobile-network-title">
          Carteira e rede
        </h2>

        <div
          className="checkout-mobile-provider-list"
          role="radiogroup"
          aria-label="Forma de conexão"
        >
          {(
            [
              {
                id: "walletconnect",
                label: "WalletConnect",
                symbol: "W",
              },
              {
                id: "metamask",
                label: "MetaMask",
                symbol: "M",
              },
              {
                id: "coinbase",
                label: "Coinbase Wallet",
                symbol: "▱",
              },
            ] as const
          ).map((provider) => {
            const selected = paymentProvider === provider.id;

            return (
              <button
                key={provider.id}
                type="button"
                className={selected ? "selected" : undefined}
                role="radio"
                aria-checked={selected}
                disabled={connection.isPending || pay.isPending}
                onClick={() => {
                  const walletOption =
                    provider.id === "coinbase"
                      ? data.data.wallets[1] ?? data.data.wallets[0]
                      : data.data.wallets[0];

                  if (!walletOption) {
                    setNotice("Nenhuma carteira disponível.");
                    return;
                  }

                  setPaymentProvider(provider.id);
                  setSelectedWalletId(walletOption.id);
                  setNetwork("Ethereum Demo");
                  connect(false);
                  setReview(null);
                  setNotice(`${provider.label} selecionado.`);
                }}
              >
                <span
                  className="checkout-mobile-provider-icon"
                  aria-hidden="true"
                >
                  {provider.symbol}
                </span>

                <strong>{provider.label}</strong>

                <span
                  className="checkout-mobile-provider-radio"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        <div className="checkout-mobile-total">
          <strong>Total:</strong>
          <span>{quote.total} ETH</span>
        </div>

        <p className="checkout-mobile-notice" role="status">
          {changed ? "A cotação mudou. Revise o novo total." : notice}
        </p>

        <button
          type="button"
          className={`checkout-mobile-confirm${
            connected && review && !changed
              ? " checkout-mobile-confirm-ready"
              : ""
          }${
            connection.isPending || pay.isPending
              ? " checkout-mobile-confirm-loading"
              : ""
          }`}
          aria-label={paymentActionName}
          aria-live="polite"
          disabled={
            connection.isPending ||
            pay.isPending ||
            data.isFetching
          }
          onClick={handlePaymentAction}
        >
          {connection.isPending
            ? "Conectando…"
            : pay.isPending
              ? "Processando…"
              : connected && review && !changed
                ? "Finalizar compra"
                : "Confirmar compra"}
        </button>
      </section>
      {/* === FIM: PAGAMENTO MOBILE === */}
      <div className="checkout-grid">
        <section className="checkout-form">
          <h1>Perfil do colecionador</h1>

          <div className="collector-form-grid">
            <label>
              Nome de exibição<span aria-hidden="true">*</span>
              <input defaultValue={name} autoComplete="name" />
            </label>

            <label>
              Nome de usuário<span aria-hidden="true">*</span>
              <input defaultValue={name} autoComplete="username" />
            </label>

            <label>
              Rede <span aria-hidden="true">*</span>
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

            <label>
              Nome do perfil<span aria-hidden="true">*</span>
              <input defaultValue={name} />
            </label>

            <label>
              Endereço da carteira<span aria-hidden="true">*</span>
              <input
                value={selectedWallet?.address ?? ""}
                readOnly
                aria-label="Endereço da carteira"
              />
            </label>

            <label>
              ENS ou carteira secundária (opcional)
              <input placeholder="ENS ou carteira secundária (opcional)" />
            </label>

            <label>
              Tipo de carteira<span aria-hidden="true">*</span>
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
              Código de indicação<span aria-hidden="true">*</span>
              <input />
            </label>

            <label>
              E-mail<span aria-hidden="true">*</span>
              <input type="email" autoComplete="email" />
            </label>

            <label className="ens-field">
              Nome ENS <span aria-hidden="true">*</span>
              <span>
                <input aria-label="Nome ENS" />
                <b>.eth</b>
              </span>
            </label>
          </div>

          <label className="other-wallet-option">
            <input
              type="checkbox"
              checked={useOtherWallet}
              disabled={connected || connection.isPending}
              onChange={(event) => {
                const checked = event.target.checked;
                setUseOtherWallet(checked);
                setReview(null);

                const primaryWallet =
                  data.data.wallets.find(
                    (item) => item.id === data.data.wallet,
                  ) ?? data.data.wallets[0];

                const secondaryWallet = data.data.wallets.find(
                  (item) => item.id !== primaryWallet?.id,
                );

                if (checked) {
                  if (secondaryWallet) {
                    setSelectedWalletId(secondaryWallet.id);
                    setNotice("Carteira alternativa selecionada.");
                  } else {
                    setUseOtherWallet(false);
                    setNotice(
                      "Cadastre uma carteira secundária antes de usar esta opção.",
                    );
                  }
                } else if (primaryWallet) {
                  setSelectedWalletId(primaryWallet.id);
                  setNotice("Carteira principal selecionada.");
                }
              }}
            />
            Usar outra carteira?
          </label>

          <label className="collector-note">
            Observação do colecionador (opcional)
            <textarea rows={7} />
          </label>

          <p className="checkout-notice" role="status">
            {changed ? "A cotação mudou. Revise o novo total." : notice}
          </p>

          <details className="checkout-failure-simulation">
            <summary>Simulação de falha</summary>

            <label htmlFor="wallet-connection">
              Conexão da carteira
            </label>
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
                onChange={(event) =>
                  setOutcome(
                    event.target.value === "declined"
                      ? "declined"
                      : "confirmed",
                  )
                }
              >
                <option value="confirmed">Aprovar após 12 segundos</option>
                <option value="declined">Recusar após 12 segundos</option>
              </select>
            </label>

            <label htmlFor="order-response">
              Prazo da resposta do pedido
            </label>
            <select
              id="order-response"
              value={timeoutAfterOrder ? "timeout" : "normal"}
              onChange={(event) =>
                setTimeoutAfterOrder(event.target.value === "timeout")
              }
            >
              <option value="normal">Prazo normal</option>
              <option value="timeout">
                Expirar após criar o pedido
              </option>
            </select>

            <label>
              <input
                type="checkbox"
                checked={lose}
                onChange={(event) => setLose(event.target.checked)}
              />
              Perder resposta após criação do pedido
            </label>
          </details>
        </section>

        <aside className="checkout-summary">
          <h2>Seus NFTs</h2>
          <Amounts quote={quote} />

          <h2 className="wallet-network-title">
            Carteira e rede
          </h2>

          <div className="wallet-network-options">
            <button
              type="button"
              className={`wallet-network-brands${
                paymentProvider === "walletconnect" ? " selected" : ""
              }`}
              aria-pressed={paymentProvider === "walletconnect"}
              disabled={connection.isPending || pay.isPending}
              onClick={() => {
                const walletOption = data.data.wallets[0];

                if (!walletOption) {
                  setNotice("Nenhuma carteira disponível.");
                  return;
                }

                setPaymentProvider("walletconnect");
                setSelectedWalletId(walletOption.id);
                setNetwork("Ethereum Demo");
                connect(false);
                setReview(null);
                setNotice("WalletConnect selecionado.");
              }}
            >
              <span aria-hidden="true">
                {paymentProvider === "walletconnect" ? "◉" : "○"}
              </span>
              METAMASK · WALLETCONNECT · COINBASE
            </button>

            <button
              type="button"
              className={paymentProvider === "metamask" ? "selected" : undefined}
              aria-pressed={paymentProvider === "metamask"}
              disabled={connection.isPending || pay.isPending}
              onClick={() => {
                const walletOption = data.data.wallets[0];

                if (!walletOption) {
                  setNotice("Nenhuma carteira disponível.");
                  return;
                }

                setPaymentProvider("metamask");
                setSelectedWalletId(walletOption.id);
                setNetwork("Ethereum Demo");
                connect(false);
                setReview(null);
                setNotice("MetaMask selecionada.");
              }}
            >
              <span aria-hidden="true">
                {paymentProvider === "metamask" ? "◉" : "○"}
              </span>
              MetaMask
            </button>

            <button
              type="button"
              className={paymentProvider === "coinbase" ? "selected" : undefined}
              aria-pressed={paymentProvider === "coinbase"}
              disabled={connection.isPending || pay.isPending}
              onClick={() => {
                const walletOption =
                  data.data.wallets[1] ?? data.data.wallets[0];

                if (!walletOption) {
                  setNotice("Nenhuma carteira disponível.");
                  return;
                }

                setPaymentProvider("coinbase");
                setSelectedWalletId(walletOption.id);
                setNetwork("Ethereum Demo");
                connect(false);
                setReview(null);
                setNotice("Coinbase Wallet selecionada.");
              }}
            >
              <span aria-hidden="true">
                {paymentProvider === "coinbase" ? "◉" : "○"}
              </span>
              Coinbase Wallet
            </button>
          </div>

          <button
            className={`action checkout-confirm-action${
              connected && review && !changed
                ? " checkout-confirm-ready"
                : ""
            }${
              connection.isPending || pay.isPending
                ? " checkout-confirm-loading"
                : ""
            }`}
            aria-label={paymentActionName}
            aria-live="polite"
            disabled={
              connection.isPending ||
              pay.isPending ||
              data.isFetching
            }
            onClick={handlePaymentAction}
          >
            {connection.isPending
              ? "Conectando…"
              : pay.isPending
                ? "Processando…"
                : connected && review && !changed
                  ? "Finalizar compra"
                  : "Confirmar compra"}
          </button>
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
    <section className="receipt-page receipt-figma">
      <article className="receipt-confirmation-card">
        <a
          className="receipt-close"
          href="/"
          aria-label="Fechar confirmação"
        >
          ×
        </a>

        <header className="receipt-confirmation-header">
          <div className="receipt-thank-you-icon" aria-hidden="true">
            <span>THANK</span>
            <span>YOU</span>
          </div>

          <h1 className="visually-hidden">
            Compra confirmada
          </h1>

          <p>Seus NFTs agora estão na sua carteira</p>
        </header>

        <dl className="receipt-confirmation-metadata">
          <div>
            <dt>ID da transação</dt>
            <dd>{order.transaction.slice(0, 10)}…</dd>
          </div>

          <div>
            <dt>Data</dt>
            <dd>29 Jul. 2026</dd>
          </div>

          <div>
            <dt>Total</dt>
            <dd>{order.quote.total} ETH</dd>
          </div>

          <div>
            <dt>Carteira</dt>
            <dd>
              {order.walletSnapshot?.label ?? order.wallet}
            </dd>
          </div>
        </dl>

        <div className="receipt-confirmation-body">
          <h2>Detalhes da transação</h2>

          <div className="receipt-confirmation-labels">
            <span>NFTs</span>
            <span>Edições</span>
            <span>Subtotal</span>
          </div>

          <ul className="receipt-confirmation-items">
            {order.quote.lines.map((line) => (
              <li key={line.id}>
                <img
                  src={artSrc(line.nft.artworkId ?? line.nft.id)}
                  alt=""
                  width={46}
                  height={46}
                />

                <span>
                  <strong>{line.nft.title}</strong>
                  <small>
                    ID do token: #
                    {(
                      {
                        "1": "0042",
                        "2": "0009",
                        "3": "0552",
                        "4": "0118",
                        "5": "0314",
                        "6": "0088",
                        "7": "0207",
                        "8": "0160",
                      } as Record<string, string>
                    )[line.nft.artworkId ?? line.nft.id] ??
                      (line.nft.artworkId ?? line.nft.id).padStart(4, "0")}
                  </small>
                </span>

                <span>(× {line.quantity})</span>

                <strong>
                  {(Number(line.nft.price) * line.quantity).toFixed(2)} ETH
                </strong>
              </li>
            ))}
          </ul>

          <div className="receipt-confirmation-totals">
            <p>
              <span>Taxa de rede</span>
              <strong>{order.quote.fee} ETH</strong>
            </p>

            <p>
              <span>Total</span>
              <strong>{order.quote.total} ETH</strong>
            </p>
          </div>

          <p className="receipt-confirmation-message">
            Transação confirmada na Ethereum. A propriedade foi
            transferida para sua carteira conectada e registrada na rede.
          </p>

          <a
            className="action receipt-etherscan"
            href={`https://etherscan.io/tx/${order.transaction}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver no Etherscan
          </a>
        </div>

        <div className="receipt-confirmation-accent" aria-hidden="true" />
      </article>
    </section>
  );
}