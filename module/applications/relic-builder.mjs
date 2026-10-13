import { RELIC_POWER_GROUPS, resolveRelicPowers } from "../relic-powers.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Build a Relic (p. 99-102): start from a Weapon, Armor, or Gear Item (or nothing), set its Lore, and pick Powers from
 * the Relic Powers table. The Value adds up from the Powers, Weapon and Armor bonuses are applied to the Item, Holding
 * adds Item Slots, and Swiftness adds Speed while equipped. Everything else is written into the description.
 */
export default class RelicBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.build = {
      base: "",
      name: "",
      loreItem: "",
      flavour: "",
      fabled: false,
      bound: false,
      cursed: false,
      consumable: false,
      picks: {},
      custom: [],
      value: null,
      open: "bonus"
    };
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["vagabond", "hero-builder", "relic-builder", "themed", "theme-light"],
    window: { icon: "fa-solid fa-gem", resizable: true },
    position: { width: 880, height: 760 },
    actions: {
      openGroup: RelicBuilder.#onOpenGroup,
      addCustom: RelicBuilder.#onAddCustom,
      removeCustom: RelicBuilder.#onRemoveCustom,
      clearPower: RelicBuilder.#onClearPower,
      create: RelicBuilder.#onCreate
    }
  };

  /** @override */
  static PARTS = {
    main: { template: "systems/vagabond-rpg/templates/apps/relic-builder.hbs", scrollable: [".relic-powers", ".relic-summary"] }
  };

  /** @override */
  get title() {
    return game.i18n.localize("VAGABOND.RelicBuilder.Title");
  }

  /** Base Items offered, loaded once. */
  #bases = null;

  async #loadBases() {
    if ( this.#bases ) return this.#bases;
    const out = { weapon: [], armor: [], gear: [] };
    for ( const id of ["vagabond-rpg.weapons-armor", "vagabond-rpg.gear"] ) {
      const pack = game.packs.get(id);
      for ( const doc of (pack ? await pack.getDocuments() : []) ) {
        if ( (doc.type === "gear") && doc.system.isKit ) continue;
        out[doc.type]?.push(doc);
      }
    }
    for ( const doc of game.items.filter(i => ["weapon", "armor", "gear"].includes(i.type)) ) out[doc.type].push(doc);
    for ( const list of Object.values(out) ) list.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    return this.#bases = out;
  }

  #baseDoc() {
    if ( !this.build.base ) return null;
    return Object.values(this.#bases ?? {}).flat().find(d => d.uuid === this.build.base) ?? null;
  }

  /**
   * Everything the current choices add up to.
   */
  get plan() {
    const b = this.build;
    const base = this.#baseDoc();
    const powers = resolveRelicPowers(b.picks, b.custom);
    const type = base?.type ?? "gear";
    const fabled = b.fabled || powers.fabled;
    const cursed = b.cursed || powers.cursed;
    const quals = [b.consumable ? game.i18n.localize("VAGABOND.RelicBuilder.Consumable") : "",
      b.bound ? game.i18n.localize("VAGABOND.RelicBuilder.Bound") : ""].filter(Boolean);
    const loreItem = (b.loreItem || base?.name || game.i18n.localize("VAGABOND.RelicBuilder.Item")).trim();
    const lore = [fabled ? game.i18n.localize("VAGABOND.RelicBuilder.Fabled") : "", cursed ? game.i18n.localize("VAGABOND.RelicBuilder.Cursed") : "",
      game.i18n.localize("VAGABOND.RelicBuilder.Relic"), loreItem].filter(Boolean).join(" ") + (quals.length ? ` (${quals.join(", ")})` : "");
    let suggested = powers.value;
    if ( b.consumable ) suggested = Math.round(suggested * 0.1 * 100) / 100;
    const value = Number.isFinite(b.value) && (b.value !== null) ? b.value : suggested;
    const effects = [];
    if ( (type === "weapon") && powers.weaponBonus ) effects.push(game.i18n.format("VAGABOND.RelicBuilder.Applies.weapon", { n: signed(powers.weaponBonus) }));
    if ( (type === "armor") && powers.armorBonus ) effects.push(game.i18n.format("VAGABOND.RelicBuilder.Applies.armor", { n: signed(powers.armorBonus) }));
    if ( (type === "gear") && powers.slotsBonus ) effects.push(game.i18n.format("VAGABOND.RelicBuilder.Applies.slots", { n: powers.slotsBonus }));
    if ( powers.speed ) effects.push(game.i18n.format("VAGABOND.RelicBuilder.Applies.speed", { n: powers.speed }));
    const warnings = [];
    if ( powers.weaponBonus && (type !== "weapon") ) warnings.push(game.i18n.localize("VAGABOND.RelicBuilder.Warn.weapon"));
    if ( powers.armorBonus && (type !== "armor") ) warnings.push(game.i18n.localize("VAGABOND.RelicBuilder.Warn.armor"));
    if ( powers.slotsBonus && (type !== "gear") ) warnings.push(game.i18n.localize("VAGABOND.RelicBuilder.Warn.slots"));
    const name = b.name.trim() || (base ? game.i18n.format("VAGABOND.RelicBuilder.DefaultName", { item: base.name }) : "");
    return { base, type, powers, fabled, cursed, lore, suggested, value, effects, warnings, name, special: powers.special };
  }

  /** @override */
  async _prepareContext(options) {
    const bases = await this.#loadBases();
    const b = this.build;
    const plan = this.plan;
    const gold = v => `${Number(v).toLocaleString(game.i18n.lang)}g`;
    const groups = RELIC_POWER_GROUPS.map(g => {
      const powers = g.powers.map(p => {
        const pick = b.picks[p.id];
        return {
          id: p.id, name: p.name, text: p.text && !p.tiers ? p.text.replace("{target}", "…").replace("{rank}", "N") : "",
          value: p.value !== undefined ? gold(p.value) : "",
          special: p.input === "value",
          tiered: !!p.tiers,
          tiers: (p.tiers ?? []).map(t => ({ id: t.id, label: `${t.name} (${gold(t.value)})`, text: t.text, selected: pick?.tier === t.id })),
          tierText: p.tiers?.find(t => t.id === pick?.tier)?.text ?? "",
          target: p.input === "target", targetLabel: p.targetLabel ?? "VAGABOND.RelicBuilder.Target",
          rank: p.input === "rank", rankLabel: p.rankLabel ?? "VAGABOND.RelicBuilder.Rank",
          picked: !!pick && (!p.tiers || !!pick.tier),
          pick: pick ?? {}
        };
      });
      return { id: g.id, label: g.label, hint: g.hint, open: b.open === g.id, powers, count: powers.filter(p => p.picked).length };
    });
    const opt = d => ({ uuid: d.uuid, name: d.name, selected: d.uuid === b.base });
    return {
      build: b,
      bases: { weapon: bases.weapon.map(opt), armor: bases.armor.map(opt), gear: bases.gear.map(opt) },
      groups,
      plan,
      valueText: plan.special && !plan.powers.value ? game.i18n.localize("VAGABOND.RelicBuilder.Special") : gold(plan.value),
      suggestedText: gold(plan.suggested),
      valueOverridden: Number.isFinite(b.value) && (b.value !== null),
      canCreate: !!plan.name && (plan.powers.lines.length > 0)
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    for ( const el of this.element.querySelectorAll("[data-field]") ) el.addEventListener("change", this.#onChange.bind(this));
  }

  #onChange(event) {
    const el = event.currentTarget;
    const b = this.build;
    const field = el.dataset.field;
    const val = el.type === "checkbox" ? el.checked : el.value;
    if ( field.startsWith("pick.") ) {
      const [, id, key] = field.split(".");
      const pick = b.picks[id] ?? {};
      if ( key === "on" ) {
        if ( val ) b.picks[id] = pick;
        else delete b.picks[id];
      } else if ( key === "tier" ) {
        if ( val ) b.picks[id] = { ...pick, tier: val };
        else delete b.picks[id];
      } else {
        b.picks[id] = { ...pick, [key]: (key === "target") ? val : Math.max(0, Number(val) || 0) };
      }
    } else if ( field.startsWith("custom.") ) {
      const [, i, key] = field.split(".");
      const row = b.custom[Number(i)];
      if ( row ) row[key] = key === "value" ? Math.max(0, Number(val) || 0) : val;
    } else if ( field === "value" ) {
      b.value = (val === "") ? null : Math.max(0, Number(val) || 0);
    } else b[field] = val;
    this.render();
  }

  static #onOpenGroup(event, target) {
    this.build.open = (this.build.open === target.dataset.group) ? "" : target.dataset.group;
    this.render();
  }

  static #onAddCustom() {
    this.build.custom.push({ name: "", text: "", value: 0 });
    this.render();
  }

  static #onRemoveCustom(event, target) {
    this.build.custom.splice(Number(target.dataset.index), 1);
    this.render();
  }

  static #onClearPower(event, target) {
    delete this.build.picks[target.dataset.power];
    this.render();
  }

  /**
   * The Item data for the Relic.
   * @returns {object}
   */
  itemData() {
    const b = this.build;
    const plan = this.plan;
    const base = plan.base;
    const data = base ? base.toObject() : { type: "gear", img: CONFIG.VAGABOND.defaultIcons.relic, system: {} };
    delete data._id;
    delete data.folder;
    delete data.sort;
    delete data.ownership;
    data.name = plan.name;
    data.effects = (data.effects ?? []).filter(Boolean);
    const sys = data.system;
    const esc = s => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(s) : String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);
    const html = [`<p><em>${esc(game.i18n.localize("VAGABOND.RelicBuilder.Lore"))}: ${esc(plan.lore)}</em></p>`];
    if ( b.flavour.trim() ) html.push(...b.flavour.trim().split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`));
    if ( base && sys.description ) html.push(sys.description);
    html.push(`<ul>${plan.powers.lines.map(l => `<li><strong>${esc(l.name)}:</strong> ${esc(l.text)}</li>`).join("")}</ul>`);
    html.push(`<p>${esc(game.i18n.localize("VAGABOND.RelicBuilder.ValueLabel"))}: ${plan.special && !plan.value
      ? esc(game.i18n.localize("VAGABOND.RelicBuilder.Special")) : `${plan.value}g`}</p>`);
    sys.description = html.join("");
    sys.value = Math.round(plan.value * 100);
    if ( (plan.type === "weapon") || (plan.type === "armor") ) {
      const add = plan.type === "weapon" ? plan.powers.weaponBonus : plan.powers.armorBonus;
      sys.bonus = (sys.bonus ?? 0) + add;
      if ( plan.type === "weapon" ) sys.relic = true;
      // Vulnerability: the Armor grants none of its own and adds to Attack damage taken (p. 102).
      if ( (plan.type === "armor") && (add < 0) ) { sys.rating = 0; sys.bonus = add; }
    }
    if ( plan.type === "gear" ) {
      sys.category = "relic";
      sys.slotsBonus = (sys.slotsBonus ?? 0) + plan.powers.slotsBonus;
      sys.consumable = !!b.consumable;
    }
    if ( plan.powers.speed ) data.effects.push({
      name: `${plan.name}: ${game.i18n.localize("VAGABOND.Speed.Label")} +${plan.powers.speed}'`,
      img: data.img, transfer: true, disabled: false,
      changes: [{ key: "system.bonuses.speed", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: String(plan.powers.speed) }]
    });
    foundry.utils.setProperty(data, "flags.vagabond-rpg.relic", {
      picks: foundry.utils.deepClone(b.picks), custom: foundry.utils.deepClone(b.custom), lore: plan.lore, base: b.base
    });
    return data;
  }

  static async #onCreate() {
    const plan = this.plan;
    if ( !plan.name || !plan.powers.lines.length ) return;
    const item = await Item.implementation.create(this.itemData());
    if ( !item ) return;
    ui.notifications.info(game.i18n.format("VAGABOND.RelicBuilder.Created", { name: item.name }));
    item.sheet.render({ force: true });
    return this.close();
  }
}

function signed(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}
