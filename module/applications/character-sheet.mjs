import BaseActorSheet from "./base-actor-sheet.mjs";
import * as rules from "../rules.mjs";
import HeroBuilder from "./hero-builder.mjs";
import { giveStudied } from "../transfer.mjs";
import * as history from "../history.mjs";

/**
 * The Hero sheet, laid out after the dnd5e character sheet: a header with resources, a sidebar of Stats
 * and Saves, and tabs for Skills & Attacks, Inventory, Magic, Features, Effects, and Biography.
 */
export default class CharacterSheet extends BaseActorSheet {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["character"],
    position: { width: 860, height: 820 },
    actions: {
      rollSkill: CharacterSheet.#onRollSkill,
      rollStat: CharacterSheet.#onRollStat,
      rollAttack: CharacterSheet.#onRollAttack,
      toggleTrained: CharacterSheet.#onToggleTrained,
      setFatigue: CharacterSheet.#onSetFatigue,
      rest: CharacterSheet.#onRest,
      breather: CharacterSheet.#onBreather,
      postFeature: CharacterSheet.#onPostFeature,
      setRollMode: CharacterSheet.#onSetRollMode,
      postSpell: CharacterSheet.#onPostSpell,
      toggleReady: CharacterSheet.#onToggleReady,
      toggleStudied: CharacterSheet.#onToggleStudied,
      study: CharacterSheet.#onStudy,
      giveStudied: CharacterSheet.#onGiveStudied,
      openBuilder: CharacterSheet.#onOpenBuilder,
      levelUp: CharacterSheet.#onLevelUp,
      craftFormula: CharacterSheet.#onCraftFormula,
      learnFormula: CharacterSheet.#onLearnFormula,
      forgetFormula: CharacterSheet.#onForgetFormula
    }
  };

  /** @override */
  static PARTS = {
    header: { template: "systems/vagabond-rpg/templates/actor/character-header.hbs" },
    sidebar: { template: "systems/vagabond-rpg/templates/actor/character-sidebar.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    skills: { template: "systems/vagabond-rpg/templates/actor/tab-skills.hbs", scrollable: [""] },
    inventory: { template: "systems/vagabond-rpg/templates/actor/tab-inventory.hbs", scrollable: [""] },
    magic: { template: "systems/vagabond-rpg/templates/actor/tab-magic.hbs", scrollable: [""] },
    features: { template: "systems/vagabond-rpg/templates/actor/tab-features.hbs", scrollable: [""] },
    effects: { template: "systems/vagabond-rpg/templates/actor/tab-effects.hbs", scrollable: [""] },
    biography: { template: "systems/vagabond-rpg/templates/actor/tab-biography.hbs", scrollable: [""] }
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "skills" },
        { id: "inventory" },
        { id: "magic" },
        { id: "features" },
        { id: "effects" },
        { id: "biography" }
      ],
      initial: "skills",
      labelPrefix: "VAGABOND.Tab"
    }
  };

  /** Item types a Hero can hold. */
  static ALLOWED_ITEM_TYPES = ["weapon", "armor", "gear", "spell", "perk", "feature", "class", "ancestry"];

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;
    const cfg = CONFIG.VAGABOND;
    context.tabs = this._prepareTabs("primary");

    context.classItem = system.classItem;
    const favor = system.attributes.favor ?? 0;
    context.rollModes = [
      { value: -1, label: "VAGABOND.Roll.Hinder", icon: "fa-solid fa-angles-down", cssClass: "hinder" },
      { value: 0, label: "VAGABOND.Roll.Normal", icon: "fa-solid fa-equals", cssClass: "normal" },
      { value: 1, label: "VAGABOND.Roll.Favor", icon: "fa-solid fa-angles-up", cssClass: "favor" }
    ].map(m => ({ ...m, active: m.value === favor }));
    context.ancestryItem = system.ancestryItem;

    context.stats = Object.entries(system.stats).map(([key, stat]) => ({
      key, value: stat.value, label: stat.label, abbr: stat.abbr, hint: cfg.stats[key].hint,
      field: system.schema.getField(`stats.${key}.value`), name: `system.stats.${key}.value`
    }));

    context.saves = Object.entries(system.saves).map(([key, save]) => ({
      key, label: save.label, hint: cfg.saves[key].hint,
      difficulty: save.difficulty
    }));

    context.skills = Object.entries(system.skills).map(([key, skill]) => ({
      key, label: skill.label, trained: skill.trained,
      stat: game.i18n.localize(cfg.stats[skill.stat].abbr),
      difficulty: skill.difficulty,
      attack: !!cfg.skills[key].attack,
      casting: key === system.attributes.cast.skill && system.attributes.isCaster
    }));

    const attrs = system.attributes;
    context.fatiguePips = Array.fromRange(5, 1).map(n => ({ n, active: n <= attrs.fatigue }));
    context.hpBar = { pct: attrs.hp.pct, value: attrs.hp.value, max: attrs.hp.max };
    context.manaBar = { pct: attrs.mana.pct, value: attrs.mana.value, max: attrs.mana.max };
    context.slotsBar = { pct: attrs.slots.pct, value: attrs.slots.value, max: attrs.slots.max, over: attrs.slots.over };
    context.warnings = this._prepareWarnings();

    await this._prepareItems(context);
    context.biographyHTML = await this._enrich(system.details.biography);
    context.notesHTML = await this._enrich(system.details.notes);
    context.history = history.entries(this.actor);
    context.sizes = cfg.sizes;
    context.beingTypes = cfg.beingTypes;
    context.castingSkills = Object.fromEntries(Object.entries(cfg.skills).map(([k, v]) => [k, v.label]));
    return context;
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if ( context.tabs?.[partId] ) context.tab = context.tabs[partId];
    return context;
  }

  /**
   * Conditions worth flagging on the sheet.
   * @returns {string[]}
   */
  _prepareWarnings() {
    const a = this.actor.system.attributes;
    const warnings = [];
    if ( a.armorTooHeavy ) warnings.push("VAGABOND.Warning.ArmorTooHeavy");
    if ( a.weaponsOverLimit ) warnings.push("VAGABOND.Warning.WeaponsOverLimit");
    if ( a.slots.over ) warnings.push("VAGABOND.Warning.OverSlots");
    if ( a.spellsKnown.max && (a.spellsKnown.value > a.spellsKnown.max) ) warnings.push("VAGABOND.Warning.TooManySpells");
    if ( a.fatigue >= 3 ) warnings.push(a.fatigue >= 5 ? "VAGABOND.Warning.Fatigue5" : "VAGABOND.Warning.Fatigue3");
    return warnings;
  }

  /**
   * Sort the Hero's Items into the lists each tab shows.
   * @param {object} context
   */
  async _prepareItems(context) {
    const actor = this.actor;
    const cfg = CONFIG.VAGABOND;
    const sorted = actor.items.contents.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const weapons = [];
    const armor = [];
    const gear = Object.fromEntries(Object.keys(cfg.gearCategories).map(k => [k, []]));
    const spells = [];
    const perks = [];
    const features = [];

    for ( const item of sorted ) {
      const row = await this._prepareItem(item);
      switch ( item.type ) {
        case "weapon": {
          const skill = item.system.bestSkill;
          const sk = actor.system.skills[skill];
          row.skill = skill;
          row.skillLabel = cfg.skills[skill]?.label;
          row.difficulty = sk ? sk.difficulty : null;
          row.formula = item.system.damageFormula({ skill });
          row.critOn = item.system.critOn;
          row.slotsTotal = rules.stackSlots(item.system.slots, item.system.quantity);
          weapons.push(row);
          break;
        }
        case "armor":
          row.slotsTotal = rules.stackSlots(item.system.slots, item.system.quantity);
          armor.push(row);
          break;
        case "gear":
          row.slotsTotal = rules.stackSlots(item.system.slots, item.system.quantity);
          (gear[item.system.category] ?? gear.other).push(row);
          break;
        case "spell": spells.push(row); break;
        case "perk": perks.push(row); break;
        case "feature": features.push(row); break;
      }
    }

    context.attacks = weapons.filter(w => w.system.equipped);
    context.readiedSpells = spells.filter(sp => sp.system.readied);
    context.inventory = [
      { label: "TYPES.Item.weapon", type: "weapon", items: weapons, columns: "weapon" },
      { label: "TYPES.Item.armor", type: "armor", items: armor, columns: "armor" },
      ...Object.entries(gear).filter(([k, items]) => items.length || (k === "adventuring")).map(([k, items]) => ({
        label: cfg.gearCategories[k], type: "gear", category: k, items, columns: "gear"
      }))
    ];
    context.spells = spells;
    context.perks = perks;
    context.extraFeatures = features;

    // Class Features and Ancestry Traits are stored on those Items.
    const level = actor.system.details.level;
    const cls = context.classItem;
    const notes = actor.system.featureMods?.notes ?? {};
    const noteText = n => (n ? game.i18n.format(`VAGABOND.FeatureNote.${n.key}`, n.data) : "");
    context.classFeatures = cls ? await Promise.all(cls.system.features.map(async (f, i) => ({
      ...f, index: i, unlocked: f.level <= level,
      now: (f.level <= level) ? noteText(notes[f.name]) : "",
      html: await this._enrich(f.description)
    }))) : [];
    const anc = context.ancestryItem;
    context.ancestryTraits = anc ? await Promise.all(anc.system.traits.map(async (t, i) => {
      const rule = cfg.traitChoices[t.name.toLowerCase()];
      const choice = rule ? {
        name: `flags.vagabond-rpg.${rule.flag}`, value: actor.getFlag("vagabond-rpg", rule.flag) ?? "",
        options: Object.fromEntries(rule.options.map(k => [k, cfg.damageTypes[k] ?? k]))
      } : null;
      return { ...t, index: i, choice, html: await this._enrich(t.description) };
    })) : [];

    // Alchemy formulas (Alchemist): the Alchemical Items this Hero can Craft.
    const alchemy = cls?.system.features.some(f => (f.name.toLowerCase() === "alchemy") && (f.level <= level));
    const known = actor.getFlag("vagabond-rpg", "formulas") ?? [];
    context.formulas = (alchemy || known.length) ? {
      max: rules.formulasKnown(level), cap: rules.formatCoins(rules.formulaMaxValue(level)),
      items: known.map(uuid => {
        const entry = fromUuidSync(uuid, { strict: false });
        return { uuid, name: entry?.name ?? uuid, img: entry?.img ?? cfg.defaultIcons.gear };
      })
    } : null;

    context.currencyValue = rules.formatCoins(
      actor.system.currency.g * 100 + actor.system.currency.s + (actor.system.currency.c / 100)
    );
  }

  /* -------------------------------------------- */
  /*  Drops                                       */
  /* -------------------------------------------- */

  /** @override */
  async _onDropItemCreate(item) {
    if ( item.system.isKit ) {
      const created = await item.unpackKit(this.actor);
      ui.notifications.info(game.i18n.format("VAGABOND.Kit.Unpacked", { name: item.name, count: created.length }));
      return created;
    }
    if ( !["class", "ancestry"].includes(item.type) ) return super._onDropItemCreate(item);

    // A Hero has one Class and one Ancestry: replace the old one.
    const existing = this.actor.items.filter(i => i.type === item.type);
    const label = game.i18n.localize(CONFIG.Item.typeLabels[item.type]);
    if ( existing.length ) {
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.format("VAGABOND.Sheet.ReplaceTitle", { type: label }) },
        content: `<p>${game.i18n.format("VAGABOND.Sheet.ReplaceContent", { old: existing[0].name, new: item.name })}</p>`
      });
      if ( !ok ) return null;
      await this.actor.deleteEmbeddedDocuments("Item", existing.map(i => i.id));
    }
    const created = await super._onDropItemCreate(item);

    // Apply the Trainings, Size, and Being Type it grants.
    const updates = {};
    for ( const skill of item.system.trainings ?? [] ) {
      if ( skill in this.actor.system.skills ) updates[`system.skills.${skill}.trained`] = true;
    }
    if ( item.type === "ancestry" ) {
      updates["system.details.size"] = item.system.size;
      updates["system.details.beingType"] = item.system.beingType;
    }
    if ( (item.type === "class") && item.system.castingSkill ) {
      updates["system.attributes.castingSkill"] = item.system.castingSkill;
    }
    if ( !foundry.utils.isEmpty(updates) ) await this.actor.update(updates);
    const choices = item.system.trainingChoices;
    if ( choices?.count ) {
      const options = choices.options.length
        ? choices.options.map(k => game.i18n.localize(CONFIG.VAGABOND.skills[k]?.label ?? k)).join(", ")
        : game.i18n.localize("VAGABOND.Sheet.AnySkill");
      ui.notifications.info(game.i18n.format("VAGABOND.Sheet.ChooseTrainings", { count: choices.count, options }));
    }
    return created;
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static async #onRollSkill(event, target) {
    return this.actor.rollSkill(target.closest("[data-skill]").dataset.skill, { event });
  }

  static async #onRollStat(event, target) {
    return this.actor.rollStat(target.closest("[data-stat]").dataset.stat, { event });
  }

  static async #onRollAttack(event, target) {
    const item = this._getItem(target);
    return item?.rollAttack({ event, skill: target.dataset.skill });
  }

  static async #onToggleTrained(event, target) {
    if ( !this.isEditable ) return;
    const skill = target.closest("[data-skill]").dataset.skill;
    return this.actor.update({ [`system.skills.${skill}.trained`]: !this.actor.system.skills[skill].trained });
  }

  static async #onSetFatigue(event, target) {
    if ( !this.isEditable ) return;
    const n = Number(target.dataset.n);
    const current = this.actor.system.attributes.fatigue;
    return this.actor.update({ "system.attributes.fatigue": current === n ? n - 1 : n });
  }

  static async #onRest() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("VAGABOND.Rest.Title") },
      content: `<p>${game.i18n.localize("VAGABOND.Rest.Confirm")}</p>`
    });
    if ( ok ) return this.actor.rest();
  }

  static async #onBreather() {
    return this.actor.breather();
  }

  static async #onPostFeature(event, target) {
    const { source, index } = target.dataset;
    const item = source === "class" ? this.actor.system.classItem : this.actor.system.ancestryItem;
    const row = item?.system[source === "class" ? "features" : "traits"]?.[Number(index)];
    if ( !row ) return;
    const html = await this._enrich(row.description);
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="vagabond chat-card item-card"><header class="card-header"><img src="${item.img}" width="36" height="36" alt="">
        <div class="card-titles"><h3>${row.name}</h3><span class="card-subtitle">${item.name}</span></div></header>
        <div class="card-body">${html}</div></div>`
    });
  }

  /* -------------------------------------------- */

  /** Craft one of a known Alchemical Item: add it to the inventory, or one more to a stack already there. */
  static async #onCraftFormula(event, target) {
    const uuid = target.closest("[data-uuid]")?.dataset.uuid;
    const source = uuid ? await fromUuid(uuid) : null;
    if ( !source ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Formulas.Missing"));
    const stack = this.actor.items.find(i => (i.type === source.type) && ((i._stats?.compendiumSource === uuid) || (i.name === source.name)));
    if ( stack ) return stack.update({ "system.quantity": (stack.system.quantity ?? 0) + 1 });
    const data = source.toObject();
    delete data._id;
    foundry.utils.setProperty(data, "_stats.compendiumSource", uuid);
    data.system.quantity = 1;
    return this.actor.createEmbeddedDocuments("Item", [data]);
  }

  /** Learn an Alchemy formula: pick an Alchemical Item worth no more than Level × 50s. */
  static async #onLearnFormula() {
    const actor = this.actor;
    const known = new Set(actor.getFlag("vagabond-rpg", "formulas") ?? []);
    const cap = rules.formulaMaxValue(actor.system.details.level);
    const options = [];
    const pack = game.packs.get(CONFIG.VAGABOND.builderPacks.alchemical);
    const index = pack ? await pack.getIndex({ fields: ["system.value"] }) : [];
    for ( const e of index ) options.push({ uuid: e.uuid, name: e.name, value: e.system?.value ?? 0 });
    for ( const i of game.items ) {
      if ( (i.type === "gear") && (i.system.category === "alchemical") ) options.push({ uuid: i.uuid, name: i.name, value: i.system.value ?? 0 });
    }
    const allowed = options.filter(o => !known.has(o.uuid) && (o.value <= cap)).sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    if ( !allowed.length ) return ui.notifications.info(game.i18n.localize("VAGABOND.Formulas.NoneLeft"));
    const esc = foundry.utils.escapeHTML;
    const uuid = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("VAGABOND.Formulas.Learn") },
      content: `<div class="form-group"><label>${game.i18n.format("VAGABOND.Formulas.UpTo", { max: rules.formatCoins(cap) })}</label>
        <select name="formula">${allowed.map(o => `<option value="${esc(o.uuid)}">${esc(o.name)} (${rules.formatCoins(o.value)})</option>`).join("")}</select></div>`,
      ok: { label: "VAGABOND.Formulas.Learn", callback: (event, button) => button.form.elements.formula.value },
      rejectClose: false
    });
    if ( !uuid ) return;
    return actor.setFlag("vagabond-rpg", "formulas", [...known, uuid]);
  }

  /** Forget an Alchemy formula. */
  static async #onForgetFormula(event, target) {
    const uuid = target.closest("[data-uuid]")?.dataset.uuid;
    const known = this.actor.getFlag("vagabond-rpg", "formulas") ?? [];
    return this.actor.setFlag("vagabond-rpg", "formulas", known.filter(u => u !== uuid));
  }

  /** Set the Hero's standing Favor / Normal / Hinder roll setting. */
  static async #onSetRollMode(event, target) {
    return this.actor.update({ "system.attributes.favor": Number(target.dataset.favor) || 0 });
  }

  /** Post a Spell to chat without a Cast Check (willing Targets, or the effect only). */
  static async #onPostSpell(event, target) {
    return this._getItem(target)?.cast({ check: false });
  }

  /** Ready a Spell (shown under Attacks) or unready it. */
  static async #onToggleReady(event, target) {
    const item = this._getItem(target);
    return item?.update({ "system.readied": !item.system.readied });
  }

  /** Arm or disarm spending a Studied die for Favor on the next Check. */
  static async #onToggleStudied() {
    return this.actor.update({ "system.attributes.studiedArmed": !this.actor.system.attributes.studiedArmed });
  }

  /** Study: gain a Studied die (p. 19). */
  static async #onStudy() {
    if ( this.isEditable ) return this.actor.study();
  }

  /** Give one Studied die to another Hero. */
  static async #onGiveStudied() {
    if ( !this.isEditable || ((this.actor.system.attributes.studied ?? 0) < 1) ) return;
    const allies = game.actors.filter(a => (a.type === "character") && (a !== this.actor) && (a.hasPlayerOwner || game.user.isGM));
    if ( !allies.length ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Studied.NoAllies"));
    const options = allies.map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");
    const id = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("VAGABOND.Studied.Give") },
      content: `<p>${game.i18n.localize("VAGABOND.Studied.GiveHint")}</p><div class="form-group"><select name="ally">${options}</select></div>`,
      ok: { label: "VAGABOND.Studied.Give", callback: (event, button) => button.form.elements.ally.value },
      rejectClose: false
    });
    const ally = game.actors.get(id);
    if ( ally ) return giveStudied(this.actor, ally);
  }

  /** Open the Hero builder. */
  static #onOpenBuilder() {
    return new HeroBuilder({ actor: this.actor, mode: "create" }).render({ force: true });
  }

  /** Open the level-up wizard. */
  static #onLevelUp() {
    return new HeroBuilder({ actor: this.actor, mode: "levelup" }).render({ force: true });
  }
}
