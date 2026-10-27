import {FontLinks, SkinHeader} from "./_shared";
import {BookMarked, CircleDot, ExternalLink} from "lucide-react";

type Palette={name:string; motif:string; dark:[string,string,string]; light:[string,string,string]; family:string};

const classPalettes:Palette[]=[
  {name:"Barbarian",motif:"ember / cut stone",dark:["#241b17","#f3dfc9","#d57248"],light:["#f4e5d4","#35271f","#a94b2b"],family:"Class"},
  {name:"Bard",motif:"wine / gilt notation",dark:["#261923","#f0dfea","#c579a0"],light:["#f3e5ed","#352333","#9e4c76"],family:"Class"},
  {name:"Cleric",motif:"votive linen / mineral",dark:["#1e2326","#e8e4d6","#80a9a3"],light:["#eeece3","#252a2b","#527b75"],family:"Class"},
  {name:"Druid",motif:"lichen / moon silver",dark:["#1c2420","#e2e8dc","#95b888"],light:["#e8eddf","#252e27","#5a8050"],family:"Class"},
  {name:"Fighter",motif:"forged blue / brass",dark:["#1d242b","#e3e8e9","#c49a57"],light:["#e6e9e9","#252d33","#94703a"],family:"Class"},
  {name:"Monk",motif:"ink / vermilion seal",dark:["#24211c","#eee9df","#d57654"],light:["#f0ebe0","#302b24","#a94e32"],family:"Class"},
  {name:"Paladin",motif:"ivory / oath-gold",dark:["#22231f","#f1ead4","#d7b85d"],light:["#f1eddf","#29291f","#a4842f"],family:"Class"},
  {name:"Ranger",motif:"field slate / lichen",dark:["#1d2526","#e0e8e4","#83a78b"],light:["#e7ece6","#26302d","#54765c"],family:"Class"},
  {name:"Rogue",motif:"smoke / tarnished silver",dark:["#1c2024","#e3e4e1","#9ba6af"],light:["#e8e9e6","#252a2e","#697881"],family:"Class"},
  {name:"Sorcerer",motif:"charged garnet / ash",dark:["#281c22","#f1e0e3","#d57281"],light:["#f3e5e6","#35252b","#a94b5b"],family:"Class"},
  {name:"Warlock",motif:"peat / antique jade",dark:["#201e24","#e8e0eb","#9f83aa"],light:["#ece7ed","#2d2730","#765c81"],family:"Class"},
  {name:"Wizard",motif:"midnight / ruled vellum",dark:["#1b222a","#e1e7ee","#91a9c6"],light:["#e6ebf0","#232a32","#5b7698"],family:"Class"},
  {name:"Artificer",motif:"arcane brass / blueglass",dark:["#182526","#e1edeb","#58b3a3"],light:["#e4efec","#21302f","#337c72"],family:"Class"},
];
const settingPalettes:Palette[]=[
  {name:"Eberron",motif:"arcane-industrial brass / bluegreen",dark:["#172426","#e0ece9","#58b3a3"],light:["#e5eeea","#24302f","#28796e"],family:"Setting"},
  {name:"Cormanthor",motif:"woodland green / silver leaf",dark:["#1c2622","#e4e8df","#a8bf91"],light:["#e9eee4","#273129","#627f4e"],family:"Setting"},
];
const adventurePalettes:Palette[]=[
  {name:"Curse of Strahd",motif:"old stone / burgundy candlelight",dark:["#251c20","#eee2db","#ad5360"],light:["#efe3dc","#34262a","#873b49"],family:"Adventure · no spoilers"},
  {name:"Storm King's Thunder",motif:"monumental stormblue / gold",dark:["#19242d","#e1e9ef","#d0ac59"],light:["#e3eaf0","#25313a","#96752e"],family:"Adventure"},
  {name:"Rise of Tiamat",motif:"obsidian / five metallic accents",dark:["#1d1d21","#eee8de","#cc705f"],light:["#ebe7e0","#29282b","#a95547"],family:"Adventure"},
];

