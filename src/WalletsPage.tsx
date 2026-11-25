import { useId, useState, type FormEvent } from "react";
import axios, { type AxiosInstance } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Wallet, WalletSlot } from "./wallets";

type WalletList = { wallets: Wallet[] };
type ValidationError = { field?: string; message?: string };

function WalletForm({
  api,
  owner,
  slot,
  saved,
}: {
  api: AxiosInstance;
  owner: string;
  slot: WalletSlot;
  saved?: Wallet;
}) {
  const client = useQueryClient();
  const prefix = useId();
  const [label, setLabel] = useState(saved?.label ?? "");
  const [address, setAddress] = useState(saved?.address ?? "");
  const title =
    slot === "primary" ? "Carteira principal" : "Carteira secundária";

  const save = useMutation({
    retry: false,
    mutationFn: async () =>
      (
        await api.put<Wallet>("/wallets/" + slot, {
          label,
          address,
          network: "Ethereum Demo",
        })
      ).data,
    onSuccess: async (updated) => {
      setLabel(updated.label);
      setAddress(updated.address);
      const key = ["wallets", owner];
      client.setQueryData<WalletList>(key, (old) => {
        const wallets = old?.wallets ?? [];
        return {
          wallets: wallets.some((w) => w.slot === updated.slot)
            ? wallets.map((w) => (w.slot === updated.slot ? updated : w))
            : [...wallets, updated],
        };
      });
      await client.invalidateQueries({ queryKey: key, exact: true });
    },
  });

  const problem = axios.isAxiosError<ValidationError>(save.error)
    ? save.error.response?.data
    : undefined;
  const field = problem?.field;
  const message =
    problem?.message || "Falha ao salvar a carteira. Tente novamente.";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!save.isPending) save.mutate();
  }

  function edit(update: (value: string) => void, value: string) {
    update(value);
    if (save.isError || save.isSuccess) save.reset();
  }

  return (
    <form
      className={`wallet-form wallet-${slot}`}
      aria-label={title}
      onSubmit={submit}
    >
      <div className="wallet-form-heading">
        <span aria-hidden="true">W</span>
        <div>
          <small>
            {slot === "primary" ? "CARTEIRA PRINCIPAL" : "CARTEIRA DE RESERVA"}
          </small>
          <h2>{title}</h2>
        </div>
        <strong>{saved ? "Conectada" : "Não cadastrada"}</strong>
      </div>

      <label htmlFor={prefix + "-name"}>Nome da carteira</label>
      <input
        id={prefix + "-name"}
        value={label}
        required
        minLength={2}
        maxLength={60}
        disabled={save.isPending}
        aria-invalid={field === "label" || undefined}
        aria-describedby={field === "label" ? prefix + "-error" : undefined}
        onChange={(e) => edit(setLabel, e.target.value)}
      />
      {field === "label" && (
        <p id={prefix + "-error"} role="alert">
          {message}
        </p>
      )}

      <label htmlFor={prefix + "-address"}>Endereço da carteira</label>
      <input
        id={prefix + "-address"}
        value={address}
        required
        autoComplete="off"
        spellCheck={false}
        disabled={save.isPending}
        aria-invalid={field === "address" || undefined}
        aria-describedby={
          field === "address" ? prefix + "-error" : prefix + "-hint"
        }
        onChange={(e) => edit(setAddress, e.target.value)}
      />
      <p id={prefix + "-hint"}>Use 0x seguido de 40 caracteres hexadecimais.</p>
      {field === "address" && (
        <p id={prefix + "-error"} role="alert">
          {message}
        </p>
      )}

      <div className="wallet-network">
        <span aria-hidden="true">◇</span>
        <div>
          <small>Rede selecionada</small>
          <p>Rede · Ethereum Demo</p>
        </div>
      </div>
      <button type="submit" className="action" disabled={save.isPending}>
        {save.isPending
          ? "Salvando…"
          : saved
            ? "Salvar alterações"
            : "Cadastrar carteira"}
      </button>
      {save.isError && field !== "address" && field !== "label" && (
        <p role="alert">{message}</p>
      )}
      <p role="status">{save.isSuccess ? "Carteira salva." : ""}</p>
    </form>
  );
}

export function WalletsPage({
  api,
  owner,
}: {
  api: AxiosInstance;
  owner: string;
}) {
  const query = useQuery({
    queryKey: ["wallets", owner],
    queryFn: async ({ signal }) =>
      (await api.get<WalletList>("/wallets", { signal })).data,
  });

  return (
    <section className="wallets-page">
      <div className="wallets-breadcrumbs">
        <a href="/">Início</a>
        <span aria-hidden="true"> / </span>
        Minhas carteiras
      </div>

      <div className="wallets-title">
        <div>
          <small>GERENCIAMENTO DE CARTEIRAS</small>
          <h1>Minhas carteiras</h1>
        </div>
        <p>
          Cadastre até duas carteiras para utilizar durante suas aquisições.
        </p>
      </div>

      {query.isPending ? (
        <p role="status">Carregando carteiras…</p>
      ) : query.isError ? (
        <div role="alert" className="wallets-load-error">
          Falha ao carregar as carteiras.{" "}
          <button onClick={() => query.refetch()}>Tentar novamente</button>
        </div>
      ) : (
        <div className="wallets-grid">
          {(["primary", "secondary"] as const).map((slot) => (
            <WalletForm
              key={slot}
              api={api}
              owner={owner}
              slot={slot}
              saved={query.data.wallets.find((wallet) => wallet.slot === slot)}
            />
          ))}
        </div>
      )}

      <aside className="wallets-security">
        <span aria-hidden="true">S</span>
        <div>
          <h2>Segurança da carteira</h2>
          <p>
            Esta experiência utiliza carteiras e transações simuladas. Nunca
            informe frases de recuperação ou chaves privadas.
          </p>
        </div>
      </aside>
    </section>
  );
}
