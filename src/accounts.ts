import { http, HttpResponse } from "msw";
export type Collector = { id: string; name: string; email: string };
type RecordData = Collector & {
  avatarId?: string | null;
  salt: string;
  digest: string;
};
type Session = { id: string; expires: number };
const accountsKey = "forma:accounts:v2";
const sessionsKey = "forma:sessions:v2";
const records = (): RecordData[] =>
  JSON.parse(localStorage.getItem(accountsKey) || "[]");
const sessions = (): Record<string, Session> =>
  JSON.parse(localStorage.getItem(sessionsKey) || "{}");
const error = (message: string, status: number) =>
  HttpResponse.json({ message }, { status });
function publicData({ id, name, email }: RecordData): Collector {
  return { id, name, email };
}
async function digest(password: string, salt: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: enc.encode(salt),
      iterations: 120000,
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(hash), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export function identity(request: Request) {
  const header = request.headers.get("Authorization");
  if (!header) return "guest";
  const token = header.replace(/^Bearer /, "");
  const session = sessions()[token];
  return session && session.expires > Date.now() ? session.id : null;
}
export const expired = () => error("Sua sessão expirou. Entre novamente.", 401);
export function couponKey(owner: string) {
  return basketKey(owner) + ":coupon";
}

export function basketKey(owner: string) {
  return owner === "guest" ? "forma:guest-cart:v1" : "forma:cart:" + owner;
}
export async function seedDemoAccounts() {
  const templates = [
    { name: "Colecionadora Demo A", email: "demo-a@example.test" },
    { name: "Colecionador Demo B", email: "demo-b@example.test" },
  ];
  const candidates = await Promise.all(
    templates.map(async (account) => {
      const salt = crypto.randomUUID();
      return {
        ...account,
        id: crypto.randomUUID(),
        salt,
        digest: await digest("DemoForma123", salt),
      };
    }),
  );
  const accounts = records();
  const missing = candidates.filter(
    (candidate) =>
      !accounts.some((account) => account.email === candidate.email),
  );
  if (missing.length)
    localStorage.setItem(
      accountsKey,
      JSON.stringify([...accounts, ...missing]),
    );
}

export function accountHandlers(stock: (id: string) => number) {
  return [
    http.post("/api/accounts", async ({ request }) => {
      const body = (await request.json()) as Partial<{
        name: string;
        email: string;
        password: string;
      }>;
      const name = body.name?.trim(),
        email = body.email?.trim().toLowerCase(),
        password = body.password;
      if (
        !name ||
        !email ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        !password ||
        password.length < 8
      )
        return error(
          "Confira nome, e-mail e senha (mínimo de 8 caracteres).",
          422,
        );
      const salt = crypto.randomUUID(),
        hash = await digest(password, salt);
      const accounts = records();
      if (accounts.some((a) => a.email === email))
        return error("Este e-mail já está cadastrado.", 409);
      const user = { id: crypto.randomUUID(), name, email, salt, digest: hash };
      localStorage.setItem(accountsKey, JSON.stringify([...accounts, user]));
      return HttpResponse.json(publicData(user), { status: 201 });
    }),
    http.post("/api/login", async ({ request }) => {
      const { email, password } = (await request.json()) as {
        email: string;
        password: string;
      };
      const user = records().find(
        (a) => a.email === email?.trim().toLowerCase(),
      );
      if (
        !user ||
        typeof password !== "string" ||
        (await digest(password, user.salt)) !== user.digest
      )
        return error("E-mail ou senha incorretos.", 401);
      const guest = JSON.parse(
        localStorage.getItem(basketKey("guest")) || "{}",
      ) as Record<string, number>;
      const basket = JSON.parse(
        localStorage.getItem(basketKey(user.id)) || "{}",
      ) as Record<string, number>;
      let adjusted = false;
      for (const [id, count] of Object.entries(guest)) {
        const desired = (basket[id] || 0) + count;
        basket[id] = Math.min(stock(id), desired);
        adjusted ||= basket[id] !== desired;
      }
      localStorage.setItem(basketKey(user.id), JSON.stringify(basket));
      const guestCoupon = localStorage.getItem(couponKey("guest"));
      if (guestCoupon && Object.keys(guest).length > 0) {
        localStorage.setItem(couponKey(user.id), guestCoupon);
      }
      localStorage.removeItem(couponKey("guest"));
      localStorage.setItem(basketKey("guest"), "{}");
      const token = crypto.randomUUID(),
        expires = Date.now() + 3600000;
      localStorage.setItem(
        sessionsKey,
        JSON.stringify({ ...sessions(), [token]: { id: user.id, expires } }),
      );
      return HttpResponse.json({
        user: publicData(user),
        token,
        expires,
        adjusted,
      });
    }),

    http.patch("/api/profile/password", async ({ request }) => {
      const owner = identity(request);
      if (!owner || owner === "guest") return expired();

      const body = await request.json().catch(() => null);
      const invalid = (field: string, message: string) =>
        HttpResponse.json({ field, message }, { status: 422 });

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return invalid("body", "Dados da alteração de senha inválidos.");
      }

      const { currentPassword, newPassword } = body as Record<string, unknown>;
      if (typeof currentPassword !== "string" || !currentPassword.length) {
        return invalid("currentPassword", "Informe a senha atual.");
      }
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return invalid(
          "newPassword",
          "Use pelo menos 8 caracteres na nova senha.",
        );
      }

      const original = records().find((account) => account.id === owner);
      if (!original) return expired();

      const previousDigest = await digest(currentPassword, original.salt);
      if (previousDigest !== original.digest) {
        return invalid("currentPassword", "Senha atual incorreta.");
      }
      if (currentPassword === newPassword) {
        return invalid("newPassword", "Escolha uma senha diferente da atual.");
      }

      const salt = crypto.randomUUID();
      const nextDigest = await digest(newPassword, salt);

      // A derivação é assíncrona. Releia a sessão e o registro antes de gravar.
      if (identity(request) !== owner) return expired();
      const accounts = records();
      const latest = accounts.find((account) => account.id === owner);
      if (!latest) return expired();
      if (latest.digest !== original.digest || latest.salt !== original.salt) {
        return HttpResponse.json(
          {
            message:
              "A senha foi alterada em outra tentativa. Confira a senha atual.",
          },
          { status: 409 },
        );
      }

      latest.salt = salt;
      latest.digest = nextDigest;
      localStorage.setItem(accountsKey, JSON.stringify(accounts));

      const activeToken = (request.headers.get("Authorization") || "").replace(
        /^Bearer /,
        "",
      );
      const allSessions = sessions();
      for (const [token, session] of Object.entries(allSessions)) {
        if (session.id === owner && token !== activeToken)
          delete allSessions[token];
      }
      localStorage.setItem(sessionsKey, JSON.stringify(allSessions));

      return new HttpResponse(null, { status: 204 });
    }),

    http.get("/api/profile", ({ request }) => {
      const owner = identity(request);
      if (!owner || owner === "guest") return expired();

      const account = records().find((item) => item.id === owner);
      if (!account) return expired();

      return HttpResponse.json({
        ...publicData(account),
        avatarId: account.avatarId ?? null,
      });
    }),

    http.patch("/api/profile", async ({ request }) => {
      const body = await request.json().catch(() => null);
      const owner = identity(request);
      if (!owner || owner === "guest") return expired();

      const invalid = (field: string, message: string) =>
        HttpResponse.json({ field, message }, { status: 422 });

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return invalid("body", "Dados do perfil inválidos.");
      }

      const input = body as Record<string, unknown>;
      const fields = Object.keys(input);
      if (
        !fields.length ||
        fields.some((key) => !["name", "email", "avatarId"].includes(key))
      ) {
        return invalid("body", "Envie somente nome, e-mail ou avatar.");
      }

      const accounts = records();
      const account = accounts.find((item) => item.id === owner);
      if (!account) return expired();

      // Validamos uma cópia para impedir alterações parciais em caso de erro.
      const updated = { ...account };

      if ("name" in input) {
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (name.length < 2 || name.length > 80) {
          return invalid("name", "Use um nome de 2 a 80 caracteres.");
        }
        updated.name = name;
      }

      if ("email" in input) {
        const email =
          typeof input.email === "string"
            ? input.email.trim().toLowerCase()
            : "";

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return invalid("email", "Informe um e-mail válido.");
        }
        if (
          accounts.some((item) => item.id !== owner && item.email === email)
        ) {
          return HttpResponse.json(
            { field: "email", message: "Este e-mail já está cadastrado." },
            { status: 409 },
          );
        }
        updated.email = email;
      }

      if ("avatarId" in input) {
        const avatar = input.avatarId;
        if (
          avatar !== null &&
          (typeof avatar !== "string" ||
            !["1", "2", "3", "4", "5", "6"].includes(avatar))
        ) {
          return invalid("avatarId", "Selecione um avatar disponível.");
        }
        updated.avatarId = avatar;
      }

      localStorage.setItem(
        accountsKey,
        JSON.stringify(
          accounts.map((item) => (item.id === owner ? updated : item)),
        ),
      );

      return HttpResponse.json({
        ...publicData(updated),
        avatarId: updated.avatarId ?? null,
      });
    }),

    http.get("/api/session", ({ request }) => {
      const user = records().find((a) => a.id === identity(request));
      return user ? HttpResponse.json(publicData(user)) : expired();
    }),
    http.delete("/api/session", ({ request }) => {
      const all = sessions();
      delete all[
        (request.headers.get("Authorization") || "").replace(/^Bearer /, "")
      ];
      localStorage.setItem(sessionsKey, JSON.stringify(all));
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}
