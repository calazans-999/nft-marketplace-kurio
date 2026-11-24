import { priceCart, CouponError } from "../src/pricing.ts";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { setupServer } from "msw/node";
import { handlers } from "../src/handlers.ts";
const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    removeItem: (k: string) => {
      memory.delete(k);
    },
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
  },
});
// Resolve the browser-relative paths against this test origin.
Object.defineProperty(globalThis, "location", {
  value: new URL("http://localhost"),
});
const server = setupServer(...handlers);
before(() => server.listen({ onUnhandledRequest: "error" }));
after(() => server.close());
const url = (p: string) => "http://localhost/api/" + p;
test("catálogo combina filtros e paginação", async () => {
  const list = await (await fetch(url("nfts?series=Ondas&sort=price"))).json();
  assert.equal(list.total, 3);
  assert.deepEqual(
    list.items.map((n: { price: string }) => n.price),
    ["0.14", "0.18", "0.26"],
  );
  assert.equal(
    (await (await fetch(url("nfts?page=2"))).json()).items.length,
    2,
  );
  assert.equal((await fetch(url("nfts/absent"))).status, 404);
});
test("limite de estoque, subtotal exato e remoção", async () => {
  const edit = (quantity: number) =>
    fetch(url("cart/1"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
  assert.equal((await (await edit(2)).json()).subtotal, "0.64");
  assert.equal((await edit(3)).status, 409);
  assert.equal((await (await fetch(url("cart"))).json()).subtotal, "0.64");
  assert.equal((await (await edit(0)).json()).subtotal, "0.00");
});
test(
  "nft.updated chega ao socket.io-client e coincide com REST",
  { timeout: 5000 },
  async () => {
    const { default: io } =
      await import("../node_modules/socket.io-client/dist/socket.io.js");
    const socket = io("http://localhost", {
      transports: ["websocket"],
      autoConnect: false,
      reconnection: false,
    });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
        socket.connect();
      });
      const event = new Promise<{
        id: string;
        resourceId: string;
        version: number;
      }>((resolve) => socket.once("nft.updated", resolve));
      const response = await (
        await fetch(url("demo/price"), { method: "POST" })
      ).json();
      assert.deepEqual(await event, response);
      assert.equal((await (await fetch(url("nfts/1"))).json()).price, "0.36");
    } finally {
      socket.disconnect();
    }
  },
);
test("cadastro, conflito, login, retomada, logout e isolamento", async () => {
  const post = (path: string, body: unknown) =>
    fetch(url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const first = {
    name: "Ana",
    email: "ana@example.test",
    password: "Colecao123",
  };
  const second = { ...first, name: "Bia", email: "bia@example.test" };
  assert.equal((await post("accounts", first)).status, 201);
  assert.equal((await post("accounts", first)).status, 409);
  assert.equal((await post("accounts", second)).status, 201);
  assert.equal(
    (await post("login", { ...first, password: "invalida" })).status,
    401,
  );
  await fetch(url("cart/1"), {
    method: "PUT",
    body: JSON.stringify({ quantity: 2 }),
  });
  const login = async (credentials: typeof first) => ({
    Authorization:
      "Bearer " + (await (await post("login", credentials)).json()).token,
  });
  const a = await login(first);
  const cart = async (headers: Record<string, string>) =>
    (await (await fetch(url("cart"), { headers })).json()).lines;
  assert.equal((await cart(a))[0].quantity, 2);
  assert.equal((await cart({})).length, 0);
  assert.equal(
    (await (await fetch(url("session"), { headers: a })).json()).name,
    "Ana",
  );
  assert.equal(
    (await fetch(url("session"), { method: "DELETE", headers: a })).status,
    204,
  );
  assert.equal((await fetch(url("cart"), { headers: a })).status, 401);
  const b = await login(second);
  assert.equal((await cart(b)).length, 0);
  assert.equal((await cart(await login(first)))[0].quantity, 2);
});
test("cotação vencida, resposta perdida, recuperação idempotente e recibo privado", async (t) => {
  const startedAt = Date.now();
  t.mock.timers.enable({ apis: ["Date"], now: startedAt });
  const body = {
    name: "Cris",
    email: "cris@example.test",
    password: "Colecao123",
  };
  const post = (
    path: string,
    data: unknown,
    headers: Record<string, string> = {},
  ) =>
    fetch(url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(data),
    });
  await post("accounts", body);
  const { token } = await (await post("login", body)).json();
  const headers = {
    Authorization: "Bearer " + token,
    "Idempotency-Key": "ordem-03",
  };
  await fetch(url("cart/1"), {
    method: "PUT",
    headers,
    body: JSON.stringify({ quantity: 1 }),
  });
  const checkout = async () =>
    await (await fetch(url("checkout"), { headers })).json();
  const input = async () => {
    const { wallet, quote } = await checkout();
    return { wallet, network: "Ethereum Demo", revision: quote.revision };
  };
  const stale = await input();
  await post("demo/price", {});
  assert.equal((await post("orders", stale, headers)).status, 409);
  const current = await input();
  const expected = (await checkout()).quote;
  await assert.rejects(
    post("orders", current, { ...headers, "X-Demo-Lost-Response": "1" }),
  );
  // A primeira resposta se perdeu. Reenviar a mesma tentativa recupera o pedido.
  const recoveredPending = await (
    await post("orders", current, headers)
  ).json();
  assert.equal(recoveredPending.status, "pending");
  assert.equal(recoveredPending.id, headers["Idempotency-Key"]);
  assert.equal(recoveredPending.transaction, "");
  assert.deepEqual(recoveredPending.quote, expected);
  assert.deepEqual((await checkout()).quote.lines, expected.lines);

  // A API reconcilia a tentativa após o prazo e devolve o resultado terminal.
  t.mock.timers.setTime(Date.now() + 12_001);
  const first = await (await post("orders", current, headers)).json();
  const again = await (await post("orders", current, headers)).json();
  assert.equal(first.status, "confirmed");
  assert.equal(first.transaction, again.transaction);
  assert.deepEqual(first.quote, expected);
  assert.equal((await checkout()).quote.lines.length, 0);
  assert.equal(
    (await (await fetch(url("nfts/1"))).json()).stock,
    expected.lines[0].nft.stock - 1,
  );
  assert.equal((await post("orders", stale, headers)).status, 409);
  await post("demo/price", {});
  assert.deepEqual(
    (await (await fetch(url("orders/" + first.id), { headers })).json()).quote,
    expected,
  );
  const other = await (
    await post("login", { email: "bia@example.test", password: "Colecao123" })
  ).json();
  assert.equal(
    (
      await fetch(url("orders/" + first.id), {
        headers: { Authorization: "Bearer " + other.token },
      })
    ).status,
    404,
  );
});

