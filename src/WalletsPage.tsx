import { useId, useState, type FormEvent } from "react";
import axios, { type AxiosInstance } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Wallet, WalletSlot } from "./wallets";

type WalletList = {
  wallets: Wallet[];
};

type ValidationError = {
  field?: string;
  message?: string;
};

type WalletPreferences = {
  displayName: string;
  profileName: string;
  email: string;
  ens: string;
  secondaryWallet: string;
  referralCode: string;
  walletType: string;
  network: string;
};

const emptyPreferences: WalletPreferences = {
  displayName: "",
  profileName: "",
  email: "",
  ens: "",
  secondaryWallet: "",
  referralCode: "",
  walletType: "Principal",
  network: "Ethereum Demo",
};

function readPreferences(owner: string, slot: WalletSlot): WalletPreferences {
  try {
    const saved = localStorage.getItem(`kurio:wallet:${owner}:${slot}`);

    return saved
      ? { ...emptyPreferences, ...JSON.parse(saved) }
      : (() => {
          const username =
            localStorage.getItem(`kurio:username:${owner}`) ?? "";
          return {
            ...emptyPreferences,
            displayName: username,
            profileName: username,
          };
        })();
  } catch {
    const username =
      localStorage.getItem(`kurio:username:${owner}`) ?? "";

    return {
      ...emptyPreferences,
      displayName: username,
      profileName: username,
    };
  }
}

function ProfileSidebar({
  api,
  active,
}: {
  api: AxiosInstance;
  active: "profile" | "wallets";
}) {
  const logout = async () => {
    await api.delete("/session");
    sessionStorage.removeItem("forma:token");
    sessionStorage.removeItem("forma:return");
    location.replace("/");
  };

  return (
    <aside className="profile-sidebar" aria-label="Menu do perfil">
      <h1>Meu perfil</h1>

      <a className={active === "profile" ? "active" : undefined} href="/perfil">
        ♙ <span>Dados do perfil</span>
      </a>
      <a className={active === "wallets" ? "active" : undefined} href="/carteiras">
        ⌾ <span>Carteiras</span>
      </a>
      <a href="/carrinho">
        ♢ <span>Atividade</span>
      </a>
      <a href="/#catalogo">
        ♡ <span>Lista de interesse</span>
      </a>
      <a href="/#catalogo">
        ◉ <span>Ofertas</span>
      </a>
      <a href="/perfil#downloads">
        ⇩ <span>Arquivos baixados</span>
      </a>
      <a href="mailto:contato@kurio.test?subject=Suporte">
        △ <span>Suporte</span>
      </a>

      <button type="button" onClick={() => void logout()}>
        ⇥ <span>Sair</span>
      </button>
    </aside>
  );
}

