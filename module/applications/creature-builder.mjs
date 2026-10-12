import * as rules from "../rules.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Build or edit a creature's statblock (p. 109-111). Start from scratch or from any Bestiary or Humanlike statblock,
 * set its defenses and Actions, and see its Threat Level worked out with the book's formula as you go:
 * TL = (2×Armor + HP/10) / 4 + DPR/6. Damage per Round is suggested from the Actions (including Combos) and can be
 * overridden.
 */
export default class CreatureBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} [options]
   * @param {Actor} [options.actor]  An NPC to edit. Without one, the builder creates a new NPC.
   */
  constructor({ actor = null, ...options } = {}) {
    super(options);
    this.actor = actor;
    this.build = actor ? CreatureBuilder.fromActor(actor) : CreatureBuilder.blank();
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["vagabond", "hero-builder", "creature-builder", "themed", "theme-light"],
    window: { icon: "fa-solid fa-dragon", resizable: true },
    position: { width: 940, height: 800 },
    actions: {
      addAction: CreatureBuilder.#onAddAction,
      removeAction: CreatureBuilder.#onRemoveAction,
      moveAction: CreatureBuilder.#onMoveAction,
      resetDpr: CreatureBuilder.#onResetDpr,
      save: CreatureBuilder.#onSave
    }
  };

  /** @override */
  static PARTS = {
    main: { template: "systems/vagabond-rpg/templates/apps/creature-builder.hbs", scrollable: [".creature-main", ".creature-summary"] }
  };

  /** Statblock packs offered as starting points. */
  static SOURCE_PACKS = ["vagabond-rpg.bestiary", "vagabond-rpg.humanlike"];

  /** @override */
  get title() {
    return this.actor ? game.i18n.format("VAGABOND.CreatureBuilder.EditTitle", { name: this.actor.name })
      : game.i18n.localize("VAGABOND.CreatureBuilder.Title");
  }

  /* -------------------------------------------- */
  /*  State                                       */
  /* -------------------------------------------- */

  static blank() {
    return {
      source: "", name: "", img: "icons/svg/mystery-man.svg", size: "medium", beingType: "beast", subtype: "",
      hd: 1, hpCustom: null, tougher: false, speed: 30, speedTypes: "", zone: "frontline", morale: 7, appearing: "",
      senses: "", armorTag: "as Unarmored", armor: 0, immune: "", weak: "", statusImmunities: "", description: "",
      actions: [], dpr: null, targetTL: null, bookTL: null
    };
  }

  /** Strip a description's HTML for editing as plain text. */
  static #plain(html) {
    return String(html ?? "").replace(/<\/p>\s*<p>/g, "\n\n").replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").trim();
  }

  /**
   * Builder state from an NPC (or NPC data).
   * @param {Actor|object} actor
   */
  static fromActor(actor) {
    const s = actor.system;
    const a = s.attributes;
    const d = s.details;
    const avg = rules.hpFromHD(s.hd, d.size);
    const items = (actor.items?.contents ?? actor.items ?? []).filter(i => i.type === "action")
      .sort((x, y) => (x.system.sort ?? 0) - (y.system.sort ?? 0));
    return {
      ...CreatureBuilder.blank(),
      name: actor.name, img: actor.img, size: d.size, beingType: d.beingType, subtype: d.subtype,
      hd: s.hd, hpCustom: [avg, avg * 2].includes(a.hp.max) ? null : a.hp.max, tougher: (a.hp.max === avg * 2) && (avg > 0),
      speed: a.speed.value, speedTypes: a.speed.types, zone: d.zone, morale: a.morale ?? null, appearing: d.appearing,
      senses: d.senses, armorTag: a.armorTag ? (a.armorTag.startsWith("as ") || (a.armorTag === "None") ? a.armorTag : `as ${a.armorTag}`) : "",
      armor: a.armor, immune: d.immune, weak: d.weak, statusImmunities: d.statusImmunities,
      description: CreatureBuilder.#plain(d.description), bookTL: s.tl ?? null,
      actions: items.map(i => ({
        name: i.name, actionType: i.system.actionType, tags: i.system.tags, damage: i.system.damage, save: i.system.save,
        recharge: i.system.recharge, text: CreatureBuilder.#plain(i.system.description), img: i.img,
        effectSaves: foundry.utils.deepClone(i.system.effectSaves), healing: i.system.healing,
        damageType: i.system.damageType, relic: i.system.relic
      }))
    };
  }

  /** Starting points, loaded once. */
  #sources = null;

  async #loadSources() {
    if ( this.#sources ) return this.#sources;
    const out = [];
    for ( const id of CreatureBuilder.SOURCE_PACKS ) {
      const pack = game.packs.get(id);
      if ( !pack ) continue;
      const index = await pack.getIndex();
      out.push({ label: pack.metadata.label, entries: [...index].map(e => ({ uuid: e.uuid ?? `Compendium.${id}.Actor.${e._id}`, name: e.name }))
        .sort((x, y) => x.name.localeCompare(y.name, game.i18n.lang)) });
    }
    const world = game.actors.filter(a => a.type === "npc").map(a => ({ uuid: a.uuid, name: a.name }));
    if ( world.length ) out.push({ label: game.i18n.localize("VAGABOND.CreatureBuilder.WorldNPCs"), entries: world });
    return this.#sources = out;
  }

  /* -------------------------------------------- */
  /*  Derived plan                                */
  /* -------------------------------------------- */

  /**
   * Average damage of an Action row, or null.
   * @param {object} row
   */
  static rowAverage(row) {
    return rules.averageDamage(row.damage);
  }

  /**
   * Suggested damage per Round: the best single damaging Action, or a Combo of the Actions it names
   * ("2×Talons and 1×Beak").
   * @param {object[]} actions
   * @returns {{dpr: number, from: string}}
   */
  static suggestDPR(actions) {
    let best = { dpr: 0, from: "" };
    const damaging = actions.filter(r => (r.actionType !== "ability") && (r.actionType !== "combo") && r.name?.trim());
    for ( const r of damaging ) {
      const avg = CreatureBuilder.rowAverage(r) ?? 0;
      if ( avg > best.dpr ) best = { dpr: avg, from: r.name };
    }
    for ( const combo of actions.filter(r => r.actionType === "combo") ) {
      const text = `${combo.text ?? ""}`.toLowerCase();
      let sum = 0;
      const parts = [];
      for ( const r of damaging ) {
        const name = r.name.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const m = text.match(new RegExp(`(?:(\\d+)\\s*[×x]\\s*)?\\b${name}(?:e?s)?\\b`));
        if ( !m ) continue;
        const n = Number(m[1] || 1);
        const avg = CreatureBuilder.rowAverage(r) ?? 0;
        sum += n * avg;
        parts.push(n > 1 ? `${n}×${r.name}` : r.name);
      }
      if ( sum > best.dpr ) best = { dpr: sum, from: `${combo.name || game.i18n.localize("VAGABOND.ActionType.combo")} (${parts.join(", ")})` };
    }
    return best;
  }

  get plan() {
    const b = this.build;
    const avgHP = rules.hpFromHD(b.hd, b.size);
    const baseHP = Number.isFinite(b.hpCustom) && (b.hpCustom !== null) ? b.hpCustom : avgHP;
    const hp = b.tougher ? baseHP * 2 : baseHP;
    const suggestion = CreatureBuilder.suggestDPR(b.actions);
    const dpr = Number.isFinite(b.dpr) && (b.dpr !== null) ? b.dpr : suggestion.dpr;
    const tl = rules.threatLevel({ armor: b.armor, hp, dpr });
    const parts = {
      a: 2 * (Number(b.armor) || 0),
      b: Math.round((hp / 10) * 100) / 100,
      c: Math.round((dpr / 6) * 100) / 100
    };
    const table = CONFIG.VAGABOND.threatTable;
    const targetTL = Number.isFinite(b.targetTL) && (b.targetTL !== null) ? b.targetTL : Math.clamp(Math.round(tl), 0, 20);
    const row = table.find(r => r.tl === targetTL) ?? table[0];
    const range = text => text.split("-").map(Number);
    const cmp = (v, text) => { const [lo, hi] = range(String(text)); return v < lo ? "low" : (v > (hi ?? lo) ? "high" : "ok"); };
    return {
      avgHP, hp, suggestion, dpr, tl, parts, targetTL, row,
      checks: {
        hd: cmp(b.hd, row.hd), hp: cmp(hp, row.hp), armor: cmp(b.armor, String(row.armor)), dpr: cmp(dpr, row.dpr)
      },
      valid: !!b.name.trim()
    };
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const cfg = CONFIG.VAGABOND;
    const b = this.build;
    const plan = this.plan;
    const sources = await this.#loadSources();
    const loc = obj => Object.entries(obj).map(([k, v]) => ({ key: k, label: game.i18n.localize(v) }));
    const icon = { ok: "fa-circle-check", low: "fa-arrow-down", high: "fa-arrow-up" };
    return {
      build: b, plan, editing: !!this.actor,
      sources: sources.map(g => ({ label: g.label, entries: g.entries.map(e => ({ ...e, selected: e.uuid === b.source })) })),
      sizes: loc(cfg.sizes), beingTypes: loc(cfg.beingTypes), zones: loc(cfg.zones),
      armorTags: cfg.armorTags.map(t => ({ ...t, selected: t.tag === b.armorTag })),
      customTag: !!b.armorTag && !cfg.armorTags.some(t => t.tag === b.armorTag),
      actionTypes: loc(cfg.npcActionTypes), saves: loc(cfg.saveOptions),
      actions: b.actions.map((r, i) => ({
        ...r, index: i, first: i === 0, last: i === b.actions.length - 1,
        average: CreatureBuilder.rowAverage(r), hasDamage: r.actionType !== "combo"
      })),
      tlTable: cfg.threatTable.map(r => ({ ...r, selected: r.tl === plan.targetTL })),
      checkIcons: Object.fromEntries(Object.entries(plan.checks).map(([k, v]) => [k, { cls: v, icon: icon[v] }])),
      dprOverridden: Number.isFinite(b.dpr) && (b.dpr !== null),
      hpOverridden: Number.isFinite(b.hpCustom) && (b.hpCustom !== null),
      traits: CreatureBuilder.TRAIT_FIELDS.map(field => {
        const { keys, other } = rules.splitTraits(field, b[field]);
        return {
          field, other, label: game.i18n.localize(`VAGABOND.CreatureBuilder.${field[0].toUpperCase()}${field.slice(1)}`),
          options: rules.TRAIT_OPTIONS[field].map(([key]) => ({ key, label: CreatureBuilder.#traitLabel(field, key), checked: keys.includes(key) }))
        };
      })
    };
  }

  /** Immune, Weak, and Status Immunities: picked from options, with a free entry for anything else. */
  static TRAIT_FIELDS = ["immune", "weak", "statusImmunities"];

  /** The label for a picked Immune, Weak, or Status Immunity option. */
  static #traitLabel(field, key) {
    const own = `VAGABOND.Trait.${key}`;
    if ( game.i18n.has(own) ) return game.i18n.localize(own);
    return game.i18n.localize(field === "statusImmunities" ? `VAGABOND.Status.${key}` : `VAGABOND.DamageType.${key}`);
  }

  /** Rewrite an Immune, Weak, or Status Immunities line after an option or its Other entry changes. */
  #onTraitChange(event) {
    const field = event.currentTarget.dataset.trait;
    const box = this.element.querySelector(`.trait-picker[data-trait-field="${field}"]`);
    const keys = [...box.querySelectorAll("input[type=checkbox]:checked")].map(el => el.value);
    const other = box.querySelector("input[data-trait-other]")?.value ?? "";
    this.build[field] = rules.joinTraits(field, keys, other);
    this.render();
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    for ( const el of this.element.querySelectorAll("[data-field]") ) el.addEventListener("change", this.#onChange.bind(this));
    for ( const el of this.element.querySelectorAll("[data-trait]") ) el.addEventListener("change", this.#onTraitChange.bind(this));
  }

  static NUMBER_FIELDS = new Set(["hd", "speed", "armor", "morale"]);

  static NULLABLE_FIELDS = new Set(["hpCustom", "dpr", "targetTL"]);

  async #onChange(event) {
    const el = event.currentTarget;
    const b = this.build;
    const field = el.dataset.field;
    const val = el.type === "checkbox" ? el.checked : el.value;
    if ( field.startsWith("action.") ) {
      const [, i, key] = field.split(".");
      const row = b.actions[Number(i)];
      if ( row ) {
        row[key] = val;
        if ( key === "actionType" ) row.tags = CreatureBuilder.defaultTags(val, row.tags);
      }
    }
    else if ( field === "source" ) return this.#loadSource(val);
    else if ( field === "armorTag" ) {
      b.armorTag = val;
      const t = CONFIG.VAGABOND.armorTags.find(x => x.tag === val);
      if ( t ) b.armor = t.armor;
    }
    else if ( CreatureBuilder.NUMBER_FIELDS.has(field) ) b[field] = (field === "morale" && val === "") ? null : Math.max(0, Math.floor(Number(val) || 0));
    else if ( CreatureBuilder.NULLABLE_FIELDS.has(field) ) b[field] = (val === "") ? null : Math.max(0, Number(val) || 0);
    else b[field] = val;
    this.render();
  }

  /**
   * Default tags for a new Action type, unless the tags were already customised.
   */
  static defaultTags(type, current = "") {
    const defaults = { melee: "Melee Attack", ranged: "Ranged Attack", attack: "Attack", cast: "Cast", action: "Action", ability: "Ability", combo: "" };
    if ( current && !Object.values(defaults).includes(current) ) return current;
    return defaults[type] ?? "";
  }

  async #loadSource(uuid) {
    const doc = uuid ? await fromUuid(uuid) : null;
    if ( doc ) this.build = { ...CreatureBuilder.fromActor(doc), source: uuid, name: this.build.name || doc.name };
    else this.build = { ...CreatureBuilder.blank(), source: "" };
    this.render();
  }

  static #onAddAction(event, target) {
    const type = target.dataset.type ?? "melee";
    this.build.actions.push({ name: "", actionType: type, tags: CreatureBuilder.defaultTags(type), damage: "", save: type === "ability" ? "" : "reflex", recharge: "", text: "" });
    this.render();
  }

  static #onRemoveAction(event, target) {
    this.build.actions.splice(Number(target.dataset.index), 1);
    this.render();
  }

  static #onMoveAction(event, target) {
    const i = Number(target.dataset.index);
    const j = i + Number(target.dataset.delta);
    const list = this.build.actions;
    if ( (j < 0) || (j >= list.length) ) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.render();
  }

  static #onResetDpr() {
    this.build.dpr = null;
    this.render();
  }

  /* -------------------------------------------- */
  /*  Output                                      */
  /* -------------------------------------------- */

  /**
   * Description HTML for an Action: "5 (d10)" first when it deals damage, then its text.
   */
  static actionHTML(row) {
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);
    const avg = CreatureBuilder.rowAverage(row);
    let text = (row.text ?? "").trim();
    if ( row.damage && (row.actionType !== "combo") && !text.includes(`(${row.damage})`) ) {
      text = `${avg ?? ""} (${row.damage})${text ? ` ${text}` : ""}`.trim();
    }
    return text.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  }

  /**
   * Actor data for the statblock.
   * @returns {object}
   */
  actorData() {
    const b = this.build;
    const plan = this.plan;
    const icons = { melee: "icons/skills/melee/strike-slashes-red.webp", ranged: "icons/skills/ranged/arrow-flying-white.webp",
      attack: "icons/skills/melee/strike-slashes-red.webp", cast: "icons/magic/symbols/runes-star-pentagon-orange.webp",
      combo: "icons/skills/melee/maneuver-sword-katana-yellow.webp", ability: "icons/svg/aura.svg", action: "icons/svg/aura.svg" };
    let abilityN = 100;
    let actionN = 0;
    const items = b.actions.filter(r => r.name?.trim()).map(r => {
      const sort = r.actionType === "ability" ? abilityN++ : actionN++;
      // Saves made after a hit, read from the text ("and pass [Endure] or be Sickened").
      // Rows loaded from a statblock keep its own choices.
      const covered = rules.saveKeys(r.save ?? "");
      const effect = (r.effectSaves ? Object.keys(r.effectSaves).filter(k => r.effectSaves[k])
        : rules.actionSaves({ actionType: r.actionType, tags: r.tags, text: r.text ?? "" }).effect)
        .filter(s => !covered.includes(s));
      return {
        name: r.name.trim(), type: "action", img: r.img || icons[r.actionType] || "icons/svg/aura.svg",
        system: {
          description: CreatureBuilder.actionHTML(r), actionType: r.actionType, tags: r.tags ?? "",
          damage: r.actionType === "combo" ? "" : (r.damage ?? ""),
          average: r.actionType === "combo" ? null : CreatureBuilder.rowAverage(r),
          save: r.actionType === "combo" ? "" : (r.save ?? ""),
          effectSaves: { endure: effect.includes("endure"), reflex: effect.includes("reflex"), will: effect.includes("will") },
          healing: !!r.healing, damageType: r.damageType ?? "", relic: r.relic ?? 0,
          recharge: r.recharge ?? "", sort
        },
        sort: sort * 100
      };
    });
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);
    return {
      name: b.name.trim(), type: "npc", img: b.img || "icons/svg/mystery-man.svg",
      system: {
        hd: b.hd, tl: plan.tl,
        attributes: {
          hp: { value: plan.hp, max: plan.hp }, armor: b.armor, armorTag: b.armorTag, morale: b.morale,
          speed: { value: b.speed, types: b.speedTypes }
        },
        details: {
          size: b.size, beingType: b.beingType, subtype: b.subtype, zone: b.zone, appearing: b.appearing, senses: b.senses,
          immune: b.immune, weak: b.weak, statusImmunities: b.statusImmunities,
          description: b.description.trim() ? b.description.trim().split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join("") : ""
        }
      },
      items
    };
  }

  static async #onSave() {
    if ( !this.plan.valid ) return;
    const data = this.actorData();
    let actor = this.actor;
    if ( actor ) {
      const { items, type, ...update } = data;
      await actor.update(update);
      const old = actor.items.filter(i => i.type === "action").map(i => i.id);
      if ( old.length ) await actor.deleteEmbeddedDocuments("Item", old);
      if ( items.length ) await actor.createEmbeddedDocuments("Item", items);
      ui.notifications.info(game.i18n.format("VAGABOND.CreatureBuilder.Saved", { name: actor.name }));
    } else {
      foundry.utils.setProperty(data, "prototypeToken.name", data.name);
      foundry.utils.setProperty(data, "prototypeToken.disposition", CONST.TOKEN_DISPOSITIONS.HOSTILE);
      actor = await Actor.implementation.create(data);
      if ( !actor ) return;
      ui.notifications.info(game.i18n.format("VAGABOND.CreatureBuilder.Created", { name: actor.name }));
    }
    actor.sheet.render({ force: true });
    return this.close();
  }
}
