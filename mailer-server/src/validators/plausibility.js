// Heuristics for "is this a real name / address, or keyboard-mash?". These are
// intentionally conservative: a false positive blocks a real customer, so every
// threshold is a named constant that can be tuned from the rejection log.

const MAX_CONSONANT_RUN = 5; // 5+ consonants in a row is suspicious...
const ALLOWED_CONSONANT_CLUSTERS = /sch|tch|ngth|ght/; // ...unless it's e.g. "Hirschfeld"
const MIN_LEN_FOR_VOWEL_RATIO = 6;
const MIN_VOWEL_RATIO = 0.1;
const MAX_VOWEL_RATIO = 0.85;

// 'y' counts as a vowel so names like "Lynch" and "Nguyen" pass.
const VOWELS = 'aeiouy';

const PLACEHOLDER_WORDS = new Set([
  'asdf', 'asdfg', 'qwer', 'qwert', 'qwerty', 'zxcv', 'zxcvb', 'test', 'tester',
  'abc', 'abcd', 'xxx', 'xxxx', 'none', 'name', 'null', 'na', 'n/a', 'fake',
  'firstname', 'lastname', 'aaa', 'asd', 'sdf',
]);

// Lowercase and strip diacritics so "Renée" is judged as "renee".
const fold = (text) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const isVowel = (ch) => VOWELS.includes(ch);

// True when a single word (letters only) does not look like a human word.
export function looksLikeGibberish(word) {
  const letters = fold(word).replace(/[^a-z]/g, '');
  if (letters.length < 3) return false;

  if (![...letters].some(isVowel)) return true;

  const runs = letters.match(new RegExp(`[^${VOWELS}]{${MAX_CONSONANT_RUN},}`, 'g'));
  if (runs && runs.some((run) => !ALLOWED_CONSONANT_CLUSTERS.test(run))) return true;

  if (/(.)\1\1/.test(letters)) return true;

  if (letters.length >= MIN_LEN_FOR_VOWEL_RATIO) {
    const ratio = [...letters].filter(isVowel).length / letters.length;
    if (ratio < MIN_VOWEL_RATIO || ratio > MAX_VOWEL_RATIO) return true;
  }

  return false;
}

// Mid-word capitals ("aBcDe") are a mash tell, except for Mc/Mac/De-style names.
function hasOddCapitals(part) {
  if (!/[a-z][A-Z]/.test(part)) return false;
  return !/^(Mc|Mac|De|Di|Da|La|Le|Van|Von)[A-Z]/.test(part);
}

// A name part is one piece of a token split on hyphens/apostrophes/periods.
const splitParts = (token) => token.split(/['’.\-]/).filter(Boolean);

function partIsBad(part) {
  return (
    looksLikeGibberish(part) ||
    hasOddCapitals(part) ||
    PLACEHOLDER_WORDS.has(fold(part))
  );
}

export function isPlausibleName(full) {
  const tokens = full.trim().split(/\s+/);
  if (tokens.length < 2) return false;

  if (!tokens.every((t) => /^[\p{L}\p{M}'’.\-]+$/u.test(t))) return false;

  const letterCount = (t) => (t.match(/\p{L}/gu) || []).length;
  const first = tokens[0];
  const last = tokens[tokens.length - 1];

  // A lone initial is fine for the first name ("J. Smith") but not the last.
  if (letterCount(last) < 2 || letterCount(first) < 1) return false;

  if (fold(first).replace(/[^a-z]/g, '') === fold(last).replace(/[^a-z]/g, '')) {
    return false;
  }

  return tokens.every((t) => splitParts(t).every((part) => !partIsBad(part)));
}

const URL_PATTERN = /https?:\/\/|www\.|\.(com|net|org|ru|xyz)\b/i;
export const containsUrl = (text) => URL_PATTERN.test(text);

export function isPlausibleStreet(line1) {
  const value = line1.trim();
  if (containsUrl(value)) return false;

  const poBox = /^p\.?\s?o\.?\s*box\s+\d+/i.test(value);
  if (!poBox && !/^\d+[A-Za-z]?(-\d+)?\s+\S/.test(value)) return false;

  // Judge only longer words so abbreviations (St, Ave, Rd, Apt) are never flagged.
  return value
    .split(/\s+/)
    .filter((w) => /^\p{L}{5,}$/u.test(w))
    .every((w) => !looksLikeGibberish(w));
}

export function isPlausibleCity(city) {
  const value = city.trim();
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-]*$/u.test(value)) return false;
  return value
    .split(/[\s.'’\-]+/)
    .filter(Boolean)
    .every((w) => !looksLikeGibberish(w) && !PLACEHOLDER_WORDS.has(fold(w)));
}

// First three ZIP digits per state (CT/NY share 063 — Fishers Island).
const ZIP_PREFIX_RANGES = {
  NJ: [[70, 89]],
  NY: [[5, 5], [63, 63], [100, 149]],
  PA: [[150, 196]],
  CT: [[60, 69]],
};

export function zipMatchesState(zip, state) {
  const ranges = ZIP_PREFIX_RANGES[state];
  if (!ranges) return false;
  const prefix = parseInt(zip.slice(0, 3), 10);
  return ranges.some(([lo, hi]) => prefix >= lo && prefix <= hi);
}

export const ALLOWED_STATES = Object.keys(ZIP_PREFIX_RANGES);

// Normalize to NANP "201-391-3772" or return null when invalid.
export function normalizePhone(raw) {
  if (!/^[0-9\s\-+().]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  if (/^(\d)\1{9}$/.test(digits)) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}