test("pedido recusado preserva o carrinho e o estoque após nova consulta", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });

  const credentials = {
    name: "Teste Recusa",
    email: "recusa-etapa04@example.test",
    password: "Colecao123",
  };

  async function postJson(path, body, headers = {}) {
    return fetch(url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  assert.equal((await postJson("accounts", credentials)).status, 201);
  const login = await postJson("login", credentials);
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const auth = { Authorization: "Bearer " + token };

  const itemId = "4";
  const readStock = async () =>
    (await (await fetch(url("nfts/" + itemId))).json()).stock;
  const readCart = async () =>
    (await fetch(url("cart"), { headers: auth })).json();

  const stockBefore = await readStock();
  const add = await fetch(url("cart/" + itemId), {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ quantity: 1 }),
  });
  assert.equal(add.status, 200);
  const cartBefore = await readCart();

  const checkout = await fetch(url("checkout"), { headers: auth });
  assert.equal(checkout.status, 200);
  const { wallet, quote } = await checkout.json();
  const input = {
    wallet,
    network: "Ethereum Demo",
    revision: quote.revision,
    outcome: "declined",
  };
  const headers = { ...auth, "Idempotency-Key": "recusa-etapa-04" };

  const created = await postJson("orders", input, headers);
  assert.equal(created.status, 201);
  const pending = await created.json();
  assert.equal(pending.status, "pending");

  const getOrder = async () => {
    const response = await fetch(url("orders/" + pending.id), {
      headers: auth,
    });
    assert.equal(response.status, 200);
    return response.json();
  };

  assert.equal((await getOrder()).status, "pending");
  t.mock.timers.setTime(Date.now() + 12_001);

  const refused = await getOrder();
  assert.equal(refused.id, pending.id);
  assert.equal(refused.status, "declined");
  assert.equal(refused.transaction, "");

  const repeated = await postJson("orders", input, headers);
  assert.equal(repeated.status, 200);
  assert.deepEqual(await repeated.json(), refused);
  assert.deepEqual(await getOrder(), refused);
  assert.deepEqual(await readCart(), cartBefore);
  assert.equal(await readStock(), stockBefore);
});

