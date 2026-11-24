import { ws } from "msw";
import { toSocketIo } from "@mswjs/socket.io-binding";
import { identity } from "./accounts.ts";

type Watch = {
  id: string;
  owner: string;
  token: string;
  send: (event: unknown) => void;
};
const watches = new Set<Watch>();

function ownerOf(token: string) {
  return identity(
    new Request("http://localhost/api/session", {
      headers: { Authorization: "Bearer " + token },
    }),
  );
}

export function notifyOrder(owner: string, id: string, version: number) {
  const event = { id: crypto.randomUUID(), resourceId: id, version };
  for (const watch of watches) {
    if (
      watch.owner === owner &&
      watch.id === id &&
      ownerOf(watch.token) === owner
    )
      watch.send(event);
  }
}

const origin =
  typeof window === "undefined"
    ? "ws://localhost"
    : window.location.origin.replace(/^http/, "ws");

export const orderStream = ws
  .link(origin + "/order-stream/")
  .addEventListener("connection", (connection) => {
    const { client } = toSocketIo(connection);
    let watch: Watch | undefined;
    client.on("order.watch", (_event, value) => {
      if (watch) watches.delete(watch);
      watch = undefined;
      const input = value as { id?: string; token?: string } | undefined;
      if (
        !input ||
        typeof input.id !== "string" ||
        typeof input.token !== "string"
      )
        return;
      const owner = ownerOf(input.token);
      if (!owner || owner === "guest") return;
      if (!localStorage.getItem("forma:order:" + owner + ":" + input.id))
        return;
      watch = {
        owner,
        id: input.id,
        token: input.token,
        send: (event) => client.emit("order.updated", event),
      };
      watches.add(watch);
      client.emit("order.watching", { resourceId: input.id });
    });
    connection.client.addEventListener("close", () => {
      if (watch) watches.delete(watch);
    });
  });
