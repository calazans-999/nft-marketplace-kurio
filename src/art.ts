const artwork = ["1", "2", "3", "2", "4", "3"];

export function artSrc(id: string) {
  const numericId = Number(id);
  const artworkIndex =
    numericId === 7 || numericId === 8
      ? 4
      : numericId === 5
        ? 3
        : numericId - 1;
  const variant = artwork[artworkIndex];
  return variant ? "/art/kurio-" + variant + ".png" : "/art/" + id + ".svg";
}
