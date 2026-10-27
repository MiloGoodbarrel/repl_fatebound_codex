// Source-backed presentation fragments from FeatureNavigation and MonsterStatblock.
// Only account/navigation dependencies are stubbed; no API or private campaign data.
import {useState} from "react";
import {BookOpen, Compass, Dices, Package, Swords, Shield, Heart} from "lucide-react";
import {Badge} from "@/components/ui/badge";

const destinations = [
  {href:"/campaigns",label:"Campaigns",Icon:Compass},
  {href:"/loot",label:"Loot",Icon:Package},
  {href:"/tables",label:"Roll Tables",Icon:Dices},
  {href:"/initiative",label:"Initiative",Icon:Swords},
  {href:"/sessions",label:"Sessions",Icon:BookOpen},
];
export function ExtractedNavigation({currentPath="/initiative",onNavigate}:{currentPath?:string;onNavigate?:(path:string)=>void}) {
  return (
    <nav aria-label="Campaign tools" className="sticky top-0 z-40 border-b border-border/80 bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex min-h-14 max-w-screen-2xl flex-wrap items-center gap-x-3 px-3 sm:px-6">
        <div className="hidden shrink-0 items-center gap-2.5 md:flex">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary"><Compass className="size-4" /></span>
          <span className="font-display text-sm font-semibold tracking-[0.12em] text-foreground">FATEBOUND CODEX</span>
        </div>
        <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-center">
          {destinations.map(({href,label,Icon})=>{
            const isCurrent=currentPath===href;
            return <li key={href} className="shrink-0">
              <button onClick={()=>onNavigate?.(href)} aria-current={isCurrent?"page":undefined}
                className={`group relative flex min-h-10 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4 sm:text-sm ${isCurrent?"bg-primary/10 text-primary":"text-muted-foreground hover:bg-accent/70 hover:text-foreground"}`}>
                <Icon aria-hidden="true" className="hidden size-4 shrink-0 sm:block" /><span>{label}</span>
                {isCurrent&&<span aria-hidden="true" className="absolute inset-x-3 -bottom-2 h-0.5 rounded-full bg-primary" />}
              </button>
            </li>;
          })}
        </ul>
        <div aria-label="Active campaign: The Lantern Coast (sample)" className="hidden max-w-48 shrink-0 items-center gap-2 border-l border-border pl-4 lg:flex">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
          <span className="truncate text-xs text-muted-foreground">The Lantern Coast</span>
        </div>
      </div>
    </nav>
  );
}

export const sampleMonster = {
  name:"Frostwatch Sentinel",size:"Medium",type:"construct",alignment:"unaligned",source:"Mockup sample",
  ac:16,hp:38,hit_dice:"7d8 + 7",str:16,dex:12,con:14,int:8,wis:12,cha:6,
  strMod:3,dexMod:1,conMod:2,intMod:-1,wisMod:1,chaMod:-2,
  savingThrows:{str:5,con:4},speed:{walk:"30 ft."},senses:"Darkvision 60 ft.",languages:"Understands Common",
  traits:[{name:"Steadfast",description:"The sentinel has advantage on checks to resist being moved."}],
  detailedActions:[
    {name:"Frost Pike",description:"Melee weapon attack: reach 10 ft., one target. Hit: 1d10 + 3 piercing damage.",category:"action",attackBonus:5},
    {name:"Shove",description:"One creature within 5 feet must succeed on a DC 13 Strength save or be pushed 5 feet.",category:"action"},
    {name:"Guard",description:"Take a defensive stance until the start of the next turn.",category:"action"},
    {name:"Signal",description:"Sound a warning to nearby allies.",category:"action"},
  ],
};