test("favoritos persistem por conta e permitem inclusão e remoção", async () => {
  const contaA = {
    name: "Colecionadora A",
    email: "favoritos-a@example.test",
    password: "Colecao123",
  };
  const contaB = {
    ...contaA,
    name: "Colecionador B",
    email: "favoritos-b@example.test",
  };

  async function postAccount(path: string, body: typeof contaA) {
    return fetch(url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function login(body: typeof contaA) {
    const response = await postAccount("login", body);
    assert.equal(response.status, 200);
    const { token } = await response.json();
    return { Authorization: "Bearer " + token };
  }

  async function list(headers: Record<string, string>) {
    const response = await fetch(url("favorites"), { headers });
    assert.equal(response.status, 200);
    return (await response.json()).ids;
  }

  for (const method of ["GET", "PUT", "DELETE"]) {
    const path = method === "GET" ? "favorites" : "favorites/1";
    assert.equal((await fetch(url(path), { method })).status, 401);
  }

  assert.equal((await postAccount("accounts", contaA)).status, 201);
  assert.equal((await postAccount("accounts", contaB)).status, 201);
  const a = await login(contaA);
  const b = await login(contaB);

  assert.deepEqual(await list(a), []);
  const missing = await fetch(url("favorites/inexistente"), {
    method: "PUT",
    headers: a,
  });
  assert.equal(missing.status, 404);

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const added = await fetch(url("favorites/1"), {
      method: "PUT",
      headers: a,
    });
    assert.equal(added.status, 200);
  }
  assert.deepEqual(await list(a), ["1"]);
  assert.deepEqual(await list(b), []);

  assert.equal(
    (await fetch(url("session"), { method: "DELETE", headers: a })).status,
    204,
  );
  assert.equal((await fetch(url("favorites"), { headers: a })).status, 401);

  const novaSessaoA = await login(contaA);
  assert.deepEqual(await list(novaSessaoA), ["1"]);
  const removed = await fetch(url("favorites/1"), {
    method: "DELETE",
    headers: novaSessaoA,
  });
  assert.equal(removed.status, 200);
  assert.deepEqual(await list(novaSessaoA), []);
});

test("cotação sem cupom preserva o total original", () => {
  assert.deepEqual(priceCart("0.32", "0.01"), {
    subtotal: "0.32",
    coupon: null,
    discount: "0.00",
    fee: "0.01",
    total: "0.33",
  });
});

test("cupom desconta somente as obras e mantém precisão até o wei", () => {
  assert.deepEqual(priceCart("0.32", "0.01", " forma10 "), {
    subtotal: "0.32",
    coupon: "FORMA10",
    discount: "0.032",
    fee: "0.01",
    total: "0.298",
  });

  const tiny = priceCart("0.000000000000000019", "0.00", "FORMA10");
  assert.equal(tiny.discount, "0.000000000000000001");
  assert.equal(tiny.total, "0.000000000000000018");
});

test("cotação distingue cupom inválido de expirado no instante de validade", () => {
  const expiry = Date.UTC(2025, 0, 1);

  for (const code of ["DESCONHECIDO", "   "]) {
    assert.throws(
      () => priceCart("0.32", "0.01", code, expiry),
      (error: unknown) =>
        error instanceof CouponError && error.code === "INVALID_COUPON",
    );
  }

  assert.equal(
    priceCart("0.32", "0.01", "EXPIRADO10", expiry - 1).discount,
    "0.032",
  );
  assert.throws(
    () => priceCart("0.32", "0.01", "EXPIRADO10", expiry),
    (error: unknown) =>
      error instanceof CouponError && error.code === "EXPIRED_COUPON",
  );
});

test("cupom acompanha o visitante até o recibo e invalida a revisão antiga", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });

  async function jsonRequest(
    path: string,
    method: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    return fetch(url(path), {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  // Define o cenário desta compra sem depender do preço deixado por outro teste.
  memory.clear();
  const added = await jsonRequest("cart/1", "PUT", { quantity: 1 });
  assert.equal(added.status, 200);

  const applied = await jsonRequest("cart-coupon", "PUT", {
    code: " forma10 ",
  });
  assert.equal(applied.status, 200);
  const basket = await applied.json();
  assert.equal(basket.coupon, "FORMA10");
  assert.equal(basket.discount, "0.032");
  assert.equal(basket.total, "0.298");

  for (const [code, expected] of [
    ["NAOEXISTE", "INVALID_COUPON"],
    ["EXPIRADO10", "EXPIRED_COUPON"],
  ]) {
    const rejected = await jsonRequest("cart-coupon", "PUT", { code });
    assert.equal(rejected.status, 422);
    assert.equal((await rejected.json()).code, expected);
  }
  assert.equal((await (await fetch(url("cart"))).json()).coupon, "FORMA10");

  const credentials = {
    name: "Compra Cupom",
    email: "cupom@example.test",
    password: "Colecao123",
  };
  assert.equal(
    (await jsonRequest("accounts", "POST", credentials)).status,
    201,
  );
  const login = await jsonRequest("login", "POST", credentials);
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const auth = { Authorization: "Bearer " + token };

  const checkout = async () => {
    const response = await fetch(url("checkout"), { headers: auth });
    assert.equal(response.status, 200);
    return response.json();
  };

  const original = await checkout();
  assert.equal(original.quote.total, "0.298");
  assert.equal(original.quote.coupon, "FORMA10");

  const removed = await jsonRequest("cart-coupon", "DELETE", undefined, auth);
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).total, "0.33");

  const create = (revision: string, key: string) =>
    jsonRequest(
      "orders",
      "POST",
      {
        revision,
        wallet: original.wallet,
        network: "Ethereum Demo",
      },
      { ...auth, "Idempotency-Key": key },
    );

  assert.equal(
    (await create(original.quote.revision, "cupom-antigo")).status,
    409,
  );

  assert.equal(
    (await jsonRequest("cart-coupon", "PUT", { code: "FORMA10" }, auth)).status,
    200,
  );
  const fresh = await checkout();
  const placed = await create(fresh.quote.revision, "compra-com-cupom");
  assert.equal(placed.status, 201);
  const pending = await placed.json();
  assert.equal(pending.status, "pending");

  t.mock.timers.setTime(Date.now() + 12_001);
  const receipt = await fetch(url("orders/" + pending.id), { headers: auth });
  assert.equal(receipt.status, 200);
  const order = await receipt.json();
  assert.equal(order.status, "confirmed");
  assert.deepEqual(order.quote, fresh.quote);
  assert.equal(order.quote.total, "0.298");

  const empty = await (await fetch(url("cart"), { headers: auth })).json();
  assert.equal(empty.lines.length, 0);
  assert.equal(empty.coupon, null);
  assert.equal(empty.total, "0.00");
});

