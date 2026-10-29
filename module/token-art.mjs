/**
 * Name matching between creatures and image files, used by tools/token-art.mjs to record where each Bestiary
 * creature's art lives in a GM's own Foundry data. "Bat, Giant", "Giant Bat.webp", and "giant-bat-token.png" all
 * match. The system ships no creature art: only the paths are recorded.
 */

const SYSTEM_ID = "vagabond-rpg";
const IMAGE = /\.(webp|png|jpe?g|gif|avif|svg)$/i;
// Words in file names that describe the image rather than the creature.
const NOISE = new Set(["token", "tokens", "portrait", "art", "full", "image", "img", "the", "a", "an"]);

/**
 * The words in a name, lowercased, without punctuation, image words, or numbers, in a fixed order.
 * @param {string} name
 * @returns {string}
 */
export function nameKey(name) {
  const words = String(name ?? "").toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(w => w && !NOISE.has(w) && !/^\d+$/.test(w));
  return [...new Set(words)].sort().join(" ");
}

/**
 * The keys a creature name can match: its own words, and each alternative of a slash name ("Alligator/Crocodile,
 * Giant" also matches "Giant Alligator" and "Giant Crocodile").
 * @param {string} name
 * @returns {string[]}
 */
export function creatureKeys(name) {
  const keys = [nameKey(name)];
  const [head, ...rest] = String(name ?? "").split(",");
  if ( head.includes("/") ) {
    for ( const alt of head.split("/") ) keys.push(nameKey([alt, ...rest].join(" ")));
  }
  return [...new Set(keys)].filter(Boolean);
}

/**
 * How well a path suits each slot. Token packs often keep the same file name in folders such as "portraits",
 * "tokens", "thumbnails", and "subjects"; the full-size portrait and the framed token are preferred.
 * @param {string} path
 * @returns {{portrait: number, token: number}}
 */
function slotScores(path) {
  const dirs = path.toLowerCase().split("/").slice(0, -1);
  const file = path.toLowerCase().split("/").pop();
  const has = re => dirs.some(d => re.test(d));
  const minor = has(/^(thumb|thumbs|thumbnails|subjects?|other|tokens-original)$/);
  return {
    token: (has(/^tokens?$/) ? 3 : 0) + (/token/.test(file) ? 2 : 0) - (minor ? 4 : 0),
    portrait: (has(/^portraits?$/) ? 3 : 0) - (/token/.test(file) || has(/^tokens?$/) ? 1 : 0) - (minor ? 4 : 0)
  };
}

/**
 * Index image paths by name key, keeping the best portrait and the best token for each name.
 * @param {string[]} paths
 * @returns {Map<string, {portrait?: string, token?: string}>}
 */
export function buildIndex(paths) {
  const map = new Map();
  for ( const path of paths ) {
    const file = decodeURIComponent(path.split("/").pop());
    if ( !IMAGE.test(file) ) continue;
    const key = nameKey(file);
    if ( !key ) continue;
    const entry = map.get(key) ?? { scores: {} };
    const scores = slotScores(decodeURIComponent(path));
    for ( const slot of ["portrait", "token"] ) {
      if ( !(slot in entry) || (scores[slot] > entry.scores[slot]) ) { entry[slot] = path; entry.scores[slot] = scores[slot]; }
    }
    map.set(key, entry);
  }
  return map;
}

/**
 * The art for a creature name, or null when nothing matches.
 * @param {string} name
 * @param {Map} [map]
 * @returns {{portrait: string, token: string}|null}
 */
export function artFor(name, map) {
  if ( !map ) return null;
  for ( const key of creatureKeys(name) ) {
    const entry = map.get(key);
    if ( entry ) return { portrait: entry.portrait, token: entry.token };
  }
  return null;
}
