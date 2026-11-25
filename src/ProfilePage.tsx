import { useState, type FormEvent } from "react";
import axios, { type AxiosInstance } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type CollectorProfile = {
  id: string;
  name: string;
  email: string;
  avatarId: string | null;
};

type ApiError = { field?: string; message?: string };

function problem(error: unknown): ApiError {
  if (axios.isAxiosError<ApiError>(error) && error.response?.data?.message) {
    return error.response.data;
  }
  return { message: "Falha ao salvar. Tente novamente." };
}

const avatars = [
  ["1", "Emerald Ape #042"],
  ["2", "Sage Nomad #009"],
  ["3", "Neon Vessel #552"],
  ["4", "Cosmic Bloom #118"],
  ["5", "Violet Nomad #314"],
  ["6", "Ivory Baron #088"],
];

function ProfileForm({
  api,
  profile,
  onSaved,
}: {
  api: AxiosInstance;
  profile: CollectorProfile;
  onSaved: (profile: CollectorProfile) => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [avatarId, setAvatarId] = useState(profile.avatarId ?? "");
  const [username, setUsername] = useState(
    localStorage.getItem(`kurio:username:${profile.id}`) ??
      profile.name.toLowerCase().replace(/\s+/g, ""),
  );
  const [ens, setEns] = useState(
    localStorage.getItem(`kurio:ens:${profile.id}`) ?? "",
  );
  const [walletNickname, setWalletNickname] = useState(
    localStorage.getItem(`kurio:wallet-name:${profile.id}`) ?? "Principal",
  );

  const save = useMutation({
    retry: false,
    mutationFn: async () =>
      (
        await api.patch<CollectorProfile>("/profile", {
          name,
          email,
          avatarId: avatarId || null,
        })
      ).data,
    onSuccess: (updated) => {
      setName(updated.name);
      setEmail(updated.email);
      setAvatarId(updated.avatarId ?? "");
      client.setQueryData(["profile", updated.id], updated);
      localStorage.setItem(`kurio:username:${updated.id}`, username);
      localStorage.setItem(`kurio:ens:${updated.id}`, ens);
      localStorage.setItem(
        `kurio:wallet-name:${updated.id}`,
        walletNickname,
      );
      onSaved(updated);
    },
  });

  const issue = save.isError ? problem(save.error) : undefined;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!save.isPending) save.mutate();
  }

  return (
    <form
      id="profile-data-form"
      className="profile-data-form"
      aria-label="Dados do perfil"
      onSubmit={submit}
      onChange={() => {
        if (save.isSuccess || save.isError) save.reset();
      }}
    >
      <h2>Perfil do colecionador</h2>

      <fieldset className="profile-figma-fields" disabled={save.isPending}>
        <label htmlFor="profile-name">
          Nome de exibição<span aria-hidden="true">*</span>
        </label>
        <input
          id="profile-name"
          aria-label="Nome"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={issue?.field === "name" || undefined}
          aria-describedby={
            issue?.field === "name" ? "profile-error" : undefined
          }
        />

        <label htmlFor="profile-username">
          Nome de usuário<span aria-hidden="true">*</span>
        </label>
        <input
          id="profile-username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label htmlFor="profile-email">
          E-mail<span aria-hidden="true">*</span>
        </label>
        <input
          id="profile-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={issue?.field === "email" || undefined}
          aria-describedby={
            issue?.field === "email" ? "profile-error" : undefined
          }
        />

        <label htmlFor="profile-ens">
          Nome ENS <span aria-hidden="true">*</span>
        </label>
        <div className="profile-ens-field">
          <span>.eth</span>
          <input
            id="profile-ens"
            value={ens}
            onChange={(e) => setEns(e.target.value)}
            aria-label="Nome ENS"
          />
        </div>

        <label htmlFor="profile-wallet-name">
          Apelido da carteira<span aria-hidden="true">*</span>
        </label>
        <input
          id="profile-wallet-name"
          required
          value={walletNickname}
          onChange={(e) => setWalletNickname(e.target.value)}
        />

        <div className="profile-avatar-editor">
          <span>Avatar</span>
          <div>
            <span className="profile-avatar-preview" aria-hidden="true">
              {avatarId ? (
                <img src={"/art/" + avatarId + ".svg"} alt="" />
              ) : (
                "◉"
              )}
            </span>

            <label className="profile-avatar-change" htmlFor="profile-avatar">
              Alterar
            </label>
            <select
              id="profile-avatar"
              value={avatarId}
              onChange={(e) => setAvatarId(e.target.value)}
              aria-label="Avatar"
              aria-invalid={issue?.field === "avatarId" || undefined}
              aria-describedby={
                issue?.field === "avatarId" ? "profile-error" : undefined
              }
            >
              <option value="">Sem avatar</option>
              {avatars.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="profile-avatar-remove"
              onClick={() => setAvatarId("")}
            >
              Remover
            </button>
          </div>
        </div>

        <button type="submit" className="action profile-save-action">
          Salvar perfil
        </button>
      </fieldset>
      {issue && (
        <p role="alert" id="profile-error">
          {issue.message}
        </p>
      )}
      <p role="status">{save.isSuccess ? "Perfil salvo." : ""}</p>
    </form>
  );
}

