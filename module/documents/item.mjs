import * as rules from "../rules.mjs";
import { currentTarget } from "../dice/favor.mjs";
import { postItemCard, rollCheck, rollDamage } from "../dice/rolls.mjs";
import CastDialog from "../applications/cast-dialog.mjs";
import { explodeFormula } from "../class-features.mjs";

/**
 * Extend the base Item with Vagabond usage: attacking, casting, consuming, and posting to chat.
 */
export default class VagabondItem extends Item {

  /** @override */
  static getDefaultArtwork(itemData) {
    const img = CONFIG.VAGABOND?.defaultIcons?.[itemData?.type];
    return img ? { img } : super.getDefaultArtwork(itemData);
  }

  /** @override */
  getRollData() {
    const data = this.actor?.getRollData() ?? {};
    data.item = foundry.utils.deepClone(this.system);
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Use this Item: attack with a Weapon, cast a Spell, use Gear, run an NPC Action, or post it to chat.
   * @param {object} [options]
   * @param {Event} [options.event]
   * @returns {Promise<*>}
   */
  async use({ event } = {}) {
    switch ( this.type ) {
      case "weapon": return this.rollAttack({ event });
      case "spell": return this.cast({ event });
      case "gear": return this.useGear({ event });
      case "action": return this.useAction({ event });
      default: return postItemCard(this);
    }
  }

  /* -------------------------------------------- */
  /*  Weapons                                     */
  /* -------------------------------------------- */

  /**
   * Make an Attack Check with this Weapon (p. 13).
   * @param {object} [options]
   * @param {string} [options.skill]  Attack Skill to use; defaults to the owner's best.
   * @param {Event} [options.event]
   */
  async rollAttack({ skill, event } = {}) {
    const actor = this.actor;
    if ( !actor || (this.type !== "weapon") ) return null;
    if ( actor.type === "npc" ) return postItemCard(this);
    skill ??= this.system.bestSkill;
    const data = actor.system.skills[skill];
    const target = currentTarget();
    const melee = (this.system.range === "close");
    const warnings = [];
    if ( !this.system.equipped ) warnings.push(game.i18n.localize("VAGABOND.Weapon.NotEquipped"));
    if ( this.system.types.ranged && melee === false && target && this.#isClose(target) ) {
      warnings.push(game.i18n.localize("VAGABOND.Weapon.RangedClose"));
    }
    return rollCheck({
      actor, item: this, type: "attack", key: skill, target, melee, event,
      title: game.i18n.format("VAGABOND.Roll.AttackTitle", { item: this.name }),
      subtitle: [game.i18n.localize(CONFIG.VAGABOND.skills[skill]?.label ?? skill), ...warnings].join(" · "),
      difficulty: data.difficulty,
      critOn: this.system.critOn,
      extra: { hasDamage: true, skill, sneakAttack: !!actor.system.featureMods?.sneakAttack && this.system.canSneakAttack(skill) }
    });
  }

  /**
   * Whether a Target token is Close (within 5') to one of the owner's tokens.
   * @param {Actor} target
   * @returns {boolean}
   */
  #isClose(target) {
    try {
      const mine = this.actor.getActiveTokens()[0];
      const theirs = target.getActiveTokens()[0];
      if ( !mine || !theirs ) return false;
      const d = canvas.grid.measurePath([mine.center, theirs.center]).distance;
      return d <= 5;
    } catch { return false; }
  }