const deities=[
  "Auril","Azuth","Bane","Beshaba","Bhaal","Chauntea","Cyric","Deneir","Eldath","Gond","Helm","Ilmater","Kelemvor","Lathander","Leira","Lliira","Loviatar","Malar","Mask","Mielikki","Milil","Myrkul","Mystra","Oghma","Savras","Selûne","Shar","Silvanus","Sune","Talona","Talos","Tempus","Torm","Tymora","Tyr","Umberlee","Waukeen",
];
const deityAccents=["#9bc4dc","#82a8d0","#ae5459","#a796c7","#bd4c4d","#9ebc70","#80719d","#bdad86","#8ebdb3","#d5a952","#a6b9c7","#b9b6a9","#8797aa","#e6bc67","#8f9dcc","#a9b9e9","#b66380","#9d886b","#a4a6ae","#84a878","#d59a87","#8191a7","#a991d6","#ddc37d","#9aabd1","#a3b8ee","#747486","#88aa73","#e7a0b2","#85a279","#80a8b7","#be865d","#c5b88e","#e1c866","#a9b4c2","#76aab7","#d3b05a"];
const deityPalettes:Palette[]=deities.map((name,index)=>({
  name,motif:["orbit","ray","bar","crosscurrent","ember","seed","fracture","script","ripple","gear","ward","thread","gate","dawn","veil","dance","thorn","track","mask","bough","song","eclipse","star","folio","eye","crescent","shadow","canopy","rose","bloom","storm","spear","shield","coin","scale","tide","ledger"][index],
  dark:["#202329","#ece9e2",deityAccents[index]],light:["#eeece5","#292a2c",deityAccents[index]],family:"Deity palette specimen"
}));

function PaletteSpecimen({item}:{item:Palette}) {
  return <article className="catalog-card">
    <header><div><span className="catalog-family">{item.family}</span><h3>{item.name}</h3><p>{item.motif}</p></div><span className={`catalog-motif motif-${item.motif.split(" ")[0]}`} aria-hidden="true"><i/><i/><i/></span></header>
    <div className="specimen-pair">
      {([["DARK",item.dark],["LIGHT",item.light]] as const).map(([mode,palette])=><div key={mode} className="palette-swatch" style={{background:palette[0],color:palette[1],borderColor:palette[2]}}>
        <div className="swatch-title"><CircleDot size={11} style={{color:palette[2]}}/>{mode}<span> Aa</span></div>
        <div className="swatch-sample">Read clearly. <b style={{color:palette[2]}}>Accent</b></div>
        <div className="swatch-colors">{palette.map((color,index)=><i key={`${color}-${index}`} title={color} style={{background:color}}/>)}</div>
      </div>)}
    </div>
  </article>;
}

function CatalogSection({title,description,items}:{title:string;description:string;items:Palette[]}) {
  return <section className="catalog-section"><header className="catalog-section-heading"><div><span>{String(items.length).padStart(2,"0")} PALETTE PAIRS</span><h2>{title}</h2></div><p>{description}</p></header><div className="catalog-grid">{items.map(item=><PaletteSpecimen key={item.name} item={item}/>)}</div></section>;
}

export default function Catalog() {
  return <div className="skin-page catalog-page">
    <FontLinks/>
    <SkinHeader eyebrow="DESIGN SPECIMENS · NOT FINISHED SKINS" title="Palette & motif catalog" description="A field guide to color and original abstract motif directions. Each entry is a paired light/dark palette study, not a production theme."/>
    <div className="catalog-meta"><BookMarked size={15}/><span>Core Forgotten Realms pantheon · 2014-era roster · <b>37 deities</b></span><a href="https://www.dndbeyond.com/sources/dnd/basic-rules-2014/appendix-b-gods-of-the-multiverse" target="_blank" rel="noreferrer">Source: Basic Rules 2014, Appendix B <ExternalLink size={12}/></a></div>
    <CatalogSection title="Class studies" description="Unfinished color directions for the remaining class identities. Gunslinger and Illrigger are in the tribute board." items={classPalettes}/>
    <CatalogSection title="World settings" description="Place expressed through materials and atmosphere—not copied marks or regional art." items={settingPalettes}/>
    <CatalogSection title="Adventure studies" description="Tone-only palette specimens. Curse of Strahd contains no story spoilers." items={adventurePalettes}/>
    <CatalogSection title="Deities of the Forgotten Realms" description="Portfolio-inspired abstract marks only. This is a palette round, not 37 completed deity skins or copied holy symbols." items={deityPalettes}/>
    <footer className="catalog-footer">Portfolio colors suggest a material or mood, never an official sacred emblem. All marks shown here are original geometric abstractions.</footer>
  </div>;
}