test("carteiras persistem por conta e validam endereço e duplicidade", async () => {
  const accountA = {
    name: "Carteira A",
    email: "wallet-a@example.test",
    password: "Colecao123",
  };
  const accountB = {
    ...accountA,
    name: "Carteira B",
    email: "wallet-b@example.test",
  };

  async function send(
    path: string,
    method: string,
    body?: unknown,
    token?: string,
  ) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(url(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function login(account: typeof accountA): Promise<string> {
    const result = await send("login", "POST", account);
    assert.equal(result.status, 200);
    return (await result.json()).token;
  }

  async function list(token: string) {
    const result = await send("wallets", "GET", undefined, token);
    assert.equal(result.status, 200);
    return (await result.json()).wallets;
  }

  const primary = {
    label: "Minha principal",
    address: "0x" + "a".repeat(40),
    network: "Ethereum Demo",
  };
  const secondary = {
    ...primary,
    label: "Reserva",
    address: "0x" + "b".repeat(40),
  };

  assert.equal((await send("wallets", "GET")).status, 401);
  assert.equal((await send("wallets/primary", "PUT", primary)).status, 401);
  assert.equal((await send("accounts", "POST", accountA)).status, 201);
  assert.equal((await send("accounts", "POST", accountB)).status, 201);

  const a = await login(accountA);
  const b = await login(accountB);
  const [original] = await list(a);
  const beforeB = await list(b);

  assert.equal(original.slot, "primary");
  assert.match(original.address, /^0x[0-9a-fA-F]{40}$/);
  assert.equal(beforeB.length, 1);
  assert.notEqual(original.id, beforeB[0].id);

  const invalid = await send(
    "wallets/primary",
    "PUT",
    { ...primary, address: "0x12" },
    a,
  );
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).field, "address");
  assert.deepEqual(await list(a), [original]);

  const edited = await send("wallets/primary", "PUT", primary, a);
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).id, original.id);

  const duplicate = await send(
    "wallets/secondary",
    "PUT",
    {
      ...secondary,
      address: "0x" + "A".repeat(40),
    },
    a,
  );
  assert.equal(duplicate.status, 409);

  const created = await send("wallets/secondary", "PUT", secondary, a);
  assert.equal(created.status, 201);
  const saved = await created.json();
  assert.notEqual(saved.id, original.id);

  const renamed = await send(
    "wallets/secondary",
    "PUT",
    {
      ...secondary,
      label: "Reserva pessoal",
    },
    a,
  );
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).id, saved.id);

  assert.equal((await send("session", "DELETE", undefined, a)).status, 204);
  const restored = await list(await login(accountA));
  assert.equal(restored.length, 2);
  assert.equal(restored[0].address, primary.address);
  assert.equal(restored[1].label, "Reserva pessoal");
  assert.equal(restored[1].address, secondary.address);
  assert.deepEqual(await list(b), beforeB);
});

