import { http, HttpResponse } from "msw";
import { identity, expired } from "./accounts.ts";

function readFavorites(owner: string): string[] {
  return JSON.parse(localStorage.getItem("forma:favorites:" + owner) || "[]");
}

export function favoriteHandlers(exists: (id: string) => boolean) {
  type FailureGate = {
    wait: Promise<void>;
    release: () => void;
    started: boolean;
  };
  const failures = new Map<string, FailureGate>();

  async function change(request: Request, id: string, add: boolean) {
    const owner = identity(request);
    if (!owner || owner === "guest") return expired();

    if (add && !exists(id)) {
      return HttpResponse.json(
        { message: "Obra não encontrada." },
        { status: 404 },
      );
    }

    const gate = failures.get(owner);
    if (gate && !gate.started) {
      gate.started = true;
      await gate.wait;
      return HttpResponse.json(
        { message: "Falha simulada ao atualizar favoritos." },
        { status: 503 },
      );
    }

    const favorites = new Set(readFavorites(owner));
    if (add) favorites.add(id);
    else favorites.delete(id);

    const ids = [...favorites];
    localStorage.setItem("forma:favorites:" + owner, JSON.stringify(ids));
    return HttpResponse.json({ ids });
  }

  return [
    http.post("/api/demo/favorite-failure/:action", ({ request, params }) => {
      const owner = identity(request);
      if (!owner || owner === "guest") return expired();

      if (params.action === "arm") {
        failures.get(owner)?.release();
        let release!: () => void;
        const wait = new Promise<void>((resolve) => {
          release = resolve;
        });
        failures.set(owner, { wait, release, started: false });
        return HttpResponse.json({ armed: true });
      }

      const gate = failures.get(owner);
      if (params.action === "status") {
        return HttpResponse.json({ started: gate?.started ?? false });
      }
      if (params.action === "release") {
        gate?.release();
        failures.delete(owner);
        return HttpResponse.json({ released: true });
      }
      return HttpResponse.json(
        { message: "Ação desconhecida." },
        { status: 400 },
      );
    }),

    http.get("/api/favorites", ({ request }) => {
      const owner = identity(request);
      if (!owner || owner === "guest") return expired();
      return HttpResponse.json({ ids: readFavorites(owner) });
    }),

    http.put("/api/favorites/:id", ({ request, params }) =>
      change(request, String(params.id), true),
    ),

    http.delete("/api/favorites/:id", ({ request, params }) =>
      change(request, String(params.id), false),
    ),
  ];
}
