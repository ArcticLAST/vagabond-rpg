const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * One sheet for every Item type, with a Details tab that switches on the type.
 */
export default class VagabondItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["vagabond", "sheet", "item", "themed", "theme-light"],
    position: { width: 560, height: 620 },
    form: { submitOnChange: true },
    window: { resizable: true },
    actions: {
      addRow: VagabondItemSheet.#onAddRow,
      deleteRow: VagabondItemSheet.#onDeleteRow,
      createEffect: VagabondItemSheet.#onCreateEffect,
      editEffect: VagabondItemSheet.#onEditEffect,
      deleteEffect: VagabondItemSheet.#onDeleteEffect,
      toggleEffect: VagabondItemSheet.#onToggleEffect
    }
  };

  /** @override */
  static PARTS = {
    header: { template: "systems/vagabond-rpg/templates/item/header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    description: { template: "systems/vagabond-rpg/templates/item/description.hbs", scrollable: [""] },
    details: { template: "systems/vagabond-rpg/templates/item/details.hbs", scrollable: [""] },
    effects: { template: "systems/vagabond-rpg/templates/item/effects.hbs", scrollable: [""] }
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "description", icon: "fa-solid fa-feather" },
        { id: "details", icon: "fa-solid fa-sliders" },
        { id: "effects", icon: "fa-solid fa-bolt" }
      ],
      initial: "description",
      labelPrefix: "VAGABOND.Tab"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const cfg = CONFIG.VAGABOND;
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const enrich = html => TextEditor.enrichHTML(html ?? "", {
      secrets: item.isOwner, rollData: item.getRollData(), relativeTo: item
    });
    Object.assign(context, {
      item,
      system: item.system,
      source: item.system._source,
      config: cfg,
      editable: this.isEditable,
      tabs: this._prepareTabs("primary"),
      typeLabel: game.i18n.localize(CONFIG.Item.typeLabels[item.type]),
      detailsPartial: `systems/vagabond-rpg/templates/item/parts/${item.type}.hbs`,
      descriptionHTML: await enrich(item.system.description),
      tags: item.system.chatTags ?? []
    });

    // Option lists
    const labels = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === "string" ? v : v.label]));
    context.options = {
      skills: labels(cfg.skills),
      stats: labels(cfg.stats),
      ranges: cfg.ranges,
      grips: cfg.grips,
      metals: labels(cfg.metals),
      armorTypes: labels(cfg.armorTypes),
      gearCategories: cfg.gearCategories,
      alchemicalTypes: cfg.alchemicalTypes,
      rollTypes: cfg.rollTypes,
      damageBases: cfg.damageBases,
      // Any Skill: Magical Secret uses Arcana, Influence, or Mysticism; Naturally Attuned allows any Skill.
      castSkills: { "": "VAGABOND.Spell.ClassSkill", ...Object.fromEntries(Object.entries(cfg.skills).map(([k, v]) => [k, v.label])) },
      weaponDamageTypes: cfg.damageTypes,
      actionDamageTypes: { "": "VAGABOND.DamageBase.none", ...cfg.damageTypes },
      deliveries: labels(cfg.deliveries),
      castMaxTypes: cfg.castMaxTypes,
      actionTypes: cfg.npcActionTypes,
      saves: cfg.saveOptions,
      effectSaveKeys: Object.entries(cfg.saves).map(([key, s]) => ({ key, label: s.label })),
      featureSources: cfg.featureSources,
      sizes: cfg.sizes,
      beingTypes: cfg.beingTypes,
      dieFaces: { 4: "d4", 6: "d6", 8: "d8", 10: "d10", 12: "d12" }
    };
    context.weaponTypes = cfg.attackSkills.map(k => ({
      key: k, label: cfg.skills[k].label, checked: item.system.types?.[k]
    }));
    context.weaponProperties = Object.entries(cfg.weaponProperties).map(([k, v]) => ({
      key: k, label: v.label, hint: v.hint, checked: item.system.properties?.[k]
    }));
    context.skillChecks = Object.entries(cfg.skills).map(([k, v]) => ({
      key: k, label: v.label,
      checked: item.system.trainings?.includes(k),
      option: item.system.trainingChoices?.options?.includes(k)
    }));
    context.statChecks = Object.entries(cfg.stats).map(([k, v]) => ({
      key: k, label: v.label, checked: item.system.keyStats?.includes(k)
    }));
    if ( item.system.features ) context.featureRows = await Promise.all(item.system.features.map(async (f, i) => ({
      ...f, index: i, html: await enrich(f.description)
    })));
    if ( item.system.traits ) context.traitRows = await Promise.all(item.system.traits.map(async (t, i) => ({
      ...t, index: i, html: await enrich(t.description)
    })));

    // Starting Pack contents, linked to their source Items.
    if ( item.system.isKit ) context.kitLinks = await Promise.all(item.system.contents.map(c => c.uuid
      ? TextEditor.enrichHTML(`@UUID[${c.uuid}]{${c.name}}`) : c.name));

    // Effects
    context.effects = item.effects.map(e => ({
      id: e.id, name: e.name, img: e.img, disabled: e.disabled, transfer: e.transfer
    }));
    return context;
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if ( context.tabs?.[partId] ) context.tab = context.tabs[partId];
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const drop = this.element.querySelector("[data-kit-drop]");
    if ( drop && this.isEditable ) {
      drop.addEventListener("dragover", event => event.preventDefault());
      drop.addEventListener("drop", this.#onDropKitItem.bind(this));
    }
  }

  /**
   * Add a dropped Item to a Starting Pack's contents.
   * @param {DragEvent} event
   */
  async #onDropKitItem(event) {
    event.preventDefault();
    event.stopPropagation();
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if ( (data?.type !== "Item") || !data.uuid ) return;
    const doc = await fromUuid(data.uuid);
    if ( !doc || doc.system.isKit ) return;
    const contents = foundry.utils.deepClone(this.item.system._source.contents ?? []);
    const existing = contents.find(c => c.uuid === doc.uuid);
    if ( existing ) existing.quantity += 1;
    else contents.push({ uuid: doc.uuid, name: doc.name, quantity: 1, value: null });
    return this.item.update({ "system.contents": contents });
  }

  /* -------------------------------------------- */

  /**
   * Convert checkbox groups into arrays before submitting.
   * @override
   */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const sys = data.system ?? {};
    const collect = (prefix, target) => {
      const keys = Object.keys(sys[prefix] ?? {});
      if ( !keys.length && !(prefix in sys) ) return;
      foundry.utils.setProperty(data, target, keys.filter(k => sys[prefix][k]));
      delete sys[prefix];
    };
    if ( "_trainings" in sys ) collect("_trainings", "system.trainings");
    if ( "_keyStats" in sys ) collect("_keyStats", "system.keyStats");
    if ( "_trainingOptions" in sys ) collect("_trainingOptions", "system.trainingChoices.options");

    // Arrays of Feature/Trait rows arrive as objects keyed by index.
    for ( const key of ["features", "traits"] ) {
      if ( sys[key] && !Array.isArray(sys[key]) ) {
        const current = foundry.utils.deepClone(this.item.system._source[key] ?? []);
        for ( const [i, row] of Object.entries(sys[key]) ) Object.assign(current[Number(i)] ?? {}, row);
        sys[key] = current;
      }
    }
    return data;
  }

  /* -------------------------------------------- */

  static async #onAddRow(event, target) {
    const key = target.dataset.list;
    const rows = foundry.utils.deepClone(this.item.system._source[key] ?? []);
    rows.push({ level: 1, name: game.i18n.localize("VAGABOND.Sheet.NewFeature"), description: "" });
    return this.item.update({ [`system.${key}`]: rows });
  }

  static async #onDeleteRow(event, target) {
    const key = target.dataset.list;
    const index = Number(target.dataset.index);
    const rows = foundry.utils.deepClone(this.item.system._source[key] ?? []);
    rows.splice(index, 1);
    return this.item.update({ [`system.${key}`]: rows });
  }

  _getEffect(target) {
    return this.item.effects.get(target.closest("[data-effect-id]")?.dataset.effectId);
  }

  static async #onCreateEffect() {
    const [effect] = await this.item.createEmbeddedDocuments("ActiveEffect", [{
      name: this.item.name, img: this.item.img, transfer: true
    }]);
    return effect?.sheet.render({ force: true });
  }

  static #onEditEffect(event, target) {
    return this._getEffect(target)?.sheet.render({ force: true });
  }

  static async #onDeleteEffect(event, target) {
    return this._getEffect(target)?.delete();
  }

  static async #onToggleEffect(event, target) {
    const effect = this._getEffect(target);
    return effect?.update({ disabled: !effect.disabled });
  }
}
