/**
 * Vision (p. 9). Darkness Blinds a Being unless it has a Sense that lets it see. Tokens get their vision from the
 * Being's Senses: Darksight sees in the dark, and the other Senses become detection modes.
 *
 * Senses come from a creature's Senses line, or for a Hero from their Ancestry traits, the Infravision Perk, and
 * Equipped Relics. Senses that need Focus (Telepath, Witchsight) or only work on some Beings stay manual: turn the
 * detection mode on in the Token's settings while it applies.
 *
 * Tokens are only updated when the Senses change, so a GM's own edits to a Token's vision stay put otherwise.
 */

const SYSTEM_ID = "vagabond-rpg";

/** The Senses (p. 9), with the detection mode each one uses. Darksight is the Token's own sight instead. */
export const SENSES = {
  allsight: { label: "Allsight", mode: "seeInvisibility" },
  blindsight: { label: "Blindsight", mode: "blindsight" },
  darksight: { label: "Darksight", mode: null },
  echolocation: { label: "Echolocation", mode: "echolocation" },
  seismicsense: { label: "Seismicsense", mode: "feelTremor" },
  telepathy: { label: "Telepathy", mode: "telepathy" }
};

/** Distance words in feet. Far is anything visible in the Scene. */
const DISTANCES = { close: 5, near: 30, far: null };

/** Relic Powers that grant a Sense while Equipped (p. 101). */
const RELIC_SENSES = {
  senseNightvision: "darksight", senseEcholocation: "echolocation", senseTremors: "seismicsense",
  senseTelepathy: "telepathy", senseTrueSeeing: "allsight"
};
const RELIC_POWER_NAMES = {
  Nightvision: "darksight", Echolocation: "echolocation", Tremors: "seismicsense", Telepathy: "telepathy",
  "True-Seeing": "allsight"
};

/* -------------------------------------------- */
/*  Reading Senses                              */
/* -------------------------------------------- */

/**
 * Read a Senses line such as "Darksight, Seismicsense 60'" or "Telepathy (Near)". A Sense limited to some Beings
 * or places ("only in labyrinth") is left out, since it can't be applied to every Token.
 * @param {string} text
 * @returns {Record<string, number|null>}  Sense → range in feet, or null for no limit.
 */
