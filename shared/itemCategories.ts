/** Import formats use singular labels; the shared stock catalog uses these labels. */
export function normalizeItemCategory(category: string): string {
  const aliases: Record<string, string> = {
    "wondrous item": "Wondrous Items", "wondrous items": "Wondrous Items",
    weapon: "Weapons", weapons: "Weapons", armor: "Armor", armour: "Armor",
    potion: "Potions", potions: "Potions", ring: "Rings", rings: "Rings",
    rod: "Rods", rods: "Rods", scroll: "Scrolls", scrolls: "Scrolls",
    staff: "Staves", staffs: "Staves", staves: "Staves", wand: "Wands", wands: "Wands",
  };
  return aliases[category.trim().toLowerCase()] ?? category.trim();
}

export function itemCategoryFilterValues(categories: string[]): string[] {
  const names = ["wondrous item", "wondrous items", "weapon", "weapons", "armor", "armour", "potion", "potions",
    "ring", "rings", "rod", "rods", "scroll", "scrolls", "staff", "staffs", "staves", "wand", "wands"];
  const wanted = new Set(categories.map(c => normalizeItemCategory(c).toLowerCase()));
  return Array.from(new Set([...categories.map(c => c.toLowerCase()), ...names.filter(c => wanted.has(normalizeItemCategory(c).toLowerCase()))]));
}
