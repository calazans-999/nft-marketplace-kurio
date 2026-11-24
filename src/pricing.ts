const WEI_PER_ETH = 10n ** 18n;

export function toWei(value: string): bigint {
  if (!/^\d+(?:\.\d{1,18})?$/.test(value)) {
    throw new Error("Valor de ETH inválido.");
  }

  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * WEI_PER_ETH + BigInt(fraction.padEnd(18, "0"));
}

export function toEth(wei: bigint): string {
  const whole = wei / WEI_PER_ETH;
  const fraction = (wei % WEI_PER_ETH)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "")
    .padEnd(2, "0");

  return `${whole}.${fraction}`;
}

const coupons = new Map<string, { percent: bigint; expiresAt: number | null }>([
  ["FORMA10", { percent: 10n, expiresAt: null }],
  ["EXPIRADO10", { percent: 10n, expiresAt: Date.UTC(2025, 0, 1) }],
]);

export class CouponError extends Error {
  readonly code: "INVALID_COUPON" | "EXPIRED_COUPON";

  constructor(code: "INVALID_COUPON" | "EXPIRED_COUPON") {
    super(code === "EXPIRED_COUPON" ? "Cupom expirado." : "Cupom inválido.");
    this.code = code;
  }
}

export function priceCart(
  subtotal: string,
  fee: string,
  coupon: string | null = null,
  now = Date.now(),
) {
  const subtotalWei = toWei(subtotal);
  const feeWei = toWei(fee);
  const code = coupon?.trim().toUpperCase() ?? null;
  let discountWei = 0n;

  if (code !== null) {
    const rule = coupons.get(code);
    if (!rule) throw new CouponError("INVALID_COUPON");
    if (rule.expiresAt !== null && now >= rule.expiresAt) {
      throw new CouponError("EXPIRED_COUPON");
    }

    // A divisão inteira arredonda uma eventual fração de wei para baixo.
    discountWei = (subtotalWei * rule.percent) / 100n;
  }

  return {
    subtotal: toEth(subtotalWei),
    coupon: code,
    discount: toEth(discountWei),
    fee: toEth(feeWei),
    total: toEth(subtotalWei - discountWei + feeWei),
  };
}
