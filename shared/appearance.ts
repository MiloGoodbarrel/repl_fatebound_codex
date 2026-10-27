import { z } from "zod";

export type SkinCategory = "Classic" | "Classes" | "Settings" | "Adventures" | "Deities";
export type Motif = "parchment" | "engraved" | "angular" | "arcane" | "woodland" | "waves" | "frost" | "radiant";
type Palette = readonly [background: string, foreground: string, accent: string];
export interface Skin {
  id: string; name: string; category: SkinCategory; motif: Motif;
  dark: Palette; light: Palette;
}
const make = (id: string, name: string, category: SkinCategory, motif: Motif, dark: Palette, light: Palette): Skin =>
  ({ id, name, category, motif, dark, light });
const classSkin = (id: string, name: string, motif: Motif, dark: Palette, light: Palette) => make(id,name,"Classes",motif,dark,light);

export const skins: readonly Skin[] = [
  make("classic","Classic","Classic","parchment",["#231f1a","#f0e7d6","#ffbf00"],["#f3ead8","#30271f","#926811"]),
  classSkin("barbarian","Barbarian","engraved",["#241b17","#f3dfc9","#d57248"],["#f4e5d4","#35271f","#a94b2b"]),
  classSkin("bard","Bard","waves",["#261923","#f0dfea","#c579a0"],["#f3e5ed","#352333","#9e4c76"]),
  classSkin("cleric","Cleric","radiant",["#1e2326","#e8e4d6","#80a9a3"],["#eeece3","#252a2b","#527b75"]),
  classSkin("druid","Druid","woodland",["#1c2420","#e2e8dc","#95b888"],["#e8eddf","#252e27","#5a8050"]),
  classSkin("fighter","Fighter","engraved",["#1d242b","#e3e8e9","#c49a57"],["#e6e9e9","#252d33","#94703a"]),
  classSkin("monk","Monk","waves",["#24211c","#eee9df","#d57654"],["#f0ebe0","#302b24","#a94e32"]),
  classSkin("paladin","Paladin","radiant",["#22231f","#f1ead4","#d7b85d"],["#f1eddf","#29291f","#a4842f"]),
  classSkin("ranger","Ranger","woodland",["#1d2526","#e0e8e4","#83a78b"],["#e7ece6","#26302d","#54765c"]),
  classSkin("rogue","Rogue","angular",["#1c2024","#e3e4e1","#9ba6af"],["#e8e9e6","#252a2e","#697881"]),
  classSkin("sorcerer","Sorcerer","arcane",["#281c22","#f1e0e3","#d57281"],["#f3e5e6","#35252b","#a94b5b"]),
  classSkin("warlock","Warlock","angular",["#201e24","#e8e0eb","#9f83aa"],["#ece7ed","#2d2730","#765c81"]),
  classSkin("wizard","Wizard","arcane",["#1b222a","#e1e7ee","#91a9c6"],["#e6ebf0","#232a32","#5b7698"]),
  classSkin("artificer","Artificer","engraved",["#182526","#e1edeb","#58b3a3"],["#e4efec","#21302f","#337c72"]),
  classSkin("gunslinger","Gunslinger","engraved",["#191d21","#ece5d6","#c4a257"],["#f4efe3","#302a21","#8b7138"]),
  classSkin("illrigger","Illrigger","angular",["#211919","#ede3d9","#d24a31"],["#eeeae3","#342424","#892d32"]),
  make("faerunic","Færunic","Settings","parchment",["#261e18","#efe4d1","#d1ae5c"],["#efe7d7","#38291f","#94632d"]),
  make("baldurian","Baldurian","Settings","engraved",["#2b3036","#e8e1d6","#c7a450"],["#dfdcd5","#292f37","#976e2e"]),
  make("netherese","Netherese","Settings","arcane",["#171424","#e1e2ef","#bd87eb"],["#eae5f1","#28233f","#8641ba"]),
  make("neverwinter","Neverwinter","Settings","waves",["#1c2831","#dae5eb","#60afba"],["#dae4e9","#213244","#277e8d"]),
  make("eberron","Eberron","Settings","engraved",["#172426","#e0ece9","#58b3a3"],["#e5eeea","#24302f","#28796e"]),
  make("cormanthor","Cormanthor","Settings","woodland",["#1c2622","#e4e8df","#a8bf91"],["#e9eee4","#273129","#627f4e"]),
  make("illuskian","Illuskian","Settings","arcane",["#0D1117","#F0F4F8","#8B5CF6"],["#F0F4F8","#0D1117","#7143d5"]),
  make("icewind-dale","Icewind Dale","Settings","frost",["#1b2930","#e2eef2","#7dc9df"],["#dcebef","#20333d","#2d88a2"]),
  make("curse-of-strahd","Curse of Strahd","Adventures","angular",["#251c20","#eee2db","#ad5360"],["#efe3dc","#34262a","#873b49"]),
  make("storm-kings-thunder","Storm King's Thunder","Adventures","engraved",["#19242d","#e1e9ef","#d0ac59"],["#e3eaf0","#25313a","#96752e"]),
  make("rise-of-tiamat","Rise of Tiamat","Adventures","angular",["#1d1d21","#eee8de","#cc705f"],["#ebe7e0","#29282b","#a95547"]),
  ...([
    ["auril","Auril","#9bc4dc","frost"],["azuth","Azuth","#82a8d0","arcane"],
    ["bane","Bane","#ae5459","angular"],["beshaba","Beshaba","#a796c7","angular"],
    ["bhaal","Bhaal","#bd4c4d","angular"],["chauntea","Chauntea","#9ebc70","woodland"],
    ["cyric","Cyric","#80719d","angular"],["deneir","Deneir","#bdad86","parchment"],
    ["eldath","Eldath","#8ebdb3","waves"],["gond","Gond","#d5a952","engraved"],
    ["helm","Helm","#a6b9c7","engraved"],["ilmater","Ilmater","#b9b6a9","waves"],
    ["kelemvor","Kelemvor","#8797aa","angular"],["lathander","Lathander","#e6bc67","radiant"],
    ["leira","Leira","#8f9dcc","arcane"],["lliira","Lliira","#a9b9e9","radiant"],
    ["loviatar","Loviatar","#b66380","angular"],["malar","Malar","#9d886b","woodland"],
    ["mask","Mask","#a4a6ae","angular"],["mielikki","Mielikki","#84a878","woodland"],
    ["milil","Milil","#d59a87","waves"],["myrkul","Myrkul","#8191a7","angular"],
    ["mystra","Mystra","#a991d6","arcane"],["oghma","Oghma","#ddc37d","parchment"],
    ["savras","Savras","#9aabd1","arcane"],["selune","Selûne","#a3b8ee","radiant"],
    ["shar","Shar","#747486","arcane"],["silvanus","Silvanus","#88aa73","woodland"],
    ["sune","Sune","#e7a0b2","waves"],["talona","Talona","#85a279","angular"],
    ["talos","Talos","#80a8b7","frost"],["tempus","Tempus","#be865d","engraved"],
    ["torm","Torm","#c5b88e","radiant"],["tymora","Tymora","#e1c866","radiant"],
    ["tyr","Tyr","#a9b4c2","engraved"],["umberlee","Umberlee","#76aab7","waves"],
    ["waukeen","Waukeen","#d3b05a","radiant"],
  ] as const).map(([id,name,accent,motif])=>make(id,name,"Deities",motif,["#202329","#ece9e2",accent],["#eeece5","#292a2c",accent])),
];
export const DEFAULT_APPEARANCE = { skin: "classic", mode: "dark" } as const;
export const appearanceSchema = z.object({
  skin: z.string().refine(id => skins.some(s => s.id === id), "Unknown skin"),
  mode: z.enum(["light","dark"]),
}).strict();
export type Appearance = z.infer<typeof appearanceSchema>;
export function normalizeAppearance(value: unknown): Appearance {
  const parsed = appearanceSchema.safeParse(value);
  return parsed.success ? parsed.data : { ...DEFAULT_APPEARANCE };
}

