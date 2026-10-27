import {FontLinks, SkinHeader, SkinTheme, Workspace} from "./_shared";
import {Compass} from "lucide-react";

const tributeThemes:SkinTheme[]=[
  {name:"Gunslinger",className:"skin-tribute-gunslinger",motif:"gunmetal, aged brass & engraved leather",description:"Measured steel with an ivory-ink light mode."},
  {name:"Illrigger",className:"skin-tribute-illrigger",motif:"obsidian, oxblood & infernal gold",description:"Angular original geometry; pale stone in daylight."},
  {name:"Faerunic",className:"skin-tribute-faerunic",motif:"wayfarer parchment & old-map ink",description:"A worn travel folio, not a generic fantasy filter."},
  {name:"Baldurian",className:"skin-tribute-baldurian",motif:"harbor stone, salt air & brass",description:"Civic stone and weathered dock metal."},
  {name:"Netherese",className:"skin-tribute-netherese",motif:"floating midnight geometry",description:"A precise, lifted violet architecture."},
  {name:"Neverwinter",className:"skin-tribute-neverwinter",motif:"blue stone & worked copper",description:"Cool masonry, warmed by an ember-metal accent."},
  {name:"Icewind Dale",className:"skin-tribute-icewind",motif:"weathered snow, blue ice & pale stone",description:"A material study separate from Illuskian mirror-glass."},
];

export default function Tributes() {
  return <div className="skin-page tribute-page">
    <FontLinks/>
    <SkinHeader eyebrow="MATERIAL STUDIES · STATIC SKIN PAIRS" title="Class & place" description="Compact dark/light workspace specimens. Every miniature uses the extracted navigation and statblock with synthetic encounter data."/>
    <div className="tribute-list">{tributeThemes.map((theme,index)=><section className="tribute-row" key={theme.name}>
      <header className="tribute-intro"><span className="tribute-index">{String(index+1).padStart(2,"0")}</span><div><h2>{theme.name}</h2><p>{theme.description}</p></div><div className="material-tag"><Compass size={12}/>{theme.motif}</div></header>
      <div className="tribute-pair">
        <div className="mini-specimen"><div className="mode-label">DARK <span>· palette study</span></div><Workspace theme={{...theme,className:`${theme.className} dark`}} compact showTitle={false}/></div>
        <div className="mini-specimen"><div className="mode-label">LIGHT <span>· palette study</span></div><Workspace theme={{...theme,className:`${theme.className} light`}} compact showTitle={false}/></div>
      </div>
    </section>)}</div>
    <p className="tribute-footer">Original motifs only · no official assets or logos · sample encounter state is local to each specimen.</p>
  </div>;
}
