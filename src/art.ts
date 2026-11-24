const artwork = ["1", "2", "3", "2", "4", "3"];

export function artSrc(id: string) {
  const variant = artwork[Number(id) - 1];
  return variant ? "/art/kurio-" + variant + ".png" : "/art/" + id + ".svg";
}
