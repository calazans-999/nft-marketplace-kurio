export type Nft = {
  id: string;
  title: string;
  artist: string;
  series: string;
  price: string;
  stock: number;
  artworkId?: string;
  edition?: string;
};
export type Line = { id: string; quantity: number; nft: Nft };
export type Cart = {
  coupon?: string | null;
  discount?: string;
  fee?: string;
  total?: string;
  lines: Line[];
  subtotal: string;
};
export type Search = { q: string; series: string; sort: string; page: number };
export const initialSearch: Search = {
  q: "",
  series: "",
  sort: "featured",
  page: 1,
};

export type Quote = Cart & { fee: string; total: string; revision: string };
export type Purchase = {
  outcome?: "confirmed" | "declined";
  revision: string;
  wallet: string;
  network: string;
};
export type Order = {
  walletSnapshot?: {
    id: string;
    label: string;
    address: string;
    network: string;
  };
  id: string;
  transaction: string;
  created: string;
  wallet: string;
  network: string;
  quote: Quote;
  status: "pending" | "confirmed" | "declined";
  version?: number;
};

export type NftDetail = Nft & { editions: Nft[] };
