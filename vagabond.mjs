/**
 * Vagabond (Alpha 3) for Foundry Virtual Tabletop.
 * An unofficial game system for Vagabond: Pulp Fantasy RPG, structured after the dnd5e system.
 */
import { VAGABOND } from "./module/config.mjs";
import * as rules from "./module/rules.mjs";
import * as dataModels from "./module/data/_module.mjs";
import VagabondActor from "./module/documents/actor.mjs";
import VagabondItem from "./module/documents/item.mjs";
import VagabondActiveEffect from "./module/documents/active-effect.mjs";
import CharacterSheet from "./module/applications/character-sheet.mjs";
import NPCSheet from "./module/applications/npc-sheet.mjs";
import StorageSheet from "./module/applications/storage-sheet.mjs";
import VagabondItemSheet from "./module/applications/item-sheet.mjs";
import HeroBuilder from "./module/applications/hero-builder.mjs";
import RelicBuilder from "./module/applications/relic-builder.mjs";
import CreatureBuilder from "./module/applications/creature-builder.mjs";
import { registerChatListeners } from "./module/chat.mjs";
import * as transfer from "./module/transfer.mjs";
import * as dice from "./module/dice/rolls.mjs";
import * as vision from "./module/vision.mjs";
import { migrateIcons } from "./module/migrate-icons.mjs";

const SYSTEM_ID = "vagabond-rpg";

globalThis.vagabond = {
  config: VAGABOND,
  rules,
  dice,
  transfer,
  dataModels,
  documents: { VagabondActor, VagabondItem, VagabondActiveEffect },
  applications: { CharacterSheet, NPCSheet, StorageSheet, VagabondItemSheet, HeroBuilder, RelicBuilder, CreatureBuilder }
};

/* -------------------------------------------- */
/*  Init                                        */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log(`Vagabond | Initializing\n${VAGABOND.ASCII}`);
  CONFIG.VAGABOND = VAGABOND;

  // Documents and data models
  CONFIG.Actor.documentClass = VagabondActor;
  CONFIG.Item.documentClass = VagabondItem;
  CONFIG.ActiveEffect.documentClass = VagabondActiveEffect;
  Object.assign(CONFIG.Actor.dataModels, dataModels.actor);
  Object.assign(CONFIG.Item.dataModels, dataModels.item);

  // Tokens
  CONFIG.Actor.trackableAttributes = {
    character: { bar: ["attributes.hp", "attributes.mana", "attributes.luck"], value: ["attributes.fatigue", "attributes.armor"] },
    npc: { bar: ["attributes.hp"], value: ["attributes.armor", "attributes.morale"] },
    vehicle: { bar: ["attributes.hp"], value: ["attributes.armor", "attributes.speed"] },
    container: { bar: [], value: [] }
  };

  // Combat: Heroes take the first Turn, then Enemies (p. 13). Ties within a group break randomly.
  CONFIG.Combat.initiative = { formula: "@groupInit + 1d20 / 100", decimals: 2 };

  // Status effects
  CONFIG.statusEffects = VAGABOND.statusEffects.map(s => ({ ...s }));
  CONFIG.specialStatusEffects.DEFEATED = "dead";
  CONFIG.specialStatusEffects.BLIND = "blinded";
  CONFIG.specialStatusEffects.INVISIBLE = "invisible";

  // Vision: Senses as Token detection modes (p. 9).
  vision.registerDetectionModes();
  Hooks.on("preCreateToken", vision.onPreCreateToken);

  // Sheets
  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);
  DocumentSheetConfig.unregisterSheet(Item, "core", foundry.appv1.sheets.ItemSheet);
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, CharacterSheet, {
    types: ["character"], makeDefault: true, label: "VAGABOND.Sheet.Character"
  });
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, NPCSheet, {
    types: ["npc"], makeDefault: true, label: "VAGABOND.Sheet.NPC"
  });
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, StorageSheet, {
    types: ["container", "vehicle"], makeDefault: true, label: "VAGABOND.Sheet.Storage"
  });
  DocumentSheetConfig.registerSheet(Item, SYSTEM_ID, VagabondItemSheet, {
    makeDefault: true, label: "VAGABOND.Sheet.Item"
  });

  registerSettings();
  registerHandlebarsHelpers();
  preloadTemplates();
});

/* -------------------------------------------- */

function registerSettings() {
  game.settings.register(SYSTEM_ID, "npcDamage", {
    name: "VAGABOND.Settings.NPCDamage.Name",
    hint: "VAGABOND.Settings.NPCDamage.Hint",
    scope: "world", config: true, type: String, default: "roll",
    choices: { roll: "VAGABOND.Settings.NPCDamage.Roll", average: "VAGABOND.Settings.NPCDamage.Average" }
  });
  game.settings.register(SYSTEM_ID, "sheetLog", {
    name: "VAGABOND.Settings.SheetLog.Name",
    hint: "VAGABOND.Settings.SheetLog.Hint",
    scope: "world", config: true, type: String, default: "all",
    choices: { all: "VAGABOND.Settings.SheetLog.All", gm: "VAGABOND.Settings.SheetLog.GM", off: "VAGABOND.Settings.SheetLog.Off" }
  });
  game.settings.register(SYSTEM_ID, "visionFromSenses", {
    name: "VAGABOND.Settings.Vision.Name",
    hint: "VAGABOND.Settings.Vision.Hint",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: value => { if ( value ) vision.syncAll(); }
  });
  game.settings.register(SYSTEM_ID, "iconsVersion", { scope: "world", config: false, type: Number, default: 0 });
  game.settings.register(SYSTEM_ID, "burningReminder", {
    name: "VAGABOND.Settings.Burning.Name",
    hint: "VAGABOND.Settings.Burning.Hint",
    scope: "world", config: true, type: Boolean, default: true
  });
}