  /**
   * Roll this Weapon's damage.
   * @param {object} [options]
   * @param {boolean} [options.crit]
   * @param {string} [options.skill]
   */
  async rollWeaponDamage({ crit = false, skill } = {}) {
    let formula = this.system.damageFormula({ skill, crit });
    const notes = [];
    const berserk = this.actor?.system.featureMods?.berserk;
    if ( berserk?.steps ) notes.push(game.i18n.localize("VAGABOND.Damage.Berserk"));
    if ( berserk?.perDie ) notes.push(game.i18n.format("VAGABOND.Damage.Murder", { n: berserk.perDie }));
    if ( this.actor?.statuses.has("frightened") ) {
      formula = applyPerDie(formula, -2);
      notes.push(game.i18n.localize("VAGABOND.Damage.Frightened"));
    }
    return rollDamage({
      actor: this.actor, item: this, formula, crit, notes,
      damage: this.system.damageInfo,
      title: game.i18n.format("VAGABOND.Roll.DamageTitle", { item: this.name }),
      subtitle: crit ? game.i18n.localize("VAGABOND.Outcome.crit") : ""
    });
  }

  /**
   * Roll Sneak Attack damage: (Level ÷ 3, round up) d4s, which also ignore that much Armor. Lethal Weapon makes them
   * Explode.
   */
  async rollSneakAttack() {
    const sneak = this.actor?.system.featureMods?.sneakAttack;
    if ( !sneak ) return null;
    return rollDamage({
      actor: this.actor, item: this, formula: `${sneak.dice}d4${sneak.explode ? "x" : ""}`,
      damage: this.system.damageInfo,
      title: game.i18n.format("VAGABOND.Feature.SneakAttackTitle", { item: this.name }),
      subtitle: game.i18n.format("VAGABOND.Feature.SneakAttackArmor", { n: sneak.dice })
    });
  }

  /* -------------------------------------------- */
  /*  Spells                                      */
  /* -------------------------------------------- */

  /**
   * Cast this Spell (p. 91). Opens the casting dialog to choose the Delivery, damage and effect, and upcasting,
   * spends the Mana, then rolls the Cast Check (if needed) and posts the Spell with its damage dice.
   * Any Mana spent on a Casting makes it upcast.
   * @param {object} [options]
   * @param {boolean} [options.check]       Skip the dialog: true rolls a Cast Check, false just posts the Spell.
   * @param {object} [options.casting]      A casting chosen in advance, as resolved by the dialog.
   */
  async cast({ check, casting } = {}) {
    const actor = this.actor;
    if ( !actor || (this.type !== "spell") ) return null;
    if ( actor.type === "npc" ) return postItemCard(this);
    const attrs = actor.system.attributes;
    const castInfo = this.system.castInfo ?? attrs.cast;
    if ( actor.statuses.has("berserk") ) {
      ui.notifications.warn(game.i18n.localize("VAGABOND.Cast.Berserk"));
      return null;
    }
    const hasDamage = !!this.system.damageBase && !this.system.noDamage;

    // Posting without a Casting: just share the Spell.
    if ( check === false ) {
      return postItemCard(this, {
        subtitle: castInfo.label ? game.i18n.localize(castInfo.label) : "",
        buttons: hasDamage ? [{ action: "spellDamage", label: "VAGABOND.Roll.Damage", icon: "fa-solid fa-burst", dice: 1 }] : [],
        flags: { cast: { hasDamage, skill: castInfo.skill } }
      });
    }

    casting ??= (check === true)
      ? { delivery: this.system.delivery, steps: 0, damage: hasDamage, effect: !hasDamage, dice: hasDamage ? 1 : 0, mana: 0,
        upcast: false, focus: false, check: true }
      : await CastDialog.prompt(this);
    if ( !casting ) return null;

    // Spend the Mana. The card shows Mana before and after, so no separate sheet note.
    const manaBefore = attrs.mana.value;
    if ( casting.mana > 0 ) {
      if ( casting.mana > manaBefore ) {
        ui.notifications.warn(game.i18n.format("VAGABOND.CastDialog.NotEnoughMana", { mana: manaBefore }));
        return null;
      }
      await actor.update({ "system.attributes.mana.value": manaBefore - casting.mana }, { vagabondLog: false });
    }
    const manaAfter = actor.system.attributes.mana.value;

    const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.system.description, {
      rollData: this.getRollData(), relativeTo: this
    });
    const cfg = CONFIG.VAGABOND;
    const delivery = cfg.deliveries[casting.delivery];
    const summary = [
      game.i18n.localize(delivery?.label ?? casting.delivery)
        + (casting.steps ? ` +${casting.steps}` : ""),
      casting.damage && casting.effect ? game.i18n.localize("VAGABOND.CastDialog.Both")
        : game.i18n.localize(casting.damage ? "VAGABOND.CastDialog.Damage" : "VAGABOND.CastDialog.Effect"),
      game.i18n.format("VAGABOND.CastDialog.ManaSpent", { mana: casting.mana, before: manaBefore, after: manaAfter }),
      casting.upcast ? game.i18n.localize("VAGABOND.CastDialog.Upcast") : "",
      casting.focus ? game.i18n.localize("VAGABOND.Spell.Focus") : ""
    ].filter(Boolean);
    const castFlags = { hasDamage: casting.damage, skill: castInfo.skill, dice: casting.dice, focus: casting.focus,
      summary, mana: casting.mana, manaBefore, manaAfter, upcast: casting.upcast };
    const subtitle = castInfo.label ? game.i18n.localize(castInfo.label) : "";