function RequiredMark() {
  return <span className="wallet-required" aria-hidden="true">*</span>;
}

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

  const initialPreferences = readPreferences(owner, slot);

  const [label, setLabel] = useState(saved?.label ?? "");
  const [address, setAddress] = useState(saved?.address ?? "");
  const [preferences, setPreferences] =
    useState<WalletPreferences>(initialPreferences);

  const title =
    slot === "primary" ? "Carteira principal" : "Carteira secundária";

  const save = useMutation({
    retry: false,
    mutationFn: async () =>
      (
        await api.put<Wallet>(`/wallets/${slot}`, {
          label,
          address,
          network: preferences.network,
        })
      ).data,

    onSuccess: async (updated) => {
      setLabel(updated.label);
      setAddress(updated.address);

      localStorage.setItem(
        `kurio:wallet:${owner}:${slot}`,
        JSON.stringify(preferences),
      );

      const key = ["wallets", owner];

      client.setQueryData<WalletList>(key, (old) => {
        const wallets = old?.wallets ?? [];

        return {
          wallets: wallets.some((wallet) => wallet.slot === updated.slot)
            ? wallets.map((wallet) =>
                wallet.slot === updated.slot ? updated : wallet,
              )
            : [...wallets, updated],
        };
      });

      await client.invalidateQueries({
        queryKey: key,
        exact: true,
      });
    },
  });

  const problem = axios.isAxiosError<ValidationError>(save.error)
    ? save.error.response?.data
    : undefined;

  const field = problem?.field;
  const message =
    problem?.message || "Falha ao salvar a carteira. Tente novamente.";

  function updatePreference(
    name: keyof WalletPreferences,
    value: string,
  ) {
    setPreferences((current) => ({
      ...current,
      [name]: value,
    }));

    if (save.isError || save.isSuccess) {
      save.reset();
    }
  }

  function updateWallet(
    update: (value: string) => void,
    value: string,
  ) {
    update(value);

    if (save.isError || save.isSuccess) {
      save.reset();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!save.isPending) {
      save.mutate();
    }
  }

  return (
    <form
      className={`wallet-figma-form wallet-${slot}`}
      aria-label={title}
      onSubmit={submit}
    >
      <div className="wallet-fields-grid">
        <label className="wallet-field">
          <span>
            Nome de exibição
            <RequiredMark />
          </span>
          <input
            value={preferences.displayName}
            required
            disabled={save.isPending}
            onChange={(event) =>
              updatePreference("displayName", event.target.value)
            }
          />
        </label>

        <label className="wallet-field">
          <span>
            Apelido da carteira
            <RequiredMark />
          </span>
          <input
            id={`${prefix}-name`}
            aria-label="Nome da carteira"
            value={label}
            required
            minLength={2}
            maxLength={60}
            disabled={save.isPending}
            aria-invalid={field === "label" || undefined}
            aria-describedby={
              field === "label" ? `${prefix}-label-error` : undefined
            }
            onChange={(event) =>
              updateWallet(setLabel, event.target.value)
            }
          />
          {field === "label" && (
            <small id={`${prefix}-label-error`} role="alert">
              {message}
            </small>
          )}
        </label>

        <label className="wallet-field">
          <span>
            Rede
            <RequiredMark />
          </span>
          <select
            value={preferences.network}
            required
            disabled={save.isPending}
            onChange={(event) =>
              updatePreference("network", event.target.value)
            }
          >
            <option value="Ethereum Demo">Ethereum Demo</option>
          </select>
        </label>

        <label className="wallet-field">
          <span>
            Nome do perfil
            <RequiredMark />
          </span>
          <input
            value={preferences.profileName}
            required
            disabled={save.isPending}
            onChange={(event) =>
              updatePreference("profileName", event.target.value)
            }
          />
        </label>

        <label className="wallet-field">
          <span>
            Endereço da carteira
            <RequiredMark />
          </span>
          <input
            id={`${prefix}-address`}
            aria-label="Endereço da carteira"
            value={address}
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="Endereço 0x da carteira"
            disabled={save.isPending}
            aria-invalid={field === "address" || undefined}
            aria-describedby={
              field === "address"
                ? `${prefix}-address-error`
                : `${prefix}-address-hint`
            }
            onChange={(event) =>
              updateWallet(setAddress, event.target.value)
            }
          />
          <small id={`${prefix}-address-hint`}>
            Use 0x seguido de 40 caracteres hexadecimais.
          </small>
          {field === "address" && (
            <small id={`${prefix}-address-error`} role="alert">
              {message}
            </small>
          )}
        </label>

        <label className="wallet-field wallet-field-secondary-address">
          <span className="wallet-optional-label">
            ENS ou carteira secundária (opcional)
          </span>
          <input
            value={preferences.secondaryWallet}
            disabled={save.isPending}
            placeholder="ENS ou carteira secundária (opcional)"
            onChange={(event) =>
              updatePreference("secondaryWallet", event.target.value)
            }
          />
        </label>

        <label className="wallet-field">
          <span>
            Tipo de carteira
            <RequiredMark />
          </span>
          <select
            value={preferences.walletType}
            required
            disabled={save.isPending}
            onChange={(event) =>
              updatePreference("walletType", event.target.value)
            }
          >
            <option value="Principal">Principal</option>
            <option value="Reserva">Reserva</option>
          </select>
        </label>

        <label className="wallet-field">
          <span>
            Código de indicação
            <RequiredMark />
          </span>
          <input
            value={preferences.referralCode}
            required
            disabled={save.isPending}
            onChange={(event) =>
              updatePreference("referralCode", event.target.value)
            }
          />
        </label>

        <label className="wallet-field">
          <span>
            E-mail
            <RequiredMark />
          </span>
          <input
            type="email"
            value={preferences.email}
            required
            disabled={save.isPending}
            onChange={(event) =>
              updatePreference("email", event.target.value)
            }
          />
        </label>

        <label className="wallet-field">
          <span>
            Nome ENS
            <RequiredMark />
          </span>

          <span className="wallet-ens-control">
            <span className="wallet-ens-prefix">.eth⌄</span>
            <input
              value={preferences.ens}
              required
              disabled={save.isPending}
              onChange={(event) =>
                updatePreference("ens", event.target.value)
              }
            />
          </span>
        </label>
      </div>

      <button
        type="submit"
        className="action wallet-save-button"
        disabled={save.isPending}
      >
        {save.isPending ? "Salvando…" : "Salvar carteira"}
      </button>

      {save.isError && field !== "address" && field !== "label" && (
        <p role="alert" className="wallet-form-message">
          {message}
        </p>
      )}

      <p role="status" className="wallet-form-message">
        {save.isSuccess ? "Carteira salva." : ""}
      </p>
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

  const savedSecondary = query.data?.wallets.find(
    (wallet) => wallet.slot === "secondary",
  );

  const [showSecondary, setShowSecondary] = useState(false);

  function openSecondaryWallet() {
    setShowSecondary(true);

    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(".wallet-secondary")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }

  return (
    <section className="wallets-page wallets-figma-page">
      <a
        className="mobile-account-back"
        href="/perfil"
        aria-label="Voltar ao meu perfil"
      >
        ‹
      </a>

      <ProfileSidebar api={api} active="wallets" />

      <div className="wallets-figma-content">
        {query.isPending ? (
          <p role="status">Carregando carteiras…</p>
        ) : query.isError ? (
          <div role="alert" className="wallets-load-error">
            Falha ao carregar as carteiras.{" "}
            <button type="button" onClick={() => query.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            <header className="wallets-figma-heading">
              <div>
                <h1>Carteira principal</h1>
                <p>
                  Estas carteiras ficam disponíveis no pagamento e para receber
                  NFTs comprados.
                </p>
              </div>

              <button type="button" onClick={openSecondaryWallet}>
                Adicionar
              </button>
            </header>

            <WalletForm
              api={api}
              owner={owner}
              slot="primary"
              saved={query.data.wallets.find(
                (wallet) => wallet.slot === "primary",
              )}
            />

            <section className="secondary-wallet-section">
              <div>
                <h2>Carteira secundária</h2>

                {!savedSecondary && !showSecondary && (
                  <p>
                    Você ainda não adicionou uma carteira secundária.
                  </p>
                )}
              </div>

              {!savedSecondary && !showSecondary && (
                <div className="secondary-wallet-action">
                  <span aria-hidden="true">○</span>
                  <span>Igual à carteira principal</span>
                  <button type="button" onClick={openSecondaryWallet}>
                    Adicionar
                  </button>
                </div>
              )}
            </section>

            {(savedSecondary || showSecondary) && (
              <WalletForm
                api={api}
                owner={owner}
                slot="secondary"
                saved={savedSecondary}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}