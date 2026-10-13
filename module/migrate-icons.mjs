/**
 * One-time update to this system's icons, one per category: world Actors, Items, and the Items on Actors that came
 * from this system's compendiums take the compendium entry's icon, and ones still showing Foundry's placeholder art
 * or an icon this system no longer ships take the default for their type. Art someone chose themselves is left alone.
 */

const SYSTEM_ID = "vagabond-rpg";
const VERSION = 2;
const ICON_PATH = `systems/${SYSTEM_ID}/assets/icons/`;

/** Core icons: what the compendiums used before. */
function isCoreArt(img) {
  return !img || img.startsWith("icons/");
}

/** Foundry's default art, and this system's old defaults by type. */
const OLD_DEFAULTS = new Set(["icons/svg/item-bag.svg", "icons/svg/mystery-man.svg", "icons/svg/sword.svg",
  "icons/svg/shield.svg", "icons/svg/book.svg", "icons/svg/upgrade.svg", "icons/svg/aura.svg", "icons/svg/d20-black.svg",
  "icons/environment/settlement/ship.webp", "icons/containers/chest/chest-reinforced-box-brown.webp"]);

/**
 * Run the update if this world hasn't had it. GM only.
 * @returns {Promise<void>}
 */
export async function migrateIcons() {
  if ( !game.user.isGM ) return;
  if ( (game.settings.get(SYSTEM_ID, "iconsVersion") ?? 0) >= VERSION ) return;

  // Compendium UUID → its icon.
  const art = new Map();
  for ( const pack of game.packs.filter(p => p.metadata.packageName === SYSTEM_ID) ) {
    const index = await pack.getIndex({ fields: ["img"] });
    for ( const e of index ) art.set(e.uuid, e.img);
  }
  const defaults = CONFIG.VAGABOND.defaultIcons;
  const current = new Set(Object.values(defaults));
  // One of this system's icons from before they were one per category.
  const isOldIcon = img => !!img && img.startsWith(ICON_PATH) && !current.has(img);
  const newImg = doc => {
    const source = doc._stats?.compendiumSource;
    const replaceable = isOldIcon(doc.img) || OLD_DEFAULTS.has(doc.img) || !doc.img;
    let img = null;
    if ( source && art.has(source) && (replaceable || isCoreArt(doc.img)) ) img = art.get(source);
    else if ( (doc.type === "action") && isCoreArt(doc.img) ) img = defaults.action;
    else if ( replaceable ) img = doc.flags?.[SYSTEM_ID]?.relic ? defaults.relic : defaults[doc.type];
    return (img && (img !== doc.img)) ? img : null;
  };

  let count = 0;
  const itemUpdates = items => items.map(i => {
    const img = newImg(i);
    return img ? { _id: i.id, img } : null;
  }).filter(Boolean);

  const worldItems = itemUpdates(game.items.contents);
  if ( worldItems.length ) await Item.implementation.updateDocuments(worldItems);
  count += worldItems.length;

  const actorUpdates = [];
  for ( const actor of game.actors ) {
    const img = newImg(actor);
    if ( img ) {
      const update = { _id: actor.id, img };
      const token = actor.prototypeToken.texture.src;
      if ( !token || OLD_DEFAULTS.has(token) || isOldIcon(token) || (token === actor.img) ) update["prototypeToken.texture.src"] = img;
      actorUpdates.push(update);
    }
    const owned = itemUpdates(actor.items.contents);
    if ( owned.length ) await actor.updateEmbeddedDocuments("Item", owned, { vagabondLog: false });
    count += owned.length;
  }
  if ( actorUpdates.length ) await Actor.implementation.updateDocuments(actorUpdates, { vagabondLog: false });
  count += actorUpdates.length;

  await game.settings.set(SYSTEM_ID, "iconsVersion", VERSION);
  if ( count ) ui.notifications.info(game.i18n.format("VAGABOND.Icons.Migrated", { n: count }));
}