function PasswordForm({ api }: { api: AxiosInstance }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [localError, setLocalError] = useState("");

  const change = useMutation({
    retry: false,
    mutationFn: () =>
      api.patch("/profile/password", {
        currentPassword: current,
        newPassword: next,
      }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirmation("");
      setLocalError("");
    },
  });

  const issue = change.isError ? problem(change.error) : undefined;
  return (
    <form
      className="profile-password-form"
      aria-label="Alteração de senha"
      onChange={() => {
        if (change.isSuccess || change.isError) change.reset();
      }}
      onSubmit={(e) => {
        e.preventDefault();

        if (confirmation && confirmation !== next) {
          setLocalError("A confirmação não coincide com a nova senha.");
          return;
        }

        setLocalError("");
        if (!change.isPending) change.mutate();
      }}
    >
      <h2>Alterar senha</h2>
      <fieldset disabled={change.isPending}>
        <label htmlFor="profile-current">Senha atual</label>
        <span className="profile-password-input">
        <input
          id="profile-current"
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          aria-invalid={issue?.field === "currentPassword" || undefined}
          aria-describedby={
            issue?.field === "currentPassword" ? "password-error" : undefined
          }
        />
        <button
          type="button"
          aria-label={visible ? "Ocultar senhas" : "Mostrar senhas"}
          onClick={() => setVisible((value) => !value)}
        >
          ◉
        </button>
        </span>

        <label htmlFor="profile-next">Nova senha</label>
        <span className="profile-password-input">
        <input
          id="profile-next"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-invalid={issue?.field === "newPassword" || undefined}
          aria-describedby={
            issue?.field === "newPassword" ? "password-error" : "password-hint"
          }
        />
        <button
          type="button"
          aria-label={visible ? "Ocultar senhas" : "Mostrar senhas"}
          onClick={() => setVisible((value) => !value)}
        >
          ◉
        </button>
        </span>

        <label htmlFor="profile-confirmation">Confirmar nova senha</label>
        <span className="profile-password-input">
          <input
            id="profile-confirmation"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setLocalError("");
            }}
          />
          <button
            type="button"
            aria-label={visible ? "Ocultar senhas" : "Mostrar senhas"}
            onClick={() => setVisible((value) => !value)}
          >
            ◉
          </button>
        </span>

        <p id="password-hint">Use pelo menos 8 caracteres.</p>

        <button
          type="submit"
          className="action"
          onClick={() => {
            document
              .querySelector<HTMLFormElement>("#profile-data-form")
              ?.requestSubmit();
          }}
        >
          Salvar
        </button>
      </fieldset>
      {(issue || localError) && (
        <p role="alert" id="password-error">
          {localError || issue?.message}
        </p>
      )}
      <p role="status">{change.isSuccess ? "Senha alterada." : ""}</p>
    </form>
  );
}

export function ProfilePage({
  api,
  owner,
  onSaved,
}: {
  api: AxiosInstance;
  owner: string;
  onSaved: (profile: CollectorProfile) => void;
}) {
  const query = useQuery({
    queryKey: ["profile", owner],
    queryFn: async ({ signal }) =>
      (await api.get<CollectorProfile>("/profile", { signal })).data,
  });

  const logout = async () => {
    await api.delete("/session");
    sessionStorage.removeItem("forma:token");
    sessionStorage.removeItem("forma:return");
    location.replace("/");
  };

  return (
    <section className="collector-profile profile-figma-page">
      <a
        className="mobile-profile-back"
        href="/"
        aria-label="Voltar à página inicial"
      >
        ‹
      </a>

      <aside className="profile-sidebar" aria-label="Menu do perfil">
        <h1>Meu perfil</h1>

        <a className="active" href="/perfil">♙ <span>Dados do perfil</span></a>
        <a href="/carteiras">⌾ <span>Carteiras</span></a>
        <a href="/atividade">♢ <span>Atividade</span></a>
        <a href="/lista-de-interesse">♡ <span>Lista de interesse</span></a>
        <a href="/ofertas">◉ <span>Ofertas</span></a>
        <a href="/downloads">⇩ <span>Arquivos baixados</span></a>
        <a href="mailto:contato@kurio.test?subject=Suporte">△ <span>Suporte</span></a>

        <button type="button" onClick={() => void logout()}>
          ⇥ <span>Sair</span>
        </button>
      </aside>

      <div className="profile-figma-content">
        {query.isPending ? (
          <p role="status">Carregando perfil…</p>
        ) : query.isError ? (
          <div role="alert" className="profile-load-error">
            Falha ao carregar o perfil.{" "}
            <button type="button" onClick={() => query.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            <ProfileForm
              key={owner}
              api={api}
              profile={query.data}
              onSaved={onSaved}
            />
            <PasswordForm api={api} />
          </>
        )}
      </div>
    </section>
  );
}