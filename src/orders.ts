import { readWallets } from "./wallets.ts";
import { priceCart } from "./pricing.ts";
import { couponKey } from "./accounts.ts";

import { delay, http, HttpResponse } from "msw";
import { identity, expired, basketKey } from "./accounts.ts";
import { notifyOrder } from "./order-stream.ts";
import type { Cart, Quote, Order, Purchase } from "./model";

type Stored = {
  input: Purchase;
  order: Order;
  due?: number;
  outcome?: "confirmed" | "declined";
};

const failure = (message: string, status: number) =>
  HttpResponse.json({ message }, { status });
const walletFor = (owner: string) => "DEMO-" + owner;
const recordKey = (owner: string, id: string) =>
  "forma:order:" + owner + ":" + id;

function load(owner: string, id: string): Stored | null {
  return JSON.parse(localStorage.getItem(recordKey(owner, id)) || "null");
}
function save(owner: string, id: string, value: Stored) {
  localStorage.setItem(recordKey(owner, id), JSON.stringify(value));
}
function locked<T>(work: () => T): Promise<T> {
  if (globalThis.navigator?.locks) {
    return navigator.locks.request("forma:purchase", work);
  }
  return Promise.resolve(work());
}

function makeQuote(cart: Cart): Quote {
  const amounts = priceCart(
    cart.subtotal,
    cart.lines.length ? "0.01" : "0.00",
    cart.coupon ?? null,
  );
  const revision = JSON.stringify({
    lines: cart.lines.map((line) => [
      line.id,
      line.quantity,
      line.nft.price,
      line.nft.stock,
    ]),
    coupon: amounts.coupon,
    discount: amounts.discount,
    fee: amounts.fee,
    total: amounts.total,
  });
  return { ...cart, ...amounts, revision };
}

function findWallet(owner: string, walletId: unknown, network: unknown) {
  return readWallets(owner).find(
    (wallet) =>
      wallet.id === walletId &&
      (network === wallet.network || network === "Ethereum Testnet Demo"),
  );
}

