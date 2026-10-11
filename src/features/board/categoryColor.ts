// A fixed, theme-agnostic palette (readable on both light and dark surfaces) used to give each
// category a consistent color dot on the board, deterministically derived from its id.
const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function categoryColor(categoryId: string): string {
  return PALETTE[hashString(categoryId) % PALETTE.length]
}