test("perfil atualiza identidade e avatar sem alterar outra conta", async () => {
  async function send(
    path: string,
    method: string,
    body?: unknown,
    token?: string,
  ) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = "Bearer " + token;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(url(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  const a = {
    name: "Perfil A",
    email: "perfil-a@example.test",
    password: "Colecao123",
  };
  const b = { ...a, name: "Perfil B", email: "perfil-b@example.test" };

  async function login(credentials: typeof a): Promise<string> {
    const response = await send("login", "POST", credentials);
    assert.equal(response.status, 200);
    return (await response.json()).token;
  }

  async function profile(token: string) {
    const response = await send("profile", "GET", undefined, token);
    assert.equal(response.status, 200);
    return response.json();
  }

  assert.equal((await send("profile", "GET")).status, 401);
  assert.equal(
    (await send("profile", "PATCH", { name: "Visitante" })).status,
    401,
  );

  assert.equal((await send("accounts", "POST", a)).status, 201);
  assert.equal((await send("accounts", "POST", b)).status, 201);
  const tokenA = await login(a);
  const tokenB = await login(b);
  const original = await profile(tokenA);
  const originalB = await profile(tokenB);

  assert.equal(original.avatarId, null);
  assert.deepEqual(Object.keys(original).sort(), [
    "avatarId",
    "email",
    "id",
    "name",
  ]);

  const conflict = await send(
    "profile",
    "PATCH",
    {
      name: "Nome provisório",
      email: b.email,
    },
    tokenA,
  );
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).field, "email");
  assert.deepEqual(await profile(tokenA), original);

  for (const [field, value] of [
    ["name", " "],
    ["email", "invalido"],
    ["avatarId", "99"],
  ]) {
    const invalid = await send("profile", "PATCH", { [field]: value }, tokenA);
    assert.equal(invalid.status, 422);
    assert.equal((await invalid.json()).field, field);
  }
  assert.deepEqual(await profile(tokenA), original);

  const updated = await send(
    "profile",
    "PATCH",
    {
      name: "  Colecionador A  ",
      email: "  PERFIL-NOVO@example.test ",
      avatarId: "3",
    },
    tokenA,
  );
  assert.equal(updated.status, 200);
  const saved = await updated.json();
  assert.deepEqual(saved, {
    id: original.id,
    name: "Colecionador A",
    email: "perfil-novo@example.test",
    avatarId: "3",
  });
  assert.deepEqual(await profile(tokenB), originalB);

  assert.equal(
    (await send("session", "DELETE", undefined, tokenA)).status,
    204,
  );
  assert.equal((await send("login", "POST", a)).status, 401);

  const newToken = await login({ ...a, email: saved.email });
  assert.deepEqual(await profile(newToken), saved);

  const cleared = await send("profile", "PATCH", { avatarId: null }, newToken);
  assert.equal(cleared.status, 200);
  assert.deepEqual(await profile(newToken), { ...saved, avatarId: null });
});