export function orderHandlers(
  cart: (owner: string) => Cart,
  consume: (lines: Cart["lines"]) => void,
  stockOf: (id: string) => number,
) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function finish(owner: string, id: string): Order | null {
    const saved = load(owner, id);
    if (!saved) return null;
    const order = saved.order;
    if (order.status !== "pending" || Date.now() < (saved.due ?? 0))
      return order;
    const available = order.quote.lines.every(
      (l) => stockOf(l.id) >= l.quantity,
    );
    const approved = saved.outcome !== "declined" && available;
    if (approved) {
      consume(order.quote.lines);
      const key = basketKey(owner);
      const current = JSON.parse(localStorage.getItem(key) || "{}") as Record<
        string,
        number
      >;
      for (const line of order.quote.lines) {
        const remaining = Math.max(0, (current[line.id] || 0) - line.quantity);
        if (remaining > 0) current[line.id] = remaining;
        else delete current[line.id];
      }
      localStorage.setItem(key, JSON.stringify(current));
      if (Object.keys(current).length === 0)
        localStorage.removeItem(couponKey(owner));
    }
    order.status = approved ? "confirmed" : "declined";
    order.transaction = approved ? "SIM-" + crypto.randomUUID() : "";
    order.version = 2;
    save(owner, id, saved);
    notifyOrder(owner, id, 2);
    return order;
  }

  function schedule(owner: string, id: string, saved: Stored) {
    const key = recordKey(owner, id);
    if (saved.order.status !== "pending" || timers.has(key)) return;
    const remaining = Math.max(0, (saved.due ?? Date.now()) - Date.now());
    const timer = setTimeout(() => {
      timers.delete(key);
      void locked(() => finish(owner, id));
    }, remaining);
    timers.set(key, timer);
  }

  return [
    http.get("/api/checkout", ({ request }) => {
      const owner = identity(request);
      if (!owner || owner === "guest") return expired();
      const activeId = localStorage.getItem("forma:active-order:" + owner);
      const active = activeId ? load(owner, activeId)?.order : undefined;
      return HttpResponse.json({
        pendingOrderId: active?.status === "pending" ? active.id : null,
        wallet: walletFor(owner),
        wallets: readWallets(owner),
        quote: makeQuote(cart(owner)),
      });
    }),

    http.post("/api/checkout/connect", async ({ request }) => {
      const owner = identity(request);
      if (!owner || owner === "guest") return expired();

      const input = (await request.json().catch(() => null)) as {
        wallet?: unknown;
        network?: unknown;
        decline?: boolean;
      } | null;
      if (!findWallet(owner, input?.wallet, input?.network))
        return failure("Carteira ou rede inválida.", 422);
      if (input?.decline)
        return failure("Conexão recusada pela carteira simulada.", 422);
      return HttpResponse.json({ connected: true });
    }),

    http.post("/api/orders", async ({ request }) => {
      const owner = identity(request);
      if (!owner || owner === "guest") return expired();
      const id = request.headers.get("Idempotency-Key");
      if (!id || !/^[-\w]{1,80}$/.test(id))
        return failure("Tentativa inválida.", 422);
      const raw = (await request
        .json()
        .catch(() => null)) as Partial<Purchase> | null;
      if (
        !raw ||
        typeof raw.revision !== "string" ||
        typeof raw.wallet !== "string" ||
        typeof raw.network !== "string" ||
        (raw.outcome !== undefined &&
          raw.outcome !== "confirmed" &&
          raw.outcome !== "declined")
      )
        return failure("Dados da compra inválidos.", 422);
      const input: Purchase = {
        revision: raw.revision,
        wallet: raw.wallet,
        network: raw.network,
        outcome: raw.outcome === "declined" ? "declined" : "confirmed",
      };
      const result = await locked(() => {
        if (identity(request) !== owner) return expired();
        const old = load(owner, id);
        if (old) {
          const same =
            old.input.revision === input.revision &&
            old.input.wallet === input.wallet &&
            old.input.network === input.network &&
            (old.input.outcome ?? "confirmed") === input.outcome;
          if (!same)
            return failure("Tentativa já usada com outro conteúdo.", 409);
          const order = finish(owner, id)!;
          schedule(owner, id, old);
          return HttpResponse.json(order);
        }

        // Uma conta pode ter apenas um pagamento em processamento por vez.
        const activeKey = "forma:active-order:" + owner;
        const activeId = localStorage.getItem(activeKey);
        if (activeId) {
          const active = finish(owner, activeId);
          if (active?.status === "pending")
            return HttpResponse.json(
              {
                message: "Você já tem um pedido em processamento.",
                orderId: active.id,
              },
              { status: 409 },
            );
        }

        const selectedWallet = findWallet(owner, input.wallet, input.network);
        if (!selectedWallet) return failure("Carteira ou rede inválida.", 422);
        const quote = makeQuote(cart(owner));
        if (
          !quote.lines.length ||
          quote.revision !== input.revision ||
          quote.lines.some((l) => stockOf(l.id) < l.quantity)
        )
          return failure(
            "Carrinho ou disponibilidade mudou. Revise a cotação.",
            409,
          );

        const order: Order = {
          id,
          status: "pending",
          transaction: "",
          created: new Date().toISOString(),
          wallet: input.wallet,
          network: input.network,
          walletSnapshot: {
            id: selectedWallet.id,
            label: selectedWallet.label,
            address: selectedWallet.address,
            network: input.network,
          },
          quote,
          version: 1,
        };
        const saved: Stored = {
          input,
          order,
          due: Date.now() + 12000,
          outcome: input.outcome,
        };
        save(owner, id, saved);
        localStorage.setItem(activeKey, id);
        schedule(owner, id, saved);
        if (request.headers.get("X-Demo-Lost-Response") === "1")
          return HttpResponse.error();
        return HttpResponse.json(order, { status: 201 });
      });
      if (
        result.status === 201 &&
        request.headers.get("X-Demo-Lost-Response") === "timeout"
      )
        await delay(9_000);
      return result;
    }),

    http.get("/api/orders/:id", async ({ params, request }) => {
      const owner = identity(request);
      if (!owner || owner === "guest") return expired();
      const id = String(params.id);
      return locked(() => {
        const saved = load(owner, id);
        if (!saved) return failure("Pedido não encontrado.", 404);
        const order = finish(owner, id)!;
        schedule(owner, id, saved);
        return HttpResponse.json(order);
      });
    }),
  ];
}
