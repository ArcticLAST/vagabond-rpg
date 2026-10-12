/**
 * Active Effects on Weapons, Armor, and Gear only apply while the Item is equipped, so a Relic's powers
 * (such as Swiftness) switch on and off with it. Effects on other Items always apply.
 */
export default class VagabondActiveEffect extends ActiveEffect {
  /** @override */
  get isSuppressed() {
    if ( super.isSuppressed ) return true;
    const item = this.parent;
    if ( !(item instanceof Item) || !this.transfer ) return false;
    if ( !["weapon", "armor", "gear"].includes(item.type) ) return false;
    return !item.system.equipped;
  }
}
