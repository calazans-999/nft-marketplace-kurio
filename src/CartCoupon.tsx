import { useState } from "react";
import axios, { type AxiosInstance } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Cart } from "./model";

type CouponAction = { kind: "apply"; code: string } | { kind: "remove" };

export function CartCoupon({
  api,
  owner,
  cart,
}: {
  api: AxiosInstance;
  owner: string;
  cart: Cart;
}) {
  const [code, setCode] = useState("");
  const client = useQueryClient();
  const key = ["cart", owner];

  const change = useMutation({
    retry: false,
    mutationFn: async (action: CouponAction) => {
      const response =
        action.kind === "apply"
          ? await api.put<Cart>("/cart-coupon", { code: action.code })
          : await api.delete<Cart>("/cart-coupon");
      return response.data;
    },
    onMutate: async () => {
      await client.cancelQueries({ queryKey: key, exact: true });
    },
    onSuccess: async (updated) => {
      client.setQueryData(key, updated);
      setCode("");
      await Promise.all([
        client.invalidateQueries({ queryKey: key, exact: true }),
        client.invalidateQueries({ queryKey: ["checkout", owner] }),
      ]);
    },
  });

  const error = axios.isAxiosError(change.error)
    ? change.error.response?.data?.message
    : undefined;

  return (
    <section aria-label="Cupom e valores do carrinho">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim() && !change.isPending) {
            change.mutate({ kind: "apply", code });
          }
        }}
      >
        <label htmlFor="cart-coupon">Código do cupom</label>
        <input
          id="cart-coupon"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            if (change.isError) change.reset();
          }}
          disabled={change.isPending}
          aria-describedby={change.isError ? "cart-coupon-error" : undefined}
          autoComplete="off"
        />
        <button type="submit" disabled={change.isPending || !code.trim()}>
          Aplicar cupom
        </button>
      </form>

      {change.isError && (
        <p role="alert" id="cart-coupon-error">
          {error || "Não foi possível atualizar o cupom. Tente novamente."}
        </p>
      )}

      <div aria-live="polite">
        {cart.coupon && <p>Cupom aplicado · {cart.coupon}</p>}
        <p>Desconto · {cart.discount ?? "0.00"} ETH</p>
        <p>Taxa de rede · {cart.fee} ETH</p>
        <h2>Total · {cart.total} ETH</h2>
      </div>

      {cart.coupon && (
        <button
          type="button"
          disabled={change.isPending}
          onClick={() => change.mutate({ kind: "remove" })}
        >
          Remover cupom
        </button>
      )}
    </section>
  );
}
