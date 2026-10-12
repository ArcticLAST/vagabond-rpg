import CharacterData from "./actor-character.mjs";
import NPCData from "./actor-npc.mjs";
import ContainerData, { VehicleData } from "./actor-container.mjs";
import WeaponData from "./item-weapon.mjs";
import ArmorData from "./item-armor.mjs";
import GearData from "./item-gear.mjs";
import SpellData from "./item-spell.mjs";
import { ActionData, AncestryData, ClassData, FeatureData, PerkData } from "./item-simple.mjs";

export {
  CharacterData, NPCData, ContainerData, VehicleData, WeaponData, ArmorData, GearData, SpellData,
  ActionData, AncestryData, ClassData, FeatureData, PerkData
};

export const actor = {
  character: CharacterData,
  npc: NPCData,
  container: ContainerData,
  vehicle: VehicleData
};

export const item = {
  weapon: WeaponData,
  armor: ArmorData,
  gear: GearData,
  spell: SpellData,
  perk: PerkData,
  feature: FeatureData,
  class: ClassData,
  ancestry: AncestryData,
  action: ActionData
};
