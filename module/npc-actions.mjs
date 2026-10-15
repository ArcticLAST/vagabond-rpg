import * as rules from "./rules.mjs";

/**
 * Turn an Item dropped on an NPC into a statblock Action (p. 108-109), so it works like the Bestiary's own:
 * Weapons become Melee or Ranged Attacks, Spells become Casts, and Perks, Class Features, and Ancestry Traits
 * become Abilities. Heroes make Reflex Saves to avoid Enemy Actions unless otherwise stated (p. 14), and Enemies
 * don't track Mana (p. 14), so a Spell becomes a Cast with its base damage die and no Mana cost.
 * @param {Item} item
 * @param {Actor} actor    The NPC receiving it.
 * @returns {object|null}  Action Item data, or null when the Item stays as it is.
 */
export function actionFromItem(item, actor) {
  const make = { weapon: fromWeapon, spell: fromSpell, perk: fromAbility, feature: fromAbility }[item.type];
  const data = make?.(item);
  if ( !data ) return null;
  const isAbility = data.actionType === "ability";
  const siblings = actor.items.filter(i => (i.type === "action") && ((i.system.actionType === "ability") === isAbility));
  const sort = Math.max(isAbility ? 99 : -1, ...siblings.map(i => i.system.sort ?? 0)) + 1;
  const average = data.damage ? rules.averageDamage(data.damage) : null;
  const lead = data.damage ? `<p>${average ?? ""} (${data.damage})${data.lead ? ` ${data.lead}` : ""}</p>` : "";
  return {
    name: item.name,
    type: "action",
    img: CONFIG.VAGABOND.defaultIcons.action,
    sort: sort * 100,
    system: {
      description: lead + (data.text ?? ""),
      source: item.system.source ?? "",
      actionType: data.actionType,
      tags: data.tags ?? "",
      damage: data.damage ?? "",
      average,
      damageType: data.damageType ?? "",
      relic: data.relic ?? 0,
      save: data.save ?? "",
      healing: false,
      recharge: "",
      sort
    },
    flags: { "vagabond-rpg": { fromItem: item.uuid ?? null } }
  };
}

/* -------------------------------------------- */

/** A Weapon as a Melee or Ranged Attack, with its damage die, damage type, and Relic bonus. */
function fromWeapon(item) {
  const s = item.system;
  const ranged = s.types?.ranged && !s.types.melee && !s.types.brawl && !s.types.finesse;
  const tags = [game.i18n.localize(ranged ? "VAGABOND.ActionType.ranged" : "VAGABOND.ActionType.melee")];
  // Melee Attacks assume Close and Ranged Attacks assume Far unless indicated (p. 14).
  if ( ranged && s.range && (s.range !== "far") ) tags.push(game.i18n.localize(CONFIG.VAGABOND.ranges[s.range] ?? s.range));
  if ( !ranged && s.properties?.thrown ) tags.push(game.i18n.localize("VAGABOND.WeaponProperty.thrown"));
  return {
    actionType: ranged ? "ranged" : "melee",
    tags: tags.join(", "),
    damage: s.damage || "d6",
    damageType: s.damageType || "physical",
    relic: s.bonus ?? 0,
    save: "reflex"
  };
}

/** A Spell as a Cast with its default Delivery and one die of its Damage Base. */
function fromSpell(item) {
  const s = item.system;
  const delivery = CONFIG.VAGABOND.deliveries[s.delivery];
  const tags = [game.i18n.localize("VAGABOND.ActionType.cast")];
  if ( delivery ) tags.push(game.i18n.localize(delivery.label));
  if ( s.focus ) tags.push(game.i18n.localize("VAGABOND.Spell.Focus"));
  let text = s.description ?? "";
  if ( s.crit ) text += `<p><strong>${game.i18n.localize("VAGABOND.Spell.Crit")}:</strong> ${s.crit}</p>`;
  const damages = !s.noDamage && s.damageBase;
  return {
    actionType: "cast",
    tags: tags.join(", "),
    damage: damages ? `d${s.damageDie || 6}` : "",
    damageType: damages ? (CONFIG.VAGABOND.damageTypes[s.damageBase] ? s.damageBase : "magic") : "",
    save: damages ? "reflex" : "",
    text
  };
}

/** A Perk, Class Feature, or Ancestry Trait as an Ability. */
function fromAbility(item) {
  return { actionType: "ability", tags: "", text: item.system.description ?? "" };
}
