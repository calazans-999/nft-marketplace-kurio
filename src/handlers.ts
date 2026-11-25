import { seedDemoAccounts } from "./accounts.ts";
import { walletHandlers } from "./wallets.ts";
import { priceCart, CouponError, toWei, toEth } from "./pricing.ts";
import { couponKey } from "./accounts.ts";
import { favoriteHandlers } from "./favorites.ts";
import { orderStream } from "./order-stream.ts";
import { orderHandlers } from "./orders.ts";
import { accountHandlers, identity, basketKey, expired } from "./accounts.ts";
import { http, HttpResponse, delay } from "msw";
import { ws } from "msw";
import { toSocketIo } from "@mswjs/socket.io-binding";
import type { Nft } from "./model";
const fixtures: Nft[] = [
  {
    id: "1",
    title: "Emerald Ape #042",
    price: "1.19",
    stock: 2,
    artist: "Nova Sato",
    series: "Kurio Apes",
  },
  {
    id: "2",
    title: "Sage Nomad #009",
    price: "1.69",
    stock: 3,
    artist: "Noa Lima",
    series: "Nomads",
  },
  {
    id: "3",
    title: "Neon Vessel #552",
    price: "1.99",
    stock: 4,
    artist: "Lia Costa",
    series: "Kurio Apes",
  },
  {
    id: "4",
    title: "Cosmic Bloom #118",
    price: "1.29",
    stock: 5,
    artist: "Noa Lima",
    series: "Nomads",
  },
  {
    id: "5",
    title: "Violet Nomad #314",
    price: "1.39",
    stock: 6,
    artist: "Lia Costa",
    series: "Nomads",
  },
  {
    id: "6",
    title: "Ivory Baron #088",
    price: "1.79",
    stock: 7,
    artist: "Nova Sato",
    series: "Kurio Apes",
  },
  {
    id: "7",
    title: "Golden Beat #207",
    price: "0.99",
    stock: 8,
    artist: "Nova Sato",
    series: "Kurio Apes",
  },
  {
    id: "8",
    title: "Golden Signal #160",
    price: "0.39",
    stock: 9,
    artist: "Lia Costa",
    series: "Kurio Apes",
  },
];
const limited = fixtures.map((artwork) => ({
  ...artwork,
  id: artwork.id + "-limited",
  artworkId: artwork.id,
  edition: "Limitada",
  stock: 2,
}));
function inventory(): Nft[] {
  const stored: Nft[] =
    JSON.parse(localStorage.getItem("forma:inventory:v5") || "null") ??
    fixtures;
  return structuredClone([
    ...stored,
    ...limited.filter(
      (edition) => !stored.some((nft) => nft.id === edition.id),
    ),
  ]);
}
function saveInventory(items: Nft[]) {
  localStorage.setItem("forma:inventory:v5", JSON.stringify(items));
}
type Basket = Record<string, number>;

function read(key: string): Basket {
  return JSON.parse(localStorage.getItem(key) || "{}");
}
function quote(basket: Basket) {
  const lines = inventory()
    .filter((n) => basket[n.id] > 0)
    .map((nft) => ({ id: nft.id, nft, quantity: basket[nft.id] }));
  const amount = lines.reduce(
    (sum, line) => sum + toWei(line.nft.price) * BigInt(line.quantity),
    0n,
  );
  return { lines, subtotal: toEth(amount) };
}

function pricedBasket(owner: string) {
  const base = quote(read(basketKey(owner)));
  const code = base.lines.length
    ? localStorage.getItem(couponKey(owner))
    : null;
  const amounts = priceCart(
    base.subtotal,
    base.lines.length ? "0.01" : "0.00",
    code,
  );
  return { ...base, ...amounts };
}

const clients = new Set<ReturnType<typeof toSocketIo>["client"]>();
let version = 0;
type NftUpdate = { id: string; resourceId: string; version: number };
const priceUpdates: NftUpdate[] = [];

function emitNftUpdate(event: NftUpdate) {
  for (const client of clients) client.emit("nft.updated", event);
}

function announceNft(resourceId: string) {
  const event = { id: crypto.randomUUID(), resourceId, version: ++version };
  emitNftUpdate(event);
  return event;
}

type CatalogFailureGate = {
  wait: Promise<void>;
  release: () => void;
  started: boolean;
};

let catalogFailure: CatalogFailureGate | undefined;

type CatalogRace = {
  phase: "armed" | "waiting" | "finished";
  wait: Promise<void>;
  release: () => void;
};
let catalogRace: CatalogRace | undefined;

