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
  ["1", "Órbita Solar"],
  ["2", "Maré Lunar"],
  ["3", "Anel de Jade"],
  ["4", "Eclipse de Cobre"],
  ["5", "Pulso Violeta"],
  ["6", "Vórtice Boreal"],
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
      aria-label="Dados do perfil"
      onSubmit={submit}
      onChange={() => {
        if (save.isSuccess || save.isError) save.reset();
      }}
    >
      <h2>Dados do colecionador</h2>
      <fieldset disabled={save.isPending}>
        <label htmlFor="profile-name">Nome</label>
        <input
          id="profile-name"
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

        <label htmlFor="profile-email">E-mail</label>
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

        <label htmlFor="profile-avatar">Avatar</label>
        <select
          id="profile-avatar"
          value={avatarId}
          onChange={(e) => setAvatarId(e.target.value)}
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
        {avatarId && (
          <img
            src={"/art/" + avatarId + ".svg"}
            width={120}
            height={80}
            alt={
              "Avatar selecionado: " +
              avatars.find(([id]) => id === avatarId)?.[1]
            }
          />
        )}

        <button type="submit" className="action">
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
    },
  });

  const issue = change.isError ? problem(change.error) : undefined;
  return (
    <form
      aria-label="Alteração de senha"
      onChange={() => {
        if (change.isSuccess || change.isError) change.reset();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!change.isPending) change.mutate();
      }}
    >
      <h2>Alterar senha</h2>
      <fieldset disabled={change.isPending}>
        <label htmlFor="profile-current">Senha atual</label>
        <input
          id="profile-current"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          aria-invalid={issue?.field === "currentPassword" || undefined}
          aria-describedby={
            issue?.field === "currentPassword" ? "password-error" : undefined
          }
        />

        <label htmlFor="profile-next">Nova senha</label>
        <input
          id="profile-next"
          type="password"
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
        <p id="password-hint">Use pelo menos 8 caracteres.</p>

        <button type="submit" className="action">
          Salvar nova senha
        </button>
      </fieldset>
      {issue && (
        <p role="alert" id="password-error">
          {issue.message}
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

  return (
    <section className="account">
      <h1>Meu perfil</h1>
      {query.isPending ? (
        <p role="status">Carregando perfil…</p>
      ) : query.isError ? (
        <div role="alert">
          Falha ao carregar o perfil.{" "}
          <button onClick={() => query.refetch()}>Tentar novamente</button>
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
    </section>
  );
}
