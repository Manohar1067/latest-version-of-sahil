/**
 * Conservative display-time text formatter for user-entered, human-readable
 * business text (place names, people names, article/description words,
 * transport names, remarks, etc.).
 *
 * It capitalizes the first letter of every "ordinary lowercase" word while
 * deliberately leaving untouched anything that is already uppercase,
 * mixed-case, or non-text — so identifiers like truck numbers, GSTIN, GC
 * numbers, memo numbers, phone numbers, dates, currency amounts, punctuation,
 * and email addresses are never corrupted.
 *
 * This is DISPLAY-ONLY formatting. The stored database value is never changed,
 * so search / filter / matching / synchronization behaviour is unaffected.
 */
export function formatDisplayText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  // Mandatory: email addresses must never be altered.
  if (isEmail(trimmed)) return value;

  // Normalize repeated internal whitespace (safe for display text).
  return trimmed.split(/\s+/).map(capitalizeWord).join(" ");
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Capitalize the first letter of a word ONLY when the word is made up entirely
 * of lowercase letters (i.e. it has no uppercase letter at all). Words that
 * already contain any capital letter (acronyms, mixed-case, identifiers) and
 * words with no letters (numbers, symbols, punctuation) are returned unchanged.
 */
function capitalizeWord(word: string): string {
  const hasLowercase = /[a-z]/.test(word);
  const hasUppercase = /[A-Z]/.test(word);
  if (hasLowercase && !hasUppercase) {
    const first = word.charAt(0);
    const capped = first.toUpperCase() + word.slice(1);
    return capped;
  }
  return word;
}