export function parseSenses(text) {
  const out = {};
  for ( const part of String(text ?? "").replace(/\([^)]*\)/g, m => m.replace(/,/g, " ")).split(/[,;]/) ) {
    const m = part.match(/\b(allsight|blindsight|darksight|echolocation|seismicsense|telepathy)\b/i);
    if ( !m || /\bonly\b/i.test(part) ) continue;
    const feet = part.match(/(\d+)\s*(?:'|’|ft\b|feet\b)/i);
    const word = part.match(/\b(close|near|far)\b/i);
    out[m[1].toLowerCase()] = feet ? Number(feet[1]) : (word ? DISTANCES[word[1].toLowerCase()] : null);
  }
  return out;
}

/**
 * Every Sense a Being has right now.
 * @param {Actor} actor
 * @returns {Record<string, number|null>}
 */
export function sensesOf(actor) {
  if ( actor?.type === "npc" ) return parseSenses(actor.system.details?.senses);
  if ( actor?.type !== "character" ) return {};
  const senses = {};
  const add = (id, range = null) => { if ( !(id in senses) ) senses[id] = range; };
  const level = actor.system.details?.level ?? 1;
  for ( const item of actor.items ) {
    // Ancestry traits (Darksight for Dwarves, Goblins, and Orcs).
    if ( item.type === "ancestry" ) {
      for ( const t of item.system.traits ?? [] ) {
        if ( (t.level ?? 1) > level ) continue;
        for ( const [id, range] of Object.entries(parseSenses(t.name)) ) add(id, range);
      }
    }
    // Infravision: "You gain Darksight."
    else if ( (item.type === "perk") && (item.name === "Infravision") ) add("darksight");
    // Equipped Relics, built with the Relic Builder or from the compendium.
    else if ( item.system.equipped ) {
      for ( const id of Object.keys(item.flags?.[SYSTEM_ID]?.relic?.picks ?? {}) ) if ( RELIC_SENSES[id] ) add(RELIC_SENSES[id]);
      const html = String(item.system.description ?? "");
      for ( const m of html.matchAll(/<li><strong>([^<:]+):<\/strong>([^<]*)<\/li>/g) ) {
        const id = RELIC_POWER_NAMES[m[1].trim()];
        if ( id && !/\bFocus\b/i.test(m[2]) ) add(id);
      }
    }
  }
  return senses;
}

/* -------------------------------------------- */
/*  Token data                                  */
/* -------------------------------------------- */

/**
 * The Token vision for a set of Senses.
 * @param {Record<string, number|null>} senses
 * @param {object} [current]  The Token's current detection modes, so ones that no longer apply are removed.
 * @returns {{sight: object, detectionModes: object}}
 */
export function tokenVision(senses, current = {}) {
  const dark = "darksight" in senses;
  const detectionModes = {};
  for ( const [id, cfg] of Object.entries(SENSES) ) {
    if ( !cfg.mode ) continue;
    if ( id in senses ) detectionModes[cfg.mode] = { enabled: true, range: senses[id] };
    else if ( cfg.mode in (current ?? {}) ) detectionModes[cfg.mode] = new foundry.data.operators.ForcedDeletion();
  }
  return {
    sight: { enabled: true, range: dark ? senses.darksight : 0, visionMode: dark ? "darkvision" : "basic" },
    detectionModes
  };
}

/** A short key for a set of Senses, to tell when they change. */
function signature(senses) {
  return Object.keys(senses).sort().map(k => `${k}:${senses[k] ?? "far"}`).join(",") || "none";
}

/** Whether Tokens follow Senses (a world setting). */
function automated() {
  try { return game.settings.get(SYSTEM_ID, "visionFromSenses") !== false; }
  catch { return true; }
}

/**
 * Set a new Actor's prototype Token vision from its Senses. Call from Actor#_preCreate.
 * @param {Actor} actor
 * @returns {object}  Changes to merge into the prototype Token.
 */
export function prototypeVision(actor) {
  if ( !automated() || !["character", "npc"].includes(actor.type) ) return {};
  const senses = sensesOf(actor);
  return { ...tokenVision(senses), flags: { [SYSTEM_ID]: { senses: signature(senses) } } };
}

/**
 * Bring an Actor's prototype Token and placed Tokens in line with its Senses, if they changed.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function syncVision(actor) {
  if ( !automated() || !["character", "npc"].includes(actor?.type) ) return;
  const flag = `flags.${SYSTEM_ID}.senses`;
  try {
    if ( !actor.isToken && actor.isOwner ) {
      const senses = sensesOf(actor);
      const sig = signature(senses);
      if ( foundry.utils.getProperty(actor.prototypeToken, flag) !== sig ) {
        const proto = tokenVision(senses, actor.prototypeToken._source?.detectionModes ?? actor.prototypeToken.detectionModes);
        await actor.update({ prototypeToken: { ...proto, [flag]: sig } }, { vagabondLog: false });
      }
    }
    // Placed Tokens: the unlinked Token this Actor belongs to, or every Token of this Actor on any Scene.
    const tokens = actor.isToken ? [actor.token]
      : (game.scenes?.contents ?? []).flatMap(s => s.tokens.filter(t => t.actorId === actor.id));
    const byScene = new Map();
    for ( const t of tokens ) {
      if ( !t?.isOwner || !t.actor ) continue;
      const senses = sensesOf(t.actor);
      const sig = signature(senses);
      if ( t.getFlag(SYSTEM_ID, "senses") === sig ) continue;
      const list = byScene.get(t.parent) ?? [];
      list.push({ _id: t.id, ...tokenVision(senses, t._source.detectionModes), [flag]: sig });
      byScene.set(t.parent, list);
    }
    for ( const [scene, updates] of byScene ) await scene.updateEmbeddedDocuments("Token", updates);
  } catch(err) {
    console.warn(`${SYSTEM_ID} | Couldn't update vision for ${actor.name}`, err);
  }
}

/**
 * A new Token copies its prototype's vision, so it starts in line with the Actor's Senses.
 * @param {TokenDocument} token
 */
export function onPreCreateToken(token) {
  const actor = token.actor;
  if ( !automated() || !["character", "npc"].includes(actor?.type) ) return;
  const sig = signature(sensesOf(actor));
  const changes = { [`flags.${SYSTEM_ID}.senses`]: sig };
  // Unlinked Tokens can have their own Senses line; give them their own vision too.
  if ( foundry.utils.getProperty(actor.prototypeToken ?? {}, `flags.${SYSTEM_ID}.senses`) !== sig ) {
    Object.assign(changes, tokenVision(sensesOf(actor)));
  }
  token.updateSource(changes);
}

/**
 * On load, the GM brings every Actor and Token in line with its Senses (only those whose Senses changed).
 * @returns {Promise<void>}
 */
export async function syncAll() {
  if ( !game.user.isGM || !automated() ) return;
  for ( const actor of game.actors ) await syncVision(actor);
}

/* -------------------------------------------- */
/*  Detection modes                             */
/* -------------------------------------------- */

/**
 * Add the Senses Foundry doesn't have: Blindsight and Echolocation (see without sight, so Blinded and Darkness don't
 * stop them, but walls do) and Telepathy (senses minds through walls).
 */
export function registerDetectionModes() {
  const { DetectionMode, DetectionModeAll } = foundry.canvas.perception;
  const { SOUND, OTHER } = DetectionMode.DETECTION_TYPES;
  const Token = foundry.canvas.placeables.Token;
  const blocked = doc => doc.hasStatusEffect(CONFIG.specialStatusEffects.BURROW);

  class DetectionModeNonsight extends DetectionMode {
    /** @override */
    _canDetect(visionSource, target) {
      if ( blocked(visionSource.object.document) ) return false;
      if ( target instanceof Token ) {
        const tgt = target.document;
        if ( tgt.hasStatusEffect(CONFIG.specialStatusEffects.INVISIBLE) || blocked(tgt) ) return false;
      }
      return true;
    }
  }

  class DetectionModeMinds extends DetectionModeAll {
    /** @override */
    _canDetect(visionSource, target) {
      return (target instanceof Token) && !!target.actor && (target.actor !== visionSource.object.actor);
    }
  }

  CONFIG.Canvas.detectionModes.blindsight = new DetectionModeNonsight({
    id: "blindsight", label: "VAGABOND.Senses.blindsight", type: OTHER, walls: true, angle: false
  });
  CONFIG.Canvas.detectionModes.echolocation = new DetectionModeNonsight({
    id: "echolocation", label: "VAGABOND.Senses.echolocation", type: SOUND, walls: true, angle: false
  });
  CONFIG.Canvas.detectionModes.telepathy = new DetectionModeMinds({
    id: "telepathy", label: "VAGABOND.Senses.telepathy", type: OTHER, walls: false, angle: false
  });
}