function rgb(hex: string) { return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)); }
export function mix(a: string,b: string,amount: number) {
  const x=rgb(a),y=rgb(b);
  return "#"+x.map((c,i)=>Math.round(c+(y[i]-c)*amount).toString(16).padStart(2,"0")).join("");
}
export function contrast(a: string,b: string) {
  const luminance=(hex: string)=>rgb(hex).map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function readable(color: string,surface: string,ratio=4.5) {
  const target=contrast("#ffffff",surface)>contrast("#000000",surface)?"#ffffff":"#000000";
  for(let step=0;step<=100;step++) {
    const candidate=mix(color,target,step/100);
    if(contrast(candidate,surface)>=ratio) return candidate;
  }
  return target;
}
export function hexToHsl(hex: string) {
  const [r,g,b]=rgb(hex).map(c=>c/255),max=Math.max(r,g,b),min=Math.min(r,g,b);
  const delta=max-min,l=(max+min)/2;
  let h=0;
  if(delta) h=max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;
  return `${((h*60+360)%360).toFixed(3)} ${(delta?delta/(1-Math.abs(2*l-1))*100:0).toFixed(3)}% ${(l*100).toFixed(3)}%`;
}
export function themeColors(appearance: Appearance): Record<string,string> {
  const skin=skins.find(s=>s.id===appearance.skin)??skins[0],dark=appearance.mode==="dark";
  const [bg,fg,baseAccent]=skin[appearance.mode];
  const classic=skin.id==="classic"&&dark;
  const card=classic?"#372e25":skin.id==="illuskian"?(dark?"#19212a":"#ffffff"):(dark?mix(bg,fg,.055):mix(bg,"#ffffff",.72));
  const primary=readable(baseAccent,card,4.5);
  const muted=classic?"#494039":mix(bg,fg,dark?.10:.10);
  const onPrimary=contrast("#ffffff",primary)>contrast("#111111",primary)?"#ffffff":"#111111";
  return {
    background:bg,foreground:fg,card,"card-foreground":fg,popover:card,"popover-foreground":fg,
    primary,"primary-foreground":onPrimary,secondary:muted,"secondary-foreground":fg,
    muted,"muted-foreground":readable(mix(bg,fg,.65),card),
    accent:mix(bg,primary,dark?.25:.12),"accent-foreground":fg,
    destructive:dark?"#ef7777":"#a51d36","destructive-foreground":dark?"#22090e":"#ffffff",
    border:skin.id==="illuskian"&&dark?"#4A5568":mix(bg,fg,dark?.26:.28),
    input:dark?mix(bg,fg,.03):card,ring:primary,
    "skin-base-accent":baseAccent,"skin-secondary-accent":skin.id==="illuskian"?"#06B6D4":mix(primary,fg,.25),
  };
}
