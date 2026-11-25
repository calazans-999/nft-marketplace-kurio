import type { AxiosInstance } from "axios";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

type Favorites = { ids: string[] };

export function FavoriteButton({
  api,
  owner,
  nftId,
}: {
  api: AxiosInstance;
  owner: string;
  nftId: string;
}) {
  const client = useQueryClient();
  const key = ["favorites", owner] as const;
  const mutationKey = ["change-favorite", owner, nftId] as const;

  const busy = useIsMutating({ mutationKey }) > 0;

  const favorites = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      (await api.get<Favorites>("/favorites", { signal })).data,
  });

  const selected = favorites.data?.ids.includes(nftId) ?? false;

  const change = useMutation({
    mutationKey,
    retry: false,

    mutationFn: async (add: boolean) => {
      const path = "/favorites/" + encodeURIComponent(nftId);

      const response = add
        ? await api.put<Favorites>(path)
        : await api.delete<Favorites>(path);

      return response.data;
    },

    onMutate: async (add) => {
      await client.cancelQueries({
        queryKey: key,
        exact: true,
      });

      const previous =
        client.getQueryData<Favorites>(key) ??
        favorites.data ??
        { ids: [] };

      const ids = new Set(previous.ids);

      if (add) {
        ids.add(nftId);
      } else {
        ids.delete(nftId);
      }

      client.setQueryData<Favorites>(key, {
        ids: [...ids],
      });

      return { previous };
    },

    onError: (_error, _add, context) => {
      if (context?.previous) {
        client.setQueryData(key, context.previous);
      }
    },

    onSuccess: (saved) => {
      client.setQueryData(key, saved);
    },

    onSettled: async () => {
      await client.invalidateQueries({
        queryKey: key,
        exact: true,
      });
    },
  });

  if (favorites.isPending) {
    return (
      <span
        className="favorite-loading"
        role="status"
        aria-label="Carregando favoritos"
      >
        ♡
      </span>
    );
  }

  if (favorites.isError) {
    return (
      <button
        type="button"
        className="favorite-retry"
        aria-label="Tentar carregar favoritos novamente"
        onClick={() => void favorites.refetch()}
      >
        ♡
      </button>
    );
  }

  return (
    <div className="favorite-control">
      <button
        type="button"
        className={`favorite-button${selected ? " favorite-selected" : ""}`}
        aria-label={
          selected ? "Remover dos favoritos" : "Adicionar aos favoritos"
        }
        title={
          selected ? "Remover dos favoritos" : "Adicionar aos favoritos"
        }
        aria-pressed={selected}
        disabled={busy}
        onClick={() => change.mutate(!selected)}
      >
        <span className="favorite-icon" aria-hidden="true">
          {selected ? "♥" : "♡"}
        </span>

        <span className="favorite-text">
          {selected ? "Remover dos favoritos" : "Favoritar obra"}
        </span>
      </button>

      {change.isError && (
        <p className="favorite-error" role="alert">
          Não foi possível atualizar os favoritos. Tente novamente.
        </p>
      )}
    </div>
  );
}