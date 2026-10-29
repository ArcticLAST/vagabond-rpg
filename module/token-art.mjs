/**
 * Token art from a GM-chosen folder in Foundry's user data. Images are matched to NPCs by name, so "Bat, Giant",
 * "Giant Bat.webp", and "giant-bat-token.png" all match. NPCs without a matching image keep their art. The system
 * ships no art of its own here: the images stay in the world's own data.
 */

const SYSTEM_ID = "vagabond-rpg";
const IMAGE = /\.(webp|png|jpe?g|gif|avif|svg)$/i;
// Words in file names that describe the image rather than the creature.
const NOISE = new Set(["token", "tokens", "portrait", "art", "full", "image", "img", "the", "a", "an"]);

/** @type {Map<string, {portrait?: string, token?: string}>|null} */
let index = null;

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
 * Index image paths by name key. A file whose name says "token" is used for the token, any other for the portrait;
 * each falls back to the other.
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
    const entry = map.get(key) ?? {};
    const slot = /token/i.test(file) ? "token" : "portrait";
    entry[slot] ??= path;
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
export function artFor(name, map = index) {
  if ( !map ) return null;
  for ( const key of creatureKeys(name) ) {
    const entry = map.get(key);
    if ( entry ) return { portrait: entry.portrait ?? entry.token, token: entry.token ?? entry.portrait };
  }
  return null;
}

/* -------------------------------------------- */
/*  Foundry                                     */
/* -------------------------------------------- */

/** Whether an image is a placeholder that matched art may replace. */
function isPlaceholder(src) {
  return !src || (src === CONFIG.VAGABOND.defaultIcons.npc) || (src === "icons/svg/mystery-man.svg");
}

/**
 * List every image under a folder of the user data, including subfolders.
 * @param {string} folder
 * @returns {Promise<string[]>}
 */
async function listImages(folder) {
  const FP = foundry.applications.apps.FilePicker.implementation;
  const files = [];
  const seen = new Set();
  const walk = async dir => {
    if ( seen.has(dir) ) return;
    seen.add(dir);
    const result = await FP.browse("data", dir);
    files.push(...result.files);
    for ( const sub of result.dirs ) await walk(sub);
  };
  await walk(folder);
  return files;
}

/**
 * Read the chosen folder again.
 * @returns {Promise<number>}  The number of names with art.
 */
export async function refresh() {
  const folder = game.settings.get(SYSTEM_ID, "tokenArtFolder");
  index = null;
  if ( !folder ) return 0;
  try {
    index = buildIndex(await listImages(folder));
  } catch(err) {
    console.warn(`${SYSTEM_ID} | Couldn't read the token art folder "${folder}"`, err);
    ui.notifications.warn(game.i18n.format("VAGABOND.TokenArt.ReadError", { folder }));
  }
  return index?.size ?? 0;
}

/**
 * Art changes for an NPC's data, replacing only placeholder images.
 * @param {object} data   Actor data or source.
 * @returns {object|null}
 */
function changesFor(data) {
  const art = artFor(data.name);
  if ( !art ) return null;
  const changes = {};
  if ( isPlaceholder(data.img) ) changes.img = art.portrait;
  if ( isPlaceholder(data.prototypeToken?.texture?.src) ) changes["prototypeToken.texture.src"] = art.token;
  return Object.keys(changes).length ? changes : null;
}

/**
 * Give every world NPC, and the Tokens placed from them, matching art where they still have a placeholder.
 * @returns {Promise<number>}  The number of NPCs changed.
 */
export async function applyAll() {
  if ( !game.user.isGM ) return 0;
  await refresh();
  if ( !index?.size ) return 0;
  const updates = [];
  for ( const actor of game.actors.filter(a => a.type === "npc") ) {
    const changes = changesFor(actor._source);
    if ( changes ) updates.push({ _id: actor.id, ...changes });
  }
  if ( updates.length ) await Actor.implementation.updateDocuments(updates);
  for ( const scene of game.scenes ) {
    const tokens = scene.tokens.filter(t => (t.actor?.type === "npc") && isPlaceholder(t.texture.src))
      .map(t => ({ t, art: artFor(t.actor.name) })).filter(x => x.art)
      .map(({ t, art }) => ({ _id: t.id, "texture.src": art.token }));
    if ( tokens.length ) await scene.updateEmbeddedDocuments("Token", tokens);
  }
  return updates.length;
}

/** Register the setting and hooks. Called during init. */
export function registerTokenArt() {
  game.settings.register(SYSTEM_ID, "tokenArtFolder", {
    name: "VAGABOND.TokenArt.Setting.Name",
    hint: "VAGABOND.TokenArt.Setting.Hint",
    scope: "world", config: true, type: String, default: "", filePicker: "folder",
    onChange: async () => {
      if ( !game.user.isGM ) return refresh();
      const found = await refresh();
      if ( !found ) return;
      const apply = await foundry.applications.api.DialogV2.confirm({
        window: { title: "VAGABOND.TokenArt.Title" },
        content: `<p>${game.i18n.format("VAGABOND.TokenArt.Confirm", { n: found })}</p>`
      });
      if ( apply ) {
        const n = await applyAll();
        ui.notifications.info(game.i18n.format("VAGABOND.TokenArt.Applied", { n }));
      }
    }
  });

  Hooks.once("ready", () => refresh());

  // New NPCs, such as those imported from the Bestiary, get matching art.
  Hooks.on("preCreateActor", (actor, data) => {
    if ( (actor.type !== "npc") || !index ) return;
    const changes = changesFor(actor._source);
    if ( changes ) actor.updateSource(changes);
  });
}
