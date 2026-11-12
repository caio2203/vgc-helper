/** Showdown-style id: lowercase letters and digits only ("Garchomp-Mega-Z" → "garchompmegaz"). */
export function toId(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
