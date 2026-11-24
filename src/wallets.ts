import { http, HttpResponse } from "msw";
import { identity, expired } from "./accounts.ts";

export type WalletSlot = "primary" | "secondary";

export type Wallet = {
  id: string;
  slot: WalletSlot;
  label: string;
  address: string;
  network: "Ethereum Demo";
};

function storageKey(owner: string) {
  return "forma:wallets:v1:" + owner;
}

function initialWallet(owner: string): Wallet {
  // O ID coincide com a carteira já utilizada pelo checkout da Etapa 07.
  return {
    id: "DEMO-" + owner,
    slot: "primary",
    label: "Principal",
    address: "0x" + owner.replaceAll("-", "").padStart(40, "0"),
    network: "Ethereum Demo",
  };
}

export function readWallets(owner: string): Wallet[] {
  const stored = localStorage.getItem(storageKey(owner));
  return stored ? JSON.parse(stored) : [initialWallet(owner)];
}

function invalid(field: string, message: string, status = 422) {
  return HttpResponse.json({ field, message }, { status });
}

export const walletHandlers = [
  http.get("/api/wallets", ({ request }) => {
    const owner = identity(request);
    if (!owner || owner === "guest") return expired();
    return HttpResponse.json({ wallets: readWallets(owner) });
  }),

  http.put("/api/wallets/:slot", async ({ request, params }) => {
    const owner = identity(request);
    if (!owner || owner === "guest") return expired();

    const slot = params.slot;
    if (slot !== "primary" && slot !== "secondary") {
      return invalid("slot", "Tipo de carteira inexistente.", 404);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return invalid("body", "Dados da carteira inválidos.");
    }

    const input = body as Record<string, unknown>;
    const label = typeof input.label === "string" ? input.label.trim() : "";
    const address =
      typeof input.address === "string" ? input.address.trim() : "";

    if (label.length < 2 || label.length > 60) {
      return invalid("label", "Use um nome de 2 a 60 caracteres.");
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return invalid(
        "address",
        "Use 0x seguido de 40 caracteres hexadecimais.",
      );
    }
    if (input.network !== "Ethereum Demo") {
      return invalid("network", "Rede indisponível na simulação.");
    }

    const wallets = readWallets(owner);
    const duplicate = wallets.some(
      (wallet) =>
        wallet.slot !== slot &&
        wallet.address.toLowerCase() === address.toLowerCase(),
    );
    if (duplicate) {
      return invalid(
        "address",
        "Este endereço já está na outra carteira.",
        409,
      );
    }

    const previous = wallets.find((wallet) => wallet.slot === slot);
    const updated: Wallet = {
      id: previous?.id ?? "DEMO-SECONDARY-" + owner,
      slot,
      label,
      address,
      network: "Ethereum Demo",
    };

    const next = previous
      ? wallets.map((wallet) => (wallet.slot === slot ? updated : wallet))
      : [...wallets, updated];

    localStorage.setItem(storageKey(owner), JSON.stringify(next));
    return HttpResponse.json(updated, { status: previous ? 200 : 201 });
  }),
];
