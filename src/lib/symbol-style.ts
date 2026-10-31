// L/F/早/遅 の見た目（docs/requirements.md：L＝赤、F＝青、早・遅＝黒字）。スプシの条件付き書式と色をそろえる

export function symbolClass(symbol: string): string {
  if (symbol === "L") return "bg-red-500 text-white";
  if (symbol === "F") return "bg-blue-500 text-white";
  return "bg-white text-zinc-900 border border-zinc-400";
}
