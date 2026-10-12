import * as rules from "./rules.mjs";
import { postCheckCard } from "./dice/rolls.mjs";

/**
 * Wire chat card buttons with a single delegated listener, so it works the same in the sidebar, popouts,
 * and notifications.
 */
export function registerChatListeners() {
  document.addEventListener("click", onChatButton);
}

/**
 * Handle a click on any [data-vg-action] inside a chat message.
 * @param {PointerEvent} event
 */
async function onChatButton(event) {
  const button = event.target.closest?.("[data-vg-action]");
  if ( !button ) return;
  const li = button.closest("[data-message-id]");
  const message = game.messages.get(li?.dataset.messageId);
  if ( !message ) return;
  event.preventDefault();
  event.stopPropagation();
  button.disabled = true;
  try {
    await handleAction(button.dataset.vgAction, button, message, event);
  } catch ( err ) {
    console.error(err);
    ui.notifications.error(err.message);
  } finally {
    button.disabled = false;
  }
}

/**
 * The Actors a button should affect: controlled tokens, else targets, else the user's character.
 * @param {object} [options]
 * @param {boolean} [options.preferTargets]
 * @returns {Actor[]}
 */
function affectedActors({ preferTargets = false } = {}) {
  const controlled = canvas?.tokens?.controlled ?? [];
  const targets = Array.from(game.user.targets ?? []);
  const ordered = preferTargets ? [targets, controlled] : [controlled, targets];
  for ( const list of ordered ) {
    const actors = list.map(t => t.actor).filter(a => a?.isOwner);
    if ( actors.length ) return actors;
  }
  return game.user.character ? [game.user.character] : [];
}

/**
 * Dispatch a chat card action.
 */
/**
 * Read the damage dice count typed on a Spell card (1 + any Mana spent upcasting damage).
 * @param {HTMLElement} button
 * @returns {number}
 */
function diceCount(button) {
  const input = button.closest(".chat-card")?.querySelector("input[name=dice]");
  return Math.max(1, Math.floor(Number(input?.value) || 1));
}

