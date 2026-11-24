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
  const mutationKey = ["change-favorite", owner] as const;
  const busy = useIsMutating({ mutationKey }) > 0;

  const favorites = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      (await api.get<Favorites>("/favorites", { signal })).data,
  });

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
      await client.cancelQueries({ queryKey: key, exact: true });
      const previous = client.getQueryData<Favorites>(key);
      if (previous) {
        const ids = new Set(previous.ids);
        if (add) ids.add(nftId);
        else ids.delete(nftId);
        client.setQueryData<Favorites>(key, { ids: [...ids] });
      }
      return { previous };
    },
    onError: (_error, _add, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSuccess: (saved) => client.setQueryData(key, saved),
    onSettled: () => client.invalidateQueries({ queryKey: key, exact: true }),
  });

  if (favorites.isPending) return <p role="status">Carregando favoritos…</p>;
  if (favorites.isError)
    return (
      <button onClick={() => favorites.refetch()}>
        Tentar carregar favoritos
      </button>
    );

  const selected = favorites.data.ids.includes(nftId);
  return (
    <div>
      <button
        type="button"
        aria-pressed={selected}
        disabled={busy}
        onClick={() => change.mutate(!selected)}
      >
        {selected ? "Remover dos favoritos" : "Favoritar obra"}
      </button>
      {change.isError && (
        <p role="alert">
          Não foi possível atualizar os favoritos. Tente novamente.
        </p>
      )}
    </div>
  );
}