    if ( !casting.check ) {
      const buttons = [];
      if ( casting.damage ) buttons.push({ action: "spellDamage", label: "VAGABOND.Roll.Damage", icon: "fa-solid fa-burst", dice: casting.dice });
      if ( casting.focus ) buttons.push({ action: "focusMana", label: "VAGABOND.CastDialog.KeepFocus", icon: "fa-solid fa-eye" });
      return postItemCard(this, { subtitle, description, castSummary: summary, buttons, flags: { cast: castFlags } });
    }
    return rollCheck({
      actor, item: this, type: "cast", key: castInfo.skill, target: currentTarget(),
      title: game.i18n.format("VAGABOND.Roll.CastTitle", { item: this.name }),
      subtitle,
      difficulty: castInfo.difficulty,
      critOn: attrs.crit.cast,
      critText: this.system.crit,
      body: description,
      extra: castFlags
    });
  }

  /**
   * Roll Spell damage.
   * @param {object} [options]
   * @param {number} [options.dice=1]
   * @param {boolean} [options.crit]
   * @param {string} [options.skill]   Casting Skill (its Stat is added on a Crit).
   */
  async rollSpellDamage({ dice = 1, crit = false, skill } = {}) {
    const actor = this.actor;
    let flat = 0;
    if ( crit && actor && skill ) flat += actor.system.stats?.[CONFIG.VAGABOND.skills[skill]?.stat]?.value ?? 0;
    let perDie = actor?.system.bonuses?.spellDamagePerDie ?? 0;
    const notes = [];
    if ( actor?.statuses.has("frightened") ) {
      perDie -= 2;
      notes.push(game.i18n.localize("VAGABOND.Damage.Frightened"));
    }
    const formula = rules.damageFormula({
      count: dice, faces: this.system.damageDie, steps: actor?.system.bonuses?.dieStep?.spell ?? 0, perDie, flat
    });
    const base = this.system.damageBase;
    return rollDamage({
      actor, item: this, formula, crit, notes,
      damage: { type: CONFIG.VAGABOND.damageTypes[base] ? base : "magic" },
      title: game.i18n.format("VAGABOND.Roll.DamageTitle", { item: this.name }),
      subtitle: crit ? game.i18n.localize("VAGABOND.Outcome.crit") : ""
    });
  }

  /* -------------------------------------------- */
  /*  Gear                                        */
  /* -------------------------------------------- */

  /**
   * Unpack a Starting Pack onto an Actor: create its Items and hand over its remaining Wealth (p. 74-75).
   * @param {Actor} actor
   * @param {object} [options]
   * @param {boolean} [options.replaceWealth=false]  Set the Actor's coins to the Wealth instead of adding it.
   * @param {boolean} [options.log=true]             Post sheet change notes.
   * @returns {Promise<Item[]>}
   */
  async unpackKit(actor, { replaceWealth = false, log = true, flags } = {}) {
    const op = log ? { vagabondVia: this.name } : { vagabondLog: false };
    if ( !this.system.isKit ) return [];
    const toCreate = [];
    for ( const entry of this.system.contents ) {
      const src = entry.uuid ? await fromUuid(entry.uuid) : null;
      let data;
      if ( src ) {
        data = src.toObject();
        delete data._id;
        foundry.utils.setProperty(data, "_stats.compendiumSource", src.uuid);
      } else data = { name: entry.name || game.i18n.localize("TYPES.Item.gear"), type: "gear", system: {} };
      data.system.quantity = entry.quantity;
      if ( Number.isFinite(entry.value) ) data.system.value = entry.value;
      if ( flags ) data.flags = foundry.utils.mergeObject(data.flags ?? {}, flags);
      toCreate.push(data);
    }
    const created = await actor.createEmbeddedDocuments("Item", toCreate, op);
    const cur = actor.system.currency;
    if ( cur ) {
      const g = Math.floor(this.system.wealth / 100);
      const s = this.system.wealth % 100;
      await actor.update(replaceWealth
        ? { "system.currency.g": g, "system.currency.s": s, "system.currency.c": 0 }
        : { "system.currency.g": cur.g + g, "system.currency.s": cur.s + s }, op);
    }
    return created;
  }

  /**
   * Use Gear: spend a use or one from the stack if consumable, then roll its formula if it has one.
   */
  async useGear() {
    const s = this.system;
    const updates = {};
    if ( s.hasUses ) {
      if ( s.uses.value <= 0 ) {
        ui.notifications.warn(game.i18n.format("VAGABOND.Gear.NoUses", { item: this.name }));
        return null;
      }
      updates["system.uses.value"] = s.uses.value - 1;
    } else if ( s.consumable ) {
      if ( s.quantity <= 0 ) {
        ui.notifications.warn(game.i18n.format("VAGABOND.Gear.NoneLeft", { item: this.name }));
        return null;
      }
      updates["system.quantity"] = s.quantity - 1;
    }
    if ( !foundry.utils.isEmpty(updates) ) await this.update(updates, { vagabondVia: game.i18n.localize("VAGABOND.SheetLog.Used") });
    const buttons = s.hasRoll ? [{ action: "gearRoll", label: "VAGABOND.Roll.Roll", icon: "fa-solid fa-dice" }] : [];
    return postItemCard(this, { buttons });
  }

  /**
   * Roll this Gear's formula as damage or healing.
   */
  async rollGear() {
    const s = this.system;
    if ( !s.roll.formula ) return null;
    // Mana potions restore the owner's Mana directly.
    if ( (s.roll.type === "mana") && this.actor ) {
      const roll = await new Roll(s.roll.formula, this.getRollData()).evaluate();
      const mana = this.actor.system.attributes.mana;
      const value = Math.min(mana.max, mana.value + roll.total);
      await this.actor.update({ "system.attributes.mana.value": value });
      return roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.format("VAGABOND.Gear.ManaRestored", { item: this.name, mana: value - mana.value })
      });
    }
    let formula = s.roll.formula;
    // Potency (Alchemist): a bonus to each damage and healing die of Alchemical Items, which can Explode.
    const potency = this.actor?.system.featureMods?.alchemy;
    if ( potency && ((s.category === "alchemical") || s.alchemicalType) && ["damage", "healing"].includes(s.roll.type) ) {
      formula = explodeFormula(applyPerDie(formula, potency.perDie));
    }
    return rollDamage({
      actor: this.actor, item: this, formula,
      healing: s.roll.type === "healing",
      damage: { type: s.roll.damageType },
      save: s.roll.save,
      title: this.name
    });
  }

  /* -------------------------------------------- */
  /*  NPC Actions                                 */
  /* -------------------------------------------- */

  /**
   * Use an NPC Action: post its card with Save buttons for Heroes and a damage or healing roll. A Combo isn't an
   * attack of its own: its card has a button for each attack it names ("8×Claw" is eight Claw attacks).
   */
  async useAction() {
    const s = this.system;
    const buttons = [];
    const saveLabel = key => game.i18n.localize(CONFIG.VAGABOND.saves[key]?.label ?? key);
    if ( s.isCombo ) {
      const others = this.actor?.items.filter(i => (i.type === "action") && (i.id !== this.id)) ?? [];
      for ( const part of rules.comboParts(s.description, others.map(i => i.name)) ) {
        const item = others.find(i => i.name === part.name);
        buttons.push({
          action: "comboUse", itemId: item.id, icon: "fa-solid fa-hand-fist",
          label: part.count ? game.i18n.format("VAGABOND.Action.ComboUse", { name: item.name, count: part.count }) : item.name
        });
      }
    }
    for ( const save of s.saveList ?? [] ) buttons.push({
      action: "save", save, icon: "fa-solid fa-shield-halved",
      label: game.i18n.format("VAGABOND.Action.SaveButton", { save: saveLabel(save) })
    });
    for ( const save of s.effectSaveList ?? [] ) buttons.push({
      action: "save", save, effect: true, icon: "fa-solid fa-shield-virus",
      label: game.i18n.format("VAGABOND.Action.EffectSaveButton", { save: saveLabel(save) })
    });
    if ( s.damage && !s.isCombo ) buttons.push(s.healing
      ? { action: "actionDamage", label: "VAGABOND.Damage.Healing", icon: "fa-solid fa-heart" }
      : { action: "actionDamage", label: "VAGABOND.Roll.Damage", icon: "fa-solid fa-burst" });
    return postItemCard(this, {
      buttons,
      note: s.isCombo ? game.i18n.localize("VAGABOND.Action.ComboHint") : "",
      flags: { action: { save: s.save, vsAttack: ["melee", "ranged", "attack"].includes(s.actionType), vsCast: s.actionType === "cast" } }
    });
  }

  /**
   * Roll or take the average of an NPC Action's damage (or healing).
   */
  async rollActionDamage() {
    const s = this.system;
    const average = game.settings.get("vagabond-rpg", "npcDamage") === "average";
    let formula = s.damage;
    if ( average && Number.isFinite(s.average) && (s.average !== null) ) formula = String(s.average);
    const notes = [];
    if ( !s.healing && this.actor?.statuses.has("frightened") ) {
      const before = formula;
      formula = applyPerDie(formula, -2);
      if ( formula !== before ) notes.push(game.i18n.localize("VAGABOND.Damage.Frightened"));
    }
    const saves = s.healing ? [] : [
      ...(s.saveList ?? []).map(save => ({ save })),
      ...(s.effectSaveList ?? []).map(save => ({ save, effect: true }))
    ];
    return rollDamage({
      actor: this.actor, item: this, formula, notes,
      healing: !!s.healing,
      damage: s.damageInfo ?? {},
      saves,
      title: game.i18n.format(s.healing ? "VAGABOND.Roll.HealingTitle" : "VAGABOND.Roll.DamageTitle", { item: this.name })
    });
  }
}

/**
 * Add a per-die modifier to a formula by counting its dice (used by Frightened, p. 11).
 * @param {string} formula
 * @param {number} perDie
 * @returns {string}
 */
export function applyPerDie(formula, perDie) {
  let dice = 0;
  for ( const [, n] of String(formula).matchAll(/(\d*)d\d+/gi) ) dice += Number(n || 1);
  if ( !dice ) return formula;
  const mod = dice * perDie;
  return `${formula} ${mod < 0 ? "-" : "+"} ${Math.abs(mod)}`;
}
