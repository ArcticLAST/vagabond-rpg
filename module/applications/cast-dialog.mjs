import * as rules from "../rules.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Choose how to Cast a Spell, in the order of the Casting steps (p. 90): its Delivery and any Delivery upcasting,
 * then damage, effect, or both (1 Mana for both), extra damage dice, effect upcasting, and Focus. The Spell's total
 * Mana cost and the caster's Cast Max show the whole time. It ends with Roll Cast Check or Post Spell, and resolves
 * with the chosen casting (or null if closed).
 */
export default class CastDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor({ item, ...options } = {}) {
    super(options);
    this.item = item;
    const sys = item.system;
    const canDamage = !!sys.damageBase && !sys.noDamage;
    // Following the Casting steps (p. 90): Delivery first, then damage and/or effect, then upcasting.
    this.choice = {
      delivery: "",
      steps: 0,
      damage: canDamage,
      effect: !canDamage,
      extraDice: 0,
      otherMana: 0,
      focus: false
    };
    this.canDamage = canDamage;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["vagabond", "cast-dialog", "themed", "theme-light"],
    tag: "div",
    position: { width: 440, height: "auto" },
    window: { icon: "fa-solid fa-wand-sparkles" },
    actions: {
      step: CastDialog.#onStep,
      pickDelivery: CastDialog.#onPickDelivery,
      castRoll: CastDialog.#onCastRoll,
      castPost: CastDialog.#onCastPost
    }
  };

  /** @override */
  static PARTS = {
    form: { template: "systems/vagabond-rpg/templates/apps/cast-dialog.hbs" }
  };

  /** Resolve function for {@link CastDialog.prompt}. */
  #resolve = null;

  /** @override */
  get title() {
    return game.i18n.format("VAGABOND.Roll.CastTitle", { item: this.item.name });
  }

  /**
   * Open the dialog and wait for the player's choice.
   * @param {Item} item
   * @returns {Promise<object|null>}
   */
  static prompt(item) {
    return new Promise(resolve => {
      const app = new this({ item });
      app.#resolve = resolve;
      app.render({ force: true });
    });
  }

  /**
   * Whether the chosen Delivery picks damage and effect when it triggers rather than now (Glyph, Imbue; p. 90).
   * @type {boolean}
   */
  get delayed() {
    return ["imbue", "glyph"].includes(this.choice.delivery);
  }

  /**
   * The Mana breakdown of the current choice.
   * @returns {{delivery: number, discount: number, both: number, dice: number, other: number, total: number}}
   */
  get cost() {
    const c = this.choice;
    const delivery = CONFIG.VAGABOND.deliveries[c.delivery];
    if ( !delivery ) return { delivery: 0, discount: 0, both: 0, dice: 0, other: 0, total: 0 };
    const damage = this.canDamage && c.damage;
    const effect = c.effect;
    // Class Features: Sculpt Spell (cheaper Delivery upcasting), Paragon's Aura (cheaper Aura).
    const fx = this.item.actor?.system.featureMods?.cast ?? {};
    const upcastCost = (delivery.upcast ?? 0) * Math.max(0, c.steps);
    const discount = Math.min(upcastCost, fx.upcastDiscount ?? 0) + ((c.delivery === "aura") ? (fx.auraDiscount ?? 0) : 0);
    const parts = {
      delivery: rules.castCost({ delivery, deliverySteps: c.steps, damage: false, effect: false, discount }),
      discount,
      both: (damage && effect) ? 1 : 0,
      dice: damage ? c.extraDice : 0,
      other: effect ? c.otherMana : 0
    };
    parts.total = parts.delivery + parts.both + parts.dice + parts.other;
    return parts;
  }

  /**
   * The Spell's own upcasting, read from its text ("You can upcast this Spell to ...").
   * @returns {string}
   */
  get upcastText() {
    const text = String(this.item.system.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    return text.split(/(?<=\.)\s+/).filter(s => /upcast/i.test(s)).join(" ").trim();
  }

  /** @override */
  async _prepareContext(options) {
    const cfg = CONFIG.VAGABOND;
    const c = this.choice;
    const attrs = this.item.actor.system.attributes;
    const delivery = cfg.deliveries[c.delivery] ?? null;
    const cost = this.cost;
    const mana = attrs.mana.value;
    const castMax = attrs.castMax;
    const problems = [];
    if ( !delivery ) problems.push(game.i18n.localize("VAGABOND.CastDialog.PickDelivery"));
    else if ( !(this.canDamage && c.damage) && !c.effect ) problems.push(game.i18n.localize("VAGABOND.CastDialog.PickUse"));
    if ( cost.total > mana ) problems.push(game.i18n.format("VAGABOND.CastDialog.NotEnoughMana", { mana }));
    if ( castMax && (cost.total > castMax) ) problems.push(game.i18n.format("VAGABOND.CastDialog.OverCastMax", { max: castMax }));
    const damage = !!delivery && this.canDamage && c.damage;
    const effect = !!delivery && c.effect;
    return {
      item: this.item,
      choice: c,
      canDamage: this.canDamage,
      picked: !!delivery,
      deliveries: Object.entries(cfg.deliveries).map(([k, v]) => ({
        key: k, label: game.i18n.localize(v.label), cost: v.cost, selected: k === c.delivery,
        area: game.i18n.localize(v.area)
      })),
      delivery: delivery ? {
        label: game.i18n.localize(delivery.label),
        area: game.i18n.localize(delivery.area),
        upcast: delivery.upcast,
        step: delivery.step ? game.i18n.localize(delivery.step) : "",
        stepCost: (delivery.upcast ?? 0) * c.steps,
        note: this.delayed ? game.i18n.localize(`VAGABOND.CastDialog.Note.${c.delivery}`) : ""
      } : null,
      showDice: damage,
      showEffectUpcast: effect,
      upcastText: this.upcastText,
      damageDie: this.item.system.damageDie,
      cost,
      upcast: cost.total > 0,
      mana, manaMax: attrs.mana.max, castMax,
      overMax: !!castMax && (cost.total > castMax),
      overMana: cost.total > mana,
      problems,
      canCast: !problems.length
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    for ( const el of this.element.querySelectorAll("[data-field]") ) {
      if ( el.tagName === "BUTTON" ) continue;
      el.addEventListener("change", this.#onChange.bind(this));
    }
  }

  #onChange(event) {
    const el = event.currentTarget;
    const c = this.choice;
    const key = el.dataset.field;
    if ( el.type === "checkbox" ) c[key] = el.checked;
    else if ( el.type === "number" ) c[key] = Math.max(0, Math.floor(Number(el.value) || 0));
    else c[key] = el.value;
    if ( key === "delivery" ) c.steps = 0;
    this.render();
  }

  /** Pick a Delivery from its button. */
  static #onPickDelivery(event, target) {
    this.choice.delivery = target.dataset.delivery;
    this.choice.steps = 0;
    this.render();
  }

  /** +/- buttons on the number fields. */
  static #onStep(event, target) {
    const key = target.dataset.field;
    this.choice[key] = Math.max(0, (this.choice[key] ?? 0) + Number(target.dataset.delta));
    this.render();
  }

  /** Roll the Cast Check. */
  static #onCastRoll() {
    return this.#finish(true);
  }

  /** Post the Spell without a Cast Check. */
  static #onCastPost() {
    return this.#finish(false);
  }

  #finish(check) {
    const c = this.choice;
    if ( !CONFIG.VAGABOND.deliveries[c.delivery] ) return;
    const cost = this.cost;
    const damage = this.canDamage && c.damage;
    const effect = c.effect;
    if ( !damage && !effect ) return;
    this.#resolve?.({
      delivery: c.delivery,
      steps: c.steps,
      damage,
      effect,
      dice: damage ? 1 + c.extraDice : 0,
      effectMana: cost.other,
      mana: cost.total,
      upcast: cost.total > 0,
      focus: c.focus,
      check
    });
    this.#resolve = null;
    return this.close();
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    this.#resolve?.(null);
    this.#resolve = null;
  }
}
