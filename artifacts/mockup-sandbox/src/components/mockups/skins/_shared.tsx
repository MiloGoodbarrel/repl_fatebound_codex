import {useMemo, useState} from "react";
import {Dice5, Heart, Shield, Swords, NotebookPen, ArrowRight, Sparkles} from "lucide-react";
import {ExtractedNavigation, ExtractedStatblock} from "./_Extracted";
import "./_group.css";

export function FontLinks() {
  return <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@400;500;600;700&family=Lato:wght@400;700&display=swap" media="print" onLoad={(event)=>{event.currentTarget.media="all";}} />
  </>;
}

export type SkinTheme = {name:string; className:string; mode?:"light"|"dark"; motif:string; description:string};

const encounter = [
  {name:"Frostwatch Sentinel",kind:"Construct",hp:38,max:38,condition:"Guarding"},
  {name:"Mira Vell",kind:"Ranger · party",hp:27,max:34,condition:"Ready"},
  {name:"Tallow",kind:"Familiar · party",hp:11,max:11,condition:"Ready"},
];

export function Workspace({theme, compact=false, showTitle=true}:{theme:SkinTheme;compact?:boolean;showTitle?:boolean}) {
  const [turn,setTurn]=useState(2);
  const [note,setNote]=useState("");
  const [roll,setRoll]=useState<{label:string;result:number}|null>(null);
  const [activeNav,setActiveNav]=useState("/initiative");
  const current=encounter[(turn-1)%encounter.length];
  const rollCounter=useMemo(()=>roll?.result ?? 0,[roll]);
  const noteId=`note-${theme.className.replace(/[^a-z0-9-]/gi,"-")}`;
  const onRoll=(notation:string,label="Quick roll")=>{
    const modifier=Number(notation.match(/[+-]\d+$/)?.[0]??0);
    const base=((rollCounter*7+13)%20)+1;
    setRoll({label,result:base+modifier});
  };
  return <section className={`skin-group ${theme.className} skin-mesh ${compact?"workspace-mini":""}`} data-theme-preview aria-label={`${theme.name} ${theme.mode??"palette"} mock workspace`}>
    <div className={`workspace-shell ${compact?"compact-shell":""}`}>
      <ExtractedNavigation currentPath={activeNav} onNavigate={setActiveNav}/>
      <main className="workspace-main">
        {showTitle&&<header className="workspace-heading">
          <div><div className="preview-flag">VISUAL SKIN PREVIEW · SAMPLE DATA</div><h1>Initiative</h1><p>The Lantern Coast <span aria-hidden="true">/</span> Tideglass Causeway</p></div>
          {!compact&&<div className="encounter-clock"><span>ROUND</span><strong>{Math.ceil(turn/3)}</strong><span>· TURN {((turn-1)%3)+1} OF 3</span></div>}
        </header>}
        {!showTitle&&<div className="mini-head"><span className="preview-flag">SAMPLE PREVIEW</span><span className="mini-round">R{Math.ceil(turn/3)} · {((turn-1)%3)+1}/3</span></div>}
        <div className="workspace-columns">
          <section className="initiative-pane skin-panel skin-glass" aria-label="Encounter initiative">
            <div className="pane-title"><div><span className="eyebrow">ENCOUNTER</span><h2>Causeway at dusk</h2></div><span className="round-pill">ROUND {Math.ceil(turn/3)}</span></div>
            <div className="turn-banner"><span className="turn-marker"><Swords className="mirror-icon" size={14}/></span><div><small>ACTIVE TURN</small><strong>{current.name}</strong></div><span className="initiative-score">+{current.name==="Frostwatch Sentinel"?"1":"3"}</span></div>
            <div className="encounter-list">{encounter.map((creature,index)=><div key={creature.name} className={`encounter-row ${creature.name===current.name?"is-active":""}`}>
              <span className="order">{String(index+1).padStart(2,"0")}</span><span className={`creature-dot ${index===0?"enemy":""}`}></span>
              <span className="creature-copy"><strong>{creature.name}</strong><small>{creature.kind} · {creature.condition}</small></span>
              <span className="hp-track" aria-label={`${creature.hp} of ${creature.max} hit points`}><i style={{width:`${100*creature.hp/creature.max}%`}}/></span>
              <span className="hp-label"><Heart size={11}/>{creature.hp}</span>
            </div>)}</div>
            <button className="advance-button" onClick={()=>setTurn(value=>value+1)}><ArrowRight className="mirror-icon" size={14}/> Advance turn</button>
            {roll&&<div className="roll-result" role="status"><Dice5 size={13}/><span>{roll.label}: <b>{roll.result}</b></span></div>}
            {!compact&&<div className="notes-block"><label htmlFor={noteId}>SESSION SCRATCHPAD <span>LOCAL DRAFT</span></label><textarea id={noteId} value={note} onChange={event=>setNote(event.target.value)} placeholder="A detail to keep in play…" rows={2}/></div>}
          </section>
          <section className="stat-pane skin-panel skin-glass" aria-label="Frostwatch Sentinel statblock">
            <div className="stat-heading"><div><span className="eyebrow">CREATURE STATBLOCK · SAMPLE</span><h2>Frostwatch Sentinel</h2></div><span className="ac-chip"><Shield size={12}/> AC 16</span></div>
            <div className="hp-summary"><span><Heart size={13}/> HP <b>38</b> <small>/ 38</small></span><div className="hp-track"><i style={{width:"100%"}}/></div></div>
            <ExtractedStatblock onRoll={onRoll}/>
          </section>
        </div>
        {compact&&roll&&<div className="mini-roll" role="status"><Dice5 size={12}/>{roll.label}: <b>{roll.result}</b></div>}
        {!compact&&<footer className="workspace-footer"><NotebookPen size={13}/> Notes and rolls stay in this preview only <span>·</span> No campaign data connected</footer>}
      </main>
    </div>
  </section>;
}

export function SkinHeader({eyebrow,title,description}:{eyebrow:string;title:string;description:string}) {
  return <header className="skin-page-heading"><div><span className="page-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="preview-mark"><Sparkles size={14}/> SKIN LAB · MOCKUP</div></header>;
}