async function handleAction(action, button, message, event) {
  const flags = message.flags["vagabond-rpg"] ?? {};
  const check = flags.check;
  const itemFlags = flags.item;

  switch ( action ) {
    // Damage from an Attack or Cast Check. Crit damage is one of the choices a Crit offers (critDamage below).
    case "damage":
    case "critDamage": {
      const item = await fromUuid(check?.itemUuid);
      if ( !item ) return;
      const crit = action === "critDamage";
      if ( crit && !(await useCritChoice(message, "damage")) ) return;
      if ( item.type === "weapon" ) return item.rollWeaponDamage({ crit, skill: check.skill });
      if ( item.type === "spell" ) return item.rollSpellDamage({ dice: diceCount(button), crit, skill: check.skill });
      return;
    }

    // A Crit on any Check can instead give 1 Luck (p. 8).
    case "critLuck": {
      const actor = await fromUuid(check?.actorUuid ?? "");
      if ( !actor?.isOwner ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Chat.NotOwner"));
      if ( !(await useCritChoice(message, "luck")) ) return;
      return actor.update({ "system.attributes.luck.value": (actor.system.attributes.luck.value ?? 0) + 1 },
        { vagabondVia: game.i18n.localize("VAGABOND.SheetLog.Crit") });
    }

    // Sneak Attack: extra d4s on the first Favored hit of the Turn (Rogue).
    case "sneakAttack": {
      const item = await fromUuid(check?.itemUuid);
      return item?.rollSneakAttack();
    }

    // Damage from a Spell cast without a Cast Check
    case "spellDamage": {
      const item = await fromUuid(itemFlags?.uuid);
      return item?.rollSpellDamage({ dice: diceCount(button), skill: itemFlags.cast?.skill });
    }

    // Keep Focus on a Spell: spend 1 Mana (p. 91).
    case "focusMana": {
      const item = await fromUuid(check?.itemUuid ?? itemFlags?.uuid);
      const actor = item?.actor;
      if ( !actor?.isOwner ) return;
      const mana = actor.system.attributes.mana.value;
      if ( mana < 1 ) return ui.notifications.warn(game.i18n.format("VAGABOND.CastDialog.NotEnoughMana", { mana }));
      await actor.update({ "system.attributes.mana.value": mana - 1 }, { vagabondVia: game.i18n.format("VAGABOND.SheetLog.Focus", { item: item.name }) });
      return ui.notifications.info(game.i18n.format("VAGABOND.CastDialog.FocusPaid", { name: actor.name, item: item.name, mana: mana - 1 }));
    }

    case "actionDamage": {
      const item = await fromUuid(itemFlags?.uuid);
      return item?.rollActionDamage();
    }

    // A Combo's button: use one of the attacks it names.
    case "comboUse": {
      const combo = await fromUuid(itemFlags?.uuid);
      const item = combo?.actor?.items.get(button.dataset.itemId);
      return item?.use({ event });
    }

    case "gearRoll": {
      const item = await fromUuid(itemFlags?.uuid);
      return item?.rollGear();
    }

    // Heightened Intellect / Cognition: spend a Studied die to pass a failed Check (p. 69).
    case "studyPass": {
      const actor = await fromUuid(check?.actorUuid ?? "");
      if ( !actor?.isOwner ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Chat.NotOwner"));
      const have = actor.system.attributes.studied ?? 0;
      if ( have < 1 ) return ui.notifications.warn(game.i18n.format("VAGABOND.Studied.None", { name: actor.name }));
      await actor.update({ "system.attributes.studied": have - 1 });
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="vagabond chat-card"><p><i class="fa-solid fa-book-open"></i> ${game.i18n.format("VAGABOND.Studied.Passed", {
          name: actor.name, check: message.flavor ?? "" })}</p></div>`
      });
    }

    // Fluke: spend 1 Luck to reroll the d20 (p. 22).
    case "fluke": return fluke(message, check);

    // Saves forced by an NPC Action or a damage card
    case "save": {
      const save = button.dataset.save;
      const source = await fromUuid(itemFlags?.uuid ?? "").then(i => i?.actor).catch(() => null)
        ?? await fromUuid(flags.damage?.sourceUuid ?? "").catch(() => null);
      // A Save made after a hit (effect) isn't a Save against the attack itself.
      const vsAttack = button.dataset.effect ? false : (itemFlags?.action?.vsAttack ?? true);
      const vsCast = !!itemFlags?.action?.vsCast;
      const actors = affectedActors().filter(a => a.type === "character");
      if ( !actors.length ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Chat.NoActors"));
      for ( const actor of actors ) await actor.rollSave(save, { source, vsAttack, vsCast, event });
      return;
    }

    // Apply damage or healing
    case "apply": {
      const total = Number(button.closest("[data-total]")?.dataset.total ?? flags.damage?.total ?? 0);
      const mode = button.dataset.mode;
      const actors = affectedActors({ preferTargets: false });
      if ( !actors.length ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Chat.NoActors"));
      for ( const actor of actors ) {
        if ( mode === "heal" ) await actor.applyDamage(total, { multiplier: -1 });
        else await actor.applyDamage(total, {
          ignoreArmor: mode === "ignoreArmor",
          multiplier: mode === "half" ? 0.5 : 1,
          damage: flags.damage
        });
      }
      return;
    }
  }
}

/**
 * Reroll the d20 of a Check by spending Luck.
 * @param {ChatMessage} message
 * @param {object} check
 */
async function fluke(message, check) {
  if ( !check ) return;
  const actor = await fromUuid(check.actorUuid);
  if ( !actor?.isOwner ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Chat.NotOwner"));
  if ( !(await actor.spendLuck()) ) return;
  const rest = check.total - check.natural;
  const formula = rest ? `1d20 ${rest < 0 ? "-" : "+"} ${Math.abs(rest)}` : "1d20";
  const roll = await new Roll(formula).evaluate();
  const natural = roll.dice[0].total;
  const { outcome, margin } = rules.resolveCheck({
    total: roll.total, natural, difficulty: check.difficulty, critOn: check.critOn
  });
  const item = check.itemUuid ? await fromUuid(check.itemUuid) : null;
  const title = message.flavor || game.i18n.localize("VAGABOND.Luck.Fluke");
  return postCheckCard({
    actor, item, roll, fluke: true,
    config: { title, subtitle: game.i18n.localize("VAGABOND.Luck.Fluke"), critText: item?.system?.crit ?? "" },
    flags: { ...check, outcome, margin, natural, total: roll.total }
  });
}

/**
 * Spend a Check card's Crit: only one of its choices can be taken. The choice buttons are swapped for a note saying
 * which was taken.
 * @param {ChatMessage} message
 * @param {string} choice   damage | luck
 * @returns {Promise<boolean>}  False if the Crit was already used.
 */
async function useCritChoice(message, choice) {
  const used = message.getFlag("vagabond-rpg", "critUsed");
  if ( used ) {
    ui.notifications.warn(game.i18n.localize("VAGABOND.Crit.Used"));
    return false;
  }
  const label = game.i18n.localize(choice === "luck" ? "VAGABOND.Crit.TookLuck" : "VAGABOND.Crit.TookDamage");
  const content = message.content.replace(/<div class="crit-choice"[\s\S]*?<\/div>/,
    `<div class="crit-choice used"><span class="crit-choice-label"><i class="fa-solid fa-star"></i> ${label}</span></div>`);
  if ( message.isOwner ) await message.update({ content, "flags.vagabond-rpg.critUsed": choice });
  return true;
}