let nextCatalogFailure: "network" | "timeout" | undefined;

export const handlers = [
  http.post("/api/demo/fixtures", async () => {
    await seedDemoAccounts();
    return HttpResponse.json({ ready: true });
  }),
  http.post("/api/demo/reset", () => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("forma:")) localStorage.removeItem(key);
    }
    priceUpdates.length = 0;
    catalogFailure?.release();
    catalogFailure = undefined;
    catalogRace?.release();
    catalogRace = undefined;
    nextCatalogFailure = undefined;
    return HttpResponse.json({ reset: true });
  }),
  http.post("/api/demo/network-error", () => {
    nextCatalogFailure = "network";
    return HttpResponse.json({ armed: true });
  }),
  http.post("/api/demo/catalog-race/:action", ({ params }) => {
    if (params.action === "arm") {
      catalogRace?.release();
      let release!: () => void;
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      catalogRace = { phase: "armed", wait, release };
      return HttpResponse.json({ phase: "armed" });
    }
    if (params.action === "release") {
      catalogRace?.release();
    } else if (params.action !== "status") {
      return HttpResponse.json(
        { message: "Ação desconhecida." },
        { status: 400 },
      );
    }
    return HttpResponse.json({ phase: catalogRace?.phase ?? "idle" });
  }),
  http.post("/api/demo/catalog-failure/:action", ({ params }) => {
    if (params.action === "arm") {
      catalogFailure?.release();
      let release!: () => void;
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      catalogFailure = { wait, release, started: false };
      return HttpResponse.json({ armed: true });
    }

    if (params.action === "status") {
      return HttpResponse.json({ started: catalogFailure?.started ?? false });
    }

    if (params.action === "release") {
      catalogFailure?.release();
      catalogFailure = undefined;
      return HttpResponse.json({ released: true });
    }

    return HttpResponse.json(
      { message: "Ação desconhecida." },
      { status: 400 },
    );
  }),
  http.post("/api/demo/timeout", () => {
    nextCatalogFailure = "timeout";
    return HttpResponse.json({ armed: true });
  }),
  ...walletHandlers,
  http.put("/api/cart-coupon", async ({ request }) => {
    const owner = identity(request);
    if (!owner) return expired();
    const body = (await request.json()) as { code?: unknown } | null;
    if (typeof body?.code !== "string") {
      return HttpResponse.json(
        { code: "INVALID_COUPON", message: "Cupom inválido." },
        { status: 422 },
      );
    }

    const base = quote(read(basketKey(owner)));
    if (!base.lines.length) {
      return HttpResponse.json(
        { message: "Adicione uma obra antes de aplicar o cupom." },
        { status: 409 },
      );
    }
    try {
      const amounts = priceCart(base.subtotal, "0.01", body.code);
      localStorage.setItem(couponKey(owner), amounts.coupon!);
      return HttpResponse.json({ ...base, ...amounts });
    } catch (error) {
      if (!(error instanceof CouponError)) throw error;
      return HttpResponse.json(
        { code: error.code, message: error.message },
        { status: 422 },
      );
    }
  }),
  http.delete("/api/cart-coupon", ({ request }) => {
    const owner = identity(request);
    if (!owner) return expired();
    localStorage.removeItem(couponKey(owner));
    return HttpResponse.json(pricedBasket(owner));
  }),
  ...favoriteHandlers((id) =>
    inventory().some((nft) => !nft.artworkId && nft.id === id),
  ),
  orderStream,
  ...orderHandlers(
    (owner) => pricedBasket(owner),
    (lines) => {
      const nfts = inventory();
      for (const line of lines) {
        const nft = nfts.find((n) => n.id === line.id)!;
        nft.stock -= line.quantity;
      }
      saveInventory(nfts);
      for (const line of lines) announceNft(line.nft.artworkId ?? line.id);
    },
    (id: string) => inventory().find((n) => n.id === id)?.stock ?? 0,
  ),
  ...accountHandlers((id) => inventory().find((n) => n.id === id)?.stock ?? 0),
  ws
    .link(
      typeof window === "undefined"
        ? "ws://localhost"
        : window.location.origin.replace(/^http/, "ws"),
    )
    .addEventListener("connection", (connection) => {
      const { client } = toSocketIo(connection);
      clients.add(client);
      connection.client.addEventListener("close", () => clients.delete(client));
    }),
  http.post("/api/demo/sold-out", () => {
    const catalog = inventory();
    const nft = catalog.find((item) => item.id === "1");
    if (!nft)
      return HttpResponse.json(
        { message: "Obra não encontrada." },
        { status: 404 },
      );

    nft.stock = 0;
    saveInventory(catalog);

    return HttpResponse.json(announceNft(nft.id));
  }),
  http.post("/api/demo/price", () => {
    const nfts = inventory();
    const nft = nfts[0];
    nft.price = nft.price === "1.19" ? "1.29" : "1.19";
    saveInventory(nfts);
    const event = announceNft(nft.id);
    priceUpdates.push(event);
    if (priceUpdates.length > 2) priceUpdates.shift();
    return HttpResponse.json(event);
  }),
  http.post("/api/demo/replay-price", () => {
    for (const event of [...priceUpdates].reverse()) emitNftUpdate(event);
    return HttpResponse.json({ replayed: priceUpdates.length });
  }),
  http.get("/api/nfts", async ({ request }) => {
    const failure = nextCatalogFailure;
    nextCatalogFailure = undefined;
    if (failure === "network") return HttpResponse.error();
    if (failure === "timeout") await delay(9_000);
    const gate = catalogFailure;
    if (gate && !gate.started && !request.signal.aborted) {
      gate.started = true;
      await gate.wait;
      return HttpResponse.json(
        { message: "Catálogo temporariamente indisponível." },
        { status: 503 },
      );
    }
    const p = new URL(request.url).searchParams;
    const q = (p.get("q") || "").toLocaleLowerCase("pt-BR");
    const list = inventory().filter(
      (n) =>
        !n.artworkId &&
        n.title.toLocaleLowerCase("pt-BR").includes(q) &&
        (!p.get("series") || p.get("series") === n.series),
    );
    if (p.get("sort") === "price")
      list.sort((a, b) => {
        const difference = toWei(a.price) - toWei(b.price);
        return difference < 0n ? -1 : difference > 0n ? 1 : 0;
      });
    const pageSize = Math.min(
      8,
      Math.max(1, Number(p.get("limit")) || 4),
    );
    const start =
      (Math.max(1, Number(p.get("page")) || 1) - 1) * pageSize;
    await delay(180);
    const race = catalogRace;
    if (
      race?.phase === "armed" &&
      new URL(request.url).searchParams.get("q") === "Sage"
    ) {
      race.phase = "waiting";
      await race.wait;
      race.phase = "finished";
    }
    return HttpResponse.json({
      items: list.slice(start, start + pageSize),
      total: list.length,
    });
  }),
  http.get("/api/nfts/:id", ({ params }) => {
    const items = inventory();
    const nft = items.find((n) => !n.artworkId && n.id === params.id);
    return nft
      ? HttpResponse.json({
          ...nft,
          editions: [nft, ...items.filter((n) => n.artworkId === nft.id)],
        })
      : HttpResponse.json({ message: "Obra não encontrada." }, { status: 404 });
  }),
  http.get("/api/cart", ({ request }) => {
    const owner = identity(request);
    return owner ? HttpResponse.json(pricedBasket(owner)) : expired();
  }),
  http.put("/api/cart/:id", async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as {
      quantity?: unknown;
      mode?: unknown;
    } | null;
    if (
      !body ||
      typeof body.quantity !== "number" ||
      !Number.isSafeInteger(body.quantity) ||
      body.quantity < 0 ||
      (body.mode === "add" && body.quantity === 0) ||
      (body.mode !== undefined && body.mode !== "add")
    ) {
      return HttpResponse.json(
        { message: "Quantidade inválida." },
        { status: 422 },
      );
    }
    const nft = inventory().find((n) => n.id === params.id);
    if (!nft)
      return HttpResponse.json(
        { message: "Obra não encontrada." },
        { status: 404 },
      );
    const owner = identity(request);
    if (!owner) return expired();
    const key = basketKey(owner);
    const basket = read(key);
    const quantity =
      body.mode === "add"
        ? (basket[nft.id] || 0) + body.quantity
        : body.quantity;
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > nft.stock)
      return HttpResponse.json(
        { message: "Quantidade fora do estoque disponível." },
        { status: 409 },
      );
    if (quantity === 0) delete basket[nft.id];
    else basket[nft.id] = quantity;
    localStorage.setItem(key, JSON.stringify(basket));

    if (Object.keys(basket).length === 0)
      localStorage.removeItem(couponKey(owner));
    return HttpResponse.json(pricedBasket(owner));
  }),
];