export function ExtractedStatblock({onRoll}:{onRoll:(notation:string,label?:string)=>void}) {
  const monster=sampleMonster;
  const [showAllActions,setShowAllActions]=useState(false);
  const abilityScores=[
    {label:"STR",score:monster.str,mod:monster.strMod},
    {label:"DEX",score:monster.dex,mod:monster.dexMod},
    {label:"CON",score:monster.con,mod:monster.conMod},
    {label:"INT",score:monster.int,mod:monster.intMod},
    {label:"WIS",score:monster.wis,mod:monster.wisMod},
    {label:"CHA",score:monster.cha,mod:monster.chaMod},
  ];
  const formatMod=(mod:number)=>mod>=0?`+${mod}`:`${mod}`;
  const mainActions=monster.detailedActions;
  const visibleActions=showAllActions?mainActions:mainActions.slice(0,3);
  const hiddenCount=mainActions.length-3;
  return (
    <div className="mt-3 pt-3 border-t border-border/50 text-xs space-y-3">
      <div className="flex items-center flex-wrap gap-2">
        <span className="text-muted-foreground">{[monster.size,monster.type,monster.alignment].filter(Boolean).join(" · ")}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1">{monster.source}</Badge>
      </div>
      <div className="flex flex-wrap gap-3">
        <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-muted-foreground" /><span className="font-semibold">AC</span> {monster.ac}</span>
        <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-muted-foreground" /><span className="font-semibold">HP</span> avg {monster.hp}<span className="text-muted-foreground ml-1">({monster.hit_dice})</span></span>
      </div>
      <div className="grid grid-cols-6 gap-1 text-center bg-muted/30 rounded p-2">
        {abilityScores.map(({label,score,mod})=>(
          <div key={label} className="space-y-0.5">
            <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
            <div className="font-mono font-bold text-sm">{score??"—"}</div>
            <button className="text-primary/80 hover:text-primary text-[11px]" onClick={()=>onRoll(`1d20${formatMod(mod)}`,`${monster.name} ${label}`)}>{formatMod(mod)}</button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" data-testid="saving-throw-bonuses">
        <span className="font-semibold">Saving throws:</span>
        {Object.entries(monster.savingThrows).map(([ability,bonus])=>(
          <button key={ability} className="rounded border border-border px-2 py-1 hover:bg-muted" onClick={()=>onRoll(`1d20${bonus>=0?"+":""}${bonus}`,`${monster.name} ${ability.toUpperCase()} save`)}>{ability.toUpperCase()} {formatMod(bonus)}</button>
        ))}
      </div>
      <div><span className="font-semibold">Speed: </span>{Object.entries(monster.speed).map(([mode,value])=>`${mode} ${value}`).join(", ")}</div>
      <div><span className="font-semibold">Senses: </span>{monster.senses}</div>
      <div><span className="font-semibold">Languages: </span>{monster.languages}</div>
      <div className="space-y-1.5">
        <div className="font-bold text-foreground/80 uppercase tracking-wide text-[10px]">Special Abilities</div>
        {monster.traits.map((trait,i)=><p key={i} className="text-muted-foreground leading-snug"><span className="font-semibold text-foreground/90 italic">{trait.name}. </span>{trait.description}</p>)}
      </div>
      <div className="space-y-1.5">
        <div className="font-bold text-foreground/80 uppercase tracking-wide text-[10px]">Actions</div>
        {visibleActions.map((action,i)=>(
          <p key={i} className="text-muted-foreground leading-snug">
            <span className="font-semibold text-foreground/90 italic">{action.name}. </span>{action.description}
            {action.attackBonus!=null&&<button className="text-primary/80 ml-1 hover:text-primary" onClick={()=>onRoll(`1d20${formatMod(action.attackBonus!)}`,`${monster.name}: ${action.name}`)}>({formatMod(action.attackBonus)} to hit — roll)</button>}
          </p>
        ))}
        {!showAllActions&&hiddenCount>0&&<button onClick={()=>setShowAllActions(true)} className="text-primary/80 hover:text-primary transition-colors text-[11px] font-medium">+{hiddenCount} more action{hiddenCount!==1?"s":""}</button>}
        {showAllActions&&hiddenCount>0&&<button onClick={()=>setShowAllActions(false)} className="text-muted-foreground hover:text-foreground transition-colors text-[11px]">Show less</button>}
      </div>
    </div>
  );
}
