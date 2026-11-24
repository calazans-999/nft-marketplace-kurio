import type { AxiosInstance } from "axios";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./Dialog";

export function DemoPanel({ api }: { api: AxiosInstance }) {
  const command = useMutation({
    mutationFn: async (action: string) => {
      await api.post("/demo/" + action);
      if (action === "reset") {
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith("forma:")) sessionStorage.removeItem(key);
        }
        location.replace("/");
      }
    },
  });

  return (
    <Dialog>
      <DialogTrigger>Cenários de demonstração</DialogTrigger>
      <DialogContent>
        <DialogTitle>Cenários de demonstração</DialogTitle>
        <DialogDescription>
          Altere o preço ou o estoque enquanto revisa a compra. A falha de rede
          afeta a próxima consulta ao catálogo.
        </DialogDescription>
        <div className="demo-actions">
          <button
            disabled={command.isPending}
            onClick={() => command.mutate("price")}
          >
            Alterar preço da Órbita Solar
          </button>
          <button
            disabled={command.isPending}
            onClick={() => command.mutate("sold-out")}
          >
            Esgotar edição original da Órbita Solar
          </button>
          <button
            disabled={command.isPending}
            onClick={() => command.mutate("network-error")}
          >
            Simular falha de rede no catálogo
          </button>
          <button
            disabled={command.isPending}
            onClick={() => command.mutate("timeout")}
          >
            Simular timeout do catálogo
          </button>
          <button
            disabled={command.isPending}
            onClick={() => command.mutate("fixtures")}
          >
            Criar contas de demonstração
          </button>
        </div>
        <p>
          Contas: demo-a@example.test e demo-b@example.test. Senha:
          DemoForma123.
        </p>
        <details>
          <summary>Restaurar os dados iniciais</summary>
          <p>Apaga contas, cestas e pedidos simulados deste navegador.</p>
          <button
            disabled={command.isPending}
            onClick={() => command.mutate("reset")}
          >
            Confirmar restauração
          </button>
        </details>
        <p role="status">{command.isSuccess ? "Cenário ativado." : ""}</p>
        {command.isError && (
          <p role="alert">Não foi possível ativar o cenário.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
