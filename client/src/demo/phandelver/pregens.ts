/** StarterSet_Characters.pdf: five unnamed level-one PCs, not invented people. */
export const PHANDELVER_PREGENS = [
  { id: 100, name: "Human Fighter (Noble)", playerClass: "Fighter 1 · Human · Noble", maxHp: 12, ac: 17, initiativeBonus: -1,
    page: 1, notes: "STR 16, DEX 9, CON 15, INT 11, WIS 13, CHA 14. Greataxe +5 (1d12+3 slashing); javelin +5 (1d6+3 piercing). Defense fighting style is included in AC 17; Second Wind 1d10+1 once per short/long rest. Chain mail, no equipped shield. Speed 30 ft." },
  { id: 101, name: "Hill Dwarf Cleric (Soldier)", playerClass: "Cleric 1 · Hill dwarf · Soldier", maxHp: 11, ac: 18, initiativeBonus: -1,
    page: 3, notes: "STR 14, DEX 8, CON 15, INT 10, WIS 16, CHA 12. Warhammer/handaxe +4 (1d8+2 bludgeoning / 1d6+2 slashing). Life Domain; Disciple of Life; spell save DC 13, spell attack +5. Cantrips: light, sacred flame, thaumaturgy. Two first-level slots; prepare three cleric spells, with bless and cure wounds always prepared as domain spells. Chain mail and shield; speed 25 ft. Related to the Rockseeker brothers." },
  { id: 102, name: "Lightfoot Halfling Rogue (Criminal)", playerClass: "Rogue 1 · Lightfoot halfling · Criminal", maxHp: 9, ac: 14, initiativeBonus: 3,
    page: 5, notes: "STR 8, DEX 16, CON 12, INT 13, WIS 10, CHA 16. Shortsword/shortbow +5 (1d6+3 piercing). Sneak Attack +1d6 once per turn when eligible; Lucky; Brave; Naturally Stealthy. Speed 25 ft. Former Redbrand associate." },
  { id: 103, name: "High Elf Wizard (Acolyte)", playerClass: "Wizard 1 · High elf · Acolyte", maxHp: 8, ac: 12, initiativeBonus: 2,
    page: 7, notes: "STR 10, DEX 15, CON 14, INT 16, WIS 12, CHA 8. Shortsword +4 (1d6+2 piercing). Spell save DC 13, spell attack +5. Cantrips: mage hand, prestidigitation, ray of frost, shocking grasp. Two first-level slots; prepare four spells from the spellbook: burning hands, detect magic, mage armor, magic missile, shield, sleep. Arcane Recovery; Fey Ancestry; Trance. Speed 30 ft. Follower of Oghma; personal lead concerns Cragmaw Castle's shrine." },
  { id: 104, name: "Human Fighter (Folk Hero)", playerClass: "Fighter 1 · Human · Folk hero", maxHp: 12, ac: 14, initiativeBonus: 3,
    page: 9, notes: "STR 14, DEX 16, CON 15, INT 11, WIS 13, CHA 9. Greatsword +4 (2d6+2 slashing); longbow +7 (1d8+3 piercing, Archery bonus included). Second Wind 1d10+1 once per short/long rest; Rustic Hospitality. Speed 30 ft. Wants to restore Thundertree." },
] as const;