test("alteração de senha valida credenciais e encerra as outras sessões da conta", async () => {
  async function send(
    path: string,
    method: string,
    body?: unknown,
    token?: string,
  ) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = "Bearer " + token;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    return fetch(url(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  const a = {
    name: "Senha A",
    email: "senha-a@example.test",
    password: "Inicial123",
  };
  const b = { ...a, name: "Senha B", email: "senha-b@example.test" };
  const novaSenha = "NovaSenha456";

  async function login(account: typeof a): Promise<string> {
    const response = await send("login", "POST", account);
    assert.equal(response.status, 200);
    return (await response.json()).token;
  }

  const change = (
    currentPassword: string,
    newPassword: string,
    token?: string,
  ) =>
    send("profile/password", "PATCH", { currentPassword, newPassword }, token);

  assert.equal((await change(a.password, novaSenha)).status, 401);
  assert.equal((await send("accounts", "POST", a)).status, 201);
  assert.equal((await send("accounts", "POST", b)).status, 201);

  const principal = await login(a);
  const outraSessao = await login(a);
  const sessaoB = await login(b);
  const perfilAntes = await (
    await send("profile", "GET", undefined, principal)
  ).json();

  for (const [atual, nova, campo] of [
    ["Errada123", novaSenha, "currentPassword"],
    [a.password, "curta", "newPassword"],
    [a.password, a.password, "newPassword"],
  ]) {
    const invalid = await change(atual, nova, principal);
    assert.equal(invalid.status, 422);
    assert.equal((await invalid.json()).field, campo);
  }

  assert.equal(
    (await send("session", "GET", undefined, outraSessao)).status,
    200,
  );

  const changed = await change(a.password, novaSenha, principal);
  assert.equal(changed.status, 204);
  assert.equal(await changed.text(), "");

  assert.equal(
    (await send("session", "GET", undefined, principal)).status,
    200,
  );
  assert.equal(
    (await send("session", "GET", undefined, outraSessao)).status,
    401,
  );
  assert.equal((await send("session", "GET", undefined, sessaoB)).status, 200);
  assert.equal((await send("login", "POST", a)).status, 401);

  const freshToken = await login({ ...a, password: novaSenha });
  const perfilDepois = await (
    await send("profile", "GET", undefined, freshToken)
  ).json();
  assert.deepEqual(perfilDepois, perfilAntes);
});

test("edições de uma obra têm estoque e linhas de carrinho independentes", async () => {
  memory.clear();
  const detail = await fetch(url("nfts/1"));
  assert.equal(detail.status, 200);
  const { editions } = await detail.json();
  assert.deepEqual(
    editions.map((edition) => edition.id),
    ["1", "1-limited"],
  );

  const setQuantity = (id, quantity) =>
    fetch(url("cart/" + id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
  assert.equal((await setQuantity("1", "2")).status, 422);
  assert.equal((await setQuantity("1", 1.5)).status, 422);
  assert.equal((await setQuantity("1", 2)).status, 200);
  assert.equal((await setQuantity("1-limited", 3)).status, 409);
  const added = await setQuantity("1-limited", 1);
  assert.equal(added.status, 200);
  const basket = await added.json();
  assert.deepEqual(
    basket.lines.map((line) => [line.id, line.quantity]),
    [
      ["1", 2],
      ["1-limited", 1],
    ],
  );

  const removed = await setQuantity("1", 0);
  assert.equal(removed.status, 200);
  assert.deepEqual(
    (await removed.json()).lines.map((line) => line.id),
    ["1-limited"],
  );
});