function registerHandlebarsHelpers() {
  Handlebars.registerHelper("vgArray", (...args) => args.slice(0, -1));
  Handlebars.registerHelper("vgSigned", n => (Number(n) >= 0 ? `+${n}` : `${n}`));
}

function preloadTemplates() {
  const base = `systems/${SYSTEM_ID}/templates`;
  return foundry.applications.handlebars.loadTemplates([
    `${base}/actor/parts/item-controls.hbs`,
    `${base}/actor/parts/item-description.hbs`,
    `${base}/actor/storage-header.hbs`,
    `${base}/actor/storage-cargo.hbs`,
    `${base}/actor/storage-description.hbs`,
    ...["_physical", "_rows", "weapon", "armor", "gear", "spell", "perk", "feature", "class", "ancestry", "action"]
      .map(p => `${base}/item/parts/${p}.hbs`),
    `${base}/chat/check-card.hbs`,
    `${base}/chat/damage-card.hbs`,
    `${base}/chat/item-card.hbs`,
    `${base}/apps/parts/skill-picker.hbs`,
    `${base}/apps/parts/item-picker.hbs`,
    `${base}/apps/relic-builder.hbs`,
    `${base}/apps/creature-builder.hbs`
  ]);
}

/* -------------------------------------------- */
/*  Ready                                       */
/* -------------------------------------------- */

Hooks.once("ready", () => {
  registerChatListeners();
  transfer.registerSocket();
  // Riders prepared before their Mount existed during world load pick up its Speed now.
  for ( const actor of game.actors ) if ( actor.system.attributes?.mount ) actor.reset();
  // Token vision follows Senses; catch up Actors made before this existed or changed while it was off.
  vision.syncAll();
  // Worlds made before the system had its own icons pick them up once.
  migrateIcons().catch(err => console.error(`${SYSTEM_ID} | Icon update failed`, err));
});

/* -------------------------------------------- */
/*  Mounts, Vehicles, and storage               */
/* -------------------------------------------- */

/**
 * Riders use their Mount's Speed, so refresh them when the Mount changes or goes away.
 * @param {Actor} mount
 */
function refreshRiders(mount) {
  for ( const actor of game.actors ) {
    if ( (actor.type !== "character") || (actor.system.attributes.mount !== mount.uuid) ) continue;
    actor.reset();
    if ( actor.sheet?.rendered ) actor.sheet.render();
  }
}
Hooks.on("deleteActor", actor => refreshRiders(actor));
Hooks.on("updateActor", (actor, changes) => {
  if ( ["npc", "vehicle"].includes(actor.type) ) refreshRiders(actor);
  // Vehicle sheets list who is aboard.
  if ( (actor.type === "character") && foundry.utils.hasProperty(changes, "system.attributes.mount") ) {
    for ( const v of game.actors.filter(a => (a.type === "vehicle") && a.sheet?.rendered) ) v.sheet.render();
  }
});

/* -------------------------------------------- */
/*  Builders in the sidebar                     */
/* -------------------------------------------- */

/**
 * Add a GM-only builder button to the header of a sidebar directory.
 * @param {HTMLElement} html
 * @param {string} label
 * @param {string} icon
 * @param {Function} open
 */
function addDirectoryButton(html, label, icon, open) {
  if ( !game.user.isGM ) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const actions = root?.querySelector(".header-actions");
  if ( !actions || actions.querySelector(".vagabond-builder-button") ) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vagabond-builder-button";
  button.innerHTML = `<i class="${icon}"></i> ${game.i18n.localize(label)}`;
  button.addEventListener("click", open);
  actions.append(button);
}

Hooks.on("renderActorDirectory", (app, html) => addDirectoryButton(html, "VAGABOND.CreatureBuilder.Open", "fa-solid fa-dragon",
  () => new CreatureBuilder().render({ force: true })));

Hooks.on("renderItemDirectory", (app, html) => addDirectoryButton(html, "VAGABOND.RelicBuilder.Open", "fa-solid fa-gem",
  () => new RelicBuilder().render({ force: true })));

/* -------------------------------------------- */
/*  Combat reminders                            */
/* -------------------------------------------- */

/**
 * Remind the GM when a Burning combatant starts its Turn (p. 11).
 */
Hooks.on("updateCombat", (combat, changed) => {
  if ( !game.user.isActiveGM || !("turn" in changed || "round" in changed) ) return;
  if ( !game.settings.get(SYSTEM_ID, "burningReminder") ) return;
  const actor = combat.combatant?.actor;
  if ( !actor?.statuses.has("burning") ) return;
  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="vagabond chat-card"><p><i class="fa-solid fa-fire"></i> ${game.i18n.format("VAGABOND.Status.BurningReminder", { name: actor.name })}</p></div>`
  });
});

/**
 * Drag Items from a sheet to the hotbar to create a macro that uses them.
 */
Hooks.on("hotbarDrop", (bar, data, slot) => {
  if ( data.type !== "Item" ) return;
  createItemMacro(data, slot);
  return false;
});

async function createItemMacro(data, slot) {
  const item = await fromUuid(data.uuid);
  if ( !item ) return;
  const command = `const item = await fromUuid("${item.uuid}");\nif ( item ) item.use({ event });`;
  let macro = game.macros.find(m => (m.name === item.name) && (m.command === command));
  macro ??= await Macro.create({ name: item.name, type: "script", img: item.img, command, flags: { [SYSTEM_ID]: { itemMacro: true } } });
  game.user.assignHotbarMacro(macro, slot);
}
