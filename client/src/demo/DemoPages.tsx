import React, { useEffect, useState } from "react";
import { Check, ChevronRight, Dices, Pencil, Plus, RotateCcw, Save, Shield, Trash2 } from "lucide-react";
import { emptySummarySections, SUMMARY_SECTIONS } from "../../../shared/sessionSummary";
import { skins } from "../../../shared/appearance";
import { demoId, drawWeighted } from "./model";
import type { DemoState } from "./model";
import { useDemo } from "./store";
import { Button, CampaignPicker, Card, Dialog, Field, LimitNote, PageHeading, useActiveCampaign, useCampaignRecords } from "./DemoUi";

const today = () => new Date().toISOString().slice(0,10);
const numeric = (value:string, min:number, max:number) => Math.max(min,Math.min(max,Number(value)||min));

export function CampaignsPage() {
  const {state,update}=useDemo(); const campaign=useActiveCampaign();
  const [dialog,setDialog]=useState<null|{id?:string;name:string;description:string}>(null);
  const [character,setCharacter]=useState<null|{id?:string;name:string;role:string;kind:"PC"|"NPC";disposition:"friendly"|"neutral"|"enemy";hp:number;ac:number}>(null);
  const [confirm,setConfirm]=useState<string|null>(null);
  const [notice,setNotice]=useState("");
  const characters=useCampaignRecords("characters");
  const saveCampaign=(e:React.FormEvent)=>{e.preventDefault();if(!dialog)return;
    const id=dialog.id??demoId();
    const ok=update(d=>{const found=d.campaigns.find(c=>c.id===id);if(found){found.name=dialog.name;found.description=dialog.description;}else{if(d.campaigns.length>=8)throw new Error();d.campaigns.push({id,name:dialog.name,description:dialog.description,edition:"5e"});d.activeCampaignId=id;}});
    if(ok){setDialog(null);setNotice("Campaign saved locally.");}
  };
  const saveCharacter=(e:React.FormEvent)=>{e.preventDefault();if(!character)return;
    const id=character.id??demoId();const details={name:character.name,role:character.role,kind:character.kind,disposition:character.disposition,hp:character.hp,ac:character.ac};
    const ok=update(d=>{const found=d.characters.find(x=>x.id===id);if(found)Object.assign(found,details);else {if(d.characters.length>=60)throw new Error();d.characters.push({id,campaignId:d.activeCampaignId,...details});}});
    if(ok){setCharacter(null);setNotice("Character saved locally.");}
  };
  const deleteCampaign=(id:string)=>{update(d=>{if(d.campaigns.length<=1)return;d.campaigns=d.campaigns.filter(c=>c.id!==id);d.characters=d.characters.filter(x=>x.campaignId!==id);d.encounters=d.encounters.filter(x=>x.campaignId!==id);d.loot=d.loot.filter(x=>x.campaignId!==id);d.tables=d.tables.filter(x=>x.campaignId!==id);d.sessions=d.sessions.filter(x=>x.campaignId!==id);if(d.activeCampaignId===id){d.lootDraw=[];d.activeCampaignId=d.campaigns[0].id;}});setConfirm(null);setNotice("Campaign and its demo records deleted.");};
  return <>
    <PageHeading title="Campaign workspace" description="Keep the table's moving pieces close. Switch campaigns to see separate fictional rosters, encounters, loot, tables, and journals."><CampaignPicker/></PageHeading>
    {notice&&<p className="demo-success" role="status">{notice}</p>}
    <div className="demo-main-grid">
      <div>
        <Card title="Campaigns" action={<Button kind="primary" onClick={()=>setDialog({name:"",description:""})}><Plus size={15}/> New campaign</Button>}>
          <div className="demo-list">{state.campaigns.map(c=><div className="demo-row" key={c.id}>
            <div><div className="demo-row-title">{c.name} {c.id===state.activeCampaignId&&<span className="demo-pill">Active</span>}</div><div className="demo-row-meta">{c.description}</div></div>
            <div className="demo-actions"><Button kind="quiet" onClick={()=>update(d=>{d.activeCampaignId=c.id})}>Open</Button><Button kind="quiet" onClick={()=>setDialog({id:c.id,name:c.name,description:c.description})}><Pencil size={14}/> Edit</Button><Button kind="danger" disabled={state.campaigns.length===1} title={state.campaigns.length===1?"The last campaign cannot be deleted":undefined} onClick={()=>setConfirm(c.id)}><Trash2 size={14}/></Button></div>
          </div>)}</div>
          <LimitNote>Up to 8 demo campaigns. Deleting one removes only its demo characters, encounters, loot, tables, and sessions. The final campaign is protected.</LimitNote>
        </Card>
        <Card title="Party & people" action={<Button kind="primary" onClick={()=>setCharacter({name:"",role:"",kind:"PC",disposition:"friendly",hp:1,ac:10})}><Plus size={15}/> Add person</Button>}>
          {characters.length===0?<div className="demo-empty">No people in this campaign yet.</div>:<div className="demo-list">{characters.map(c=><div className="demo-row" key={c.id}>
            <div><div className="demo-row-title">{c.name} <span className="demo-pill">{c.kind}</span> <span className="demo-pill">{c.disposition}</span></div><div className="demo-row-meta">{c.role} · HP {c.hp} · AC {c.ac}</div></div>
            <div className="demo-actions"><Button kind="quiet" onClick={()=>setCharacter({...c})}><Pencil size={14}/> Edit</Button><Button kind="danger" onClick={()=>setConfirm(`character:${c.id}`)}><Trash2 size={14}/></Button></div>
          </div>)}</div>}
          <LimitNote>Characters belong to the active campaign. Encounter combatants are prepared separately and are not automatically overwritten by character edits.</LimitNote>
        </Card>
      </div>
      <aside>
        <Card title="At this table"><p className="demo-stat">{characters.filter(x=>x.kind==="PC").length} <span className="demo-subtle" style={{fontSize:14}}>players</span></p><p className="demo-small demo-subtle">{characters.filter(x=>x.kind==="NPC").length} NPCs in {campaign.name}</p></Card>
        <Card title="Demo boundaries"><p className="demo-small demo-subtle">This is a self-contained browser simulation. It has no connection to an account, server database, uploaded content, or the private workspace.</p><p className="demo-small demo-subtle">Local records are limited by the demo schema and can be cleared with Reset Demo in Settings.</p></Card>
      </aside>
    </div>
    {dialog&&<Dialog title={dialog.id?"Edit campaign":"New campaign"} onClose={()=>setDialog(null)} actions={<><Button onClick={()=>setDialog(null)}>Cancel</Button><Button type="submit" kind="primary" form="campaign-form">Save campaign</Button></>}>
      <form id="campaign-form" onSubmit={saveCampaign} className="demo-grid"><Field label="Campaign name" value={dialog.name} maxLength={100} onChange={v=>setDialog({...dialog,name:v})}/><Field label="Description" value={dialog.description} maxLength={2000} multiline onChange={v=>setDialog({...dialog,description:v})}/></form>
    </Dialog>}
    {character&&<Dialog title={character.id?"Edit person":"Add person"} onClose={()=>setCharacter(null)} actions={<><Button onClick={()=>setCharacter(null)}>Cancel</Button><Button type="submit" kind="primary" form="character-form">Save person</Button></>}>
      <form id="character-form" onSubmit={saveCharacter} className="demo-form-grid">
        <Field label="Name" value={character.name} maxLength={2000} onChange={v=>setCharacter({...character,name:v})}/>
        <Field label="Role / note" value={character.role} maxLength={2000} onChange={v=>setCharacter({...character,role:v})}/>
        <label className="demo-field">Type<select value={character.kind} onChange={e=>setCharacter({...character,kind:e.target.value as "PC"|"NPC"})}><option>PC</option><option>NPC</option></select></label>
        <label className="demo-field">Disposition<select value={character.disposition} onChange={e=>setCharacter({...character,disposition:e.target.value as typeof character.disposition})}><option value="friendly">Friendly</option><option value="neutral">Neutral</option><option value="enemy">Enemy</option></select></label>
        <Field label="HP" type="number" min={1} max={999} value={character.hp} onChange={v=>setCharacter({...character,hp:numeric(v,1,999)})}/>
        <Field label="Armor class" type="number" min={0} max={40} value={character.ac} onChange={v=>setCharacter({...character,ac:numeric(v,0,40)})}/>
      </form>
    </Dialog>}
    {confirm&&<Dialog title={confirm.startsWith("character:")?"Delete this person?":"Delete this campaign?"} onClose={()=>setConfirm(null)} actions={<><Button onClick={()=>setConfirm(null)}>Keep it</Button><Button kind="danger" onClick={()=>confirm.startsWith("character:")?(()=>{update(d=>{d.characters=d.characters.filter(x=>x.id!==confirm.slice(10));});setConfirm(null);})():deleteCampaign(confirm)}>Delete demo record</Button></>}>
      <p className="demo-subtle">This removes demo-only data from this browser. {confirm.startsWith("character:")?"Related prepared encounter members will remain as they were.":"All demo records scoped to this campaign will be removed."}</p>
    </Dialog>}
  </>;
}

export function LootPage() {
  const {state,update}=useDemo();const loot=useCampaignRecords("loot");
  const [query,setQuery]=useState("");const [message,setMessage]=useState("");
  const [deleteId,setDeleteId]=useState("");
  const filtered=state.items.filter(item=>`${item.name} ${item.kind} ${item.rarity}`.toLowerCase().includes(query.toLowerCase()));
  const drawn=state.lootDraw.map(id=>state.items.find(i=>i.id===id)).filter(Boolean) as DemoState["items"];
  const draw=()=>{if(!state.items.length)return;const result=drawWeighted(state.items.map(item=>({id:item.id,weight:1})));update(d=>{if(d.lootDraw.length<12)d.lootDraw.push(result.entryId);});setMessage("A fictional item was drawn.");};
  const saveDraw=()=>{const ok=update(d=>{const counts=new Map<string,number>();d.lootDraw.forEach(id=>counts.set(id,(counts.get(id)||0)+1));Array.from(counts.entries()).forEach(([itemId,quantity])=>{const existing=d.loot.find(x=>x.campaignId===d.activeCampaignId&&x.itemId===itemId);if(existing){if(existing.quantity+quantity>99)throw new Error("Quantity limit.");existing.quantity+=quantity;}else{if(d.loot.length>=100)throw new Error("Loot record limit.");d.loot.push({id:demoId(),campaignId:d.activeCampaignId,itemId,quantity:Math.min(99,quantity)});}});d.lootDraw=[];});if(ok)setMessage("Draw saved to this campaign's demo loot.");};
  return <>
    <PageHeading title="Treasure desk" description="Draw from an original fictional collection, then add the result to the active campaign's local treasure ledger."><CampaignPicker/></PageHeading>
    {message&&<p className="demo-success" role="status">{message}</p>}
    <div className="demo-main-grid">
      <div>
        <Card title="A quick draw" action={<Button kind="primary" onClick={draw} disabled={state.lootDraw.length>=12}><Dices size={15}/> Draw item</Button>}>
          {drawn.length===0?<div className="demo-empty">The velvet tray is empty. Draw an item to begin.</div>:<div className="demo-list">{drawn.map((item,index)=><div className="demo-row" key={`${item.id}-${index}`}><div><div className="demo-row-title">{item.name}</div><div className="demo-row-meta">{item.rarity} · {item.kind}</div></div><Button kind="quiet" onClick={()=>update(d=>{d.lootDraw.splice(index,1);})}>Remove</Button></div>)}</div>}
          <div className="demo-actions" style={{marginTop:14}}><Button kind="primary" onClick={saveDraw} disabled={!drawn.length}>Save to campaign loot</Button><Button onClick={()=>update(d=>{d.lootDraw=[];})} disabled={!drawn.length}>Clear tray</Button></div>
          <LimitNote>Draw tray holds at most 12 results. No real randomness service or paid generation is used.</LimitNote>
        </Card>
        <Card title="Campaign treasure">
          {loot.length===0?<div className="demo-empty">No saved treasure in {state.campaigns.find(c=>c.id===state.activeCampaignId)?.name}.</div>:<div className="demo-list">{loot.map(entry=>{const item=state.items.find(i=>i.id===entry.itemId)!;return <div className="demo-row" key={entry.id}><div><div className="demo-row-title">{item.name} <span className="demo-pill">× {entry.quantity}</span></div><div className="demo-row-meta">{item.rarity} · {item.kind}</div></div><div className="demo-actions"><Button onClick={()=>update(d=>{const x=d.loot.find(v=>v.id===entry.id);if(x)x.quantity=Math.max(1,x.quantity-1);})}>−</Button><Button onClick={()=>update(d=>{const x=d.loot.find(v=>v.id===entry.id);if(x)x.quantity=Math.min(99,x.quantity+1);})}>+</Button><Button kind="danger" onClick={()=>setDeleteId(entry.id)}><Trash2 size={14}/></Button></div></div>})}</div>}
        </Card>
      </div>
      <aside><Card title="Original item archive"><label className="demo-field">Filter items<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, rarity, or kind"/></label><div className="demo-list" style={{marginTop:16}}>{filtered.map(item=><article className="demo-row" key={item.id}><div><div className="demo-row-title">{item.name}</div><div className="demo-row-meta">{item.rarity} · {item.kind}<br/>{item.description}</div></div></article>)}</div>{filtered.length===0&&<p className="demo-subtle demo-small">No matching demo items.</p>}</Card></aside>
    </div>
    {deleteId&&<Dialog title="Remove this treasure?" onClose={()=>setDeleteId("")} actions={<><Button onClick={()=>setDeleteId("")}>Keep it</Button><Button kind="danger" onClick={()=>{update(d=>{d.loot=d.loot.filter(v=>v.id!==deleteId);});setDeleteId("");}}>Remove from campaign</Button></>}><p className="demo-subtle">This removes the saved item from this campaign's demo ledger.</p></Dialog>}
  </>;
}

export function TablesPage() {
  const {state,update}=useDemo();const tables=useCampaignRecords("tables");
  const [selected,setSelected]=useState("");const [editing,setEditing]=useState<null|{id?:string;name:string;entries:{id:string;text:string;weight:number}[]}>(null);
  const [message,setMessage]=useState("");
  const [deleteId,setDeleteId]=useState("");
  useEffect(()=>setSelected(""),[state.activeCampaignId]);
  const active=tables.find(t=>t.id===selected)??tables[0];
  const roll=()=>{if(!active)return;const result=drawWeighted(active.entries);update(d=>{d.lastRoll={tableId:active.id,entryId:result.entryId,roll:result.roll};});};
  const rolled=state.lastRoll?.tableId===active?.id?active?.entries.find(e=>e.id===state.lastRoll?.entryId):undefined;
  const startNew=()=>setEditing({name:"",entries:[{id:demoId(),text:"",weight:1}]});
  const save=(e:React.FormEvent)=>{e.preventDefault();if(!editing)return;const id=editing.id??demoId();const data=structuredClone(editing);const ok=update(d=>{const t=d.tables.find(x=>x.id===id);if(t){t.name=data.name;t.entries=data.entries;}else{if(d.tables.length>=30)throw new Error();d.tables.push({id,campaignId:d.activeCampaignId,name:data.name,entries:data.entries});}});if(ok){setEditing(null);setSelected(id);setMessage("Table saved locally.");}};
  const addEntry=()=>setEditing(p=>p&&p.entries.length<40?{...p,entries:[...p.entries,{id:demoId(),text:"",weight:1}]}:p);
  return <>
    <PageHeading title="Roll tables" description="Use weighted prompts for the next strange discovery. Edit and roll original tables scoped to your active campaign."><CampaignPicker/></PageHeading>
    {message&&<p className="demo-success" role="status">{message}</p>}
    <div className="demo-main-grid">
      <div>
        <Card title="Campaign tables" action={<Button kind="primary" onClick={startNew}><Plus size={15}/> Create table</Button>}>
          {tables.length===0?<div className="demo-empty">No tables here yet. Start with a prompt of your own.</div>:<div className="demo-list">{tables.map(t=><div className="demo-row" key={t.id}><div><div className="demo-row-title">{t.name}</div><div className="demo-row-meta">{t.entries.length} weighted entries</div></div><div className="demo-actions"><Button onClick={()=>setSelected(t.id)}>Open</Button><Button kind="quiet" onClick={()=>setEditing(structuredClone(t))}><Pencil size={14}/> Edit</Button><Button kind="danger" onClick={()=>setDeleteId(t.id)}><Trash2 size={14}/></Button></div></div>)}</div>}
          <LimitNote>Each table supports 1–40 entries with weights from 1 to 100.</LimitNote>
        </Card>
      </div>
      <aside><Card title={active?.name??"Roll preview"} action={<Button kind="primary" disabled={!active} onClick={roll}><Dices size={15}/> Roll</Button>}>
        {active? <><p className="demo-small demo-subtle">Weighted result · roll total {active.entries.reduce((a,b)=>a+b.weight,0)}</p>{rolled?<div className="demo-card" style={{marginTop:14,borderColor:"var(--demo-primary)"}}><div className="demo-eyebrow">RESULT · {state.lastRoll?.roll}</div><p>{rolled.text}</p></div>:<div className="demo-empty">Roll the table to reveal a prompt.</div>}</>:<div className="demo-empty">Choose or create a campaign table to roll.</div>}
      </Card></aside>
    </div>
    {editing&&<Dialog title={editing.id?"Edit roll table":"Create roll table"} onClose={()=>setEditing(null)} actions={<><Button onClick={()=>setEditing(null)}>Cancel</Button><Button type="submit" kind="primary" form="table-form">Save table</Button></>}>
      <form id="table-form" onSubmit={save} className="demo-grid"><Field label="Table name" value={editing.name} maxLength={2000} onChange={v=>setEditing({...editing,name:v})}/>
        {editing.entries.map((entry,i)=><div className="demo-form-grid" key={entry.id} style={{alignItems:"end"}}><Field label={`Entry ${i+1}`} value={entry.text} maxLength={2000} onChange={v=>setEditing({...editing,entries:editing.entries.map(x=>x.id===entry.id?{...x,text:v}:x)})}/><Field label="Weight" type="number" min={1} max={100} value={entry.weight} onChange={v=>setEditing({...editing,entries:editing.entries.map(x=>x.id===entry.id?{...x,weight:numeric(v,1,100)}:x)})}/><Button kind="danger" disabled={editing.entries.length===1} onClick={()=>setEditing({...editing,entries:editing.entries.filter(x=>x.id!==entry.id)})}><Trash2 size={14}/> Remove entry</Button></div>)}
        <Button onClick={addEntry} disabled={editing.entries.length>=40}><Plus size={14}/> Add entry</Button>
      </form>
    </Dialog>}
    {deleteId&&<Dialog title="Delete this roll table?" onClose={()=>setDeleteId("")} actions={<><Button onClick={()=>setDeleteId("")}>Keep table</Button><Button kind="danger" onClick={()=>{update(d=>{d.tables=d.tables.filter(x=>x.id!==deleteId);if(d.lastRoll?.tableId===deleteId)d.lastRoll=null;});if(selected===deleteId)setSelected("");setDeleteId("");}}>Delete table</Button></>}><p className="demo-subtle">This deletes the table and its last roll preview from the active demo campaign.</p></Dialog>}
  </>;
}

export function InitiativePage() {
  const {state,update}=useDemo();const encounters=useCampaignRecords("encounters");const chars=useCampaignRecords("characters");
  const [selected,setSelected]=useState("");const [editor,setEditor]=useState<null|{name:string;members:DemoState["encounters"][number]["members"]}>(null);
  const [message,setMessage]=useState("");
  const [deleteId,setDeleteId]=useState("");
  const encounter=encounters.find(e=>e.id===selected)??encounters[0];
  const sorted=encounter?[...encounter.members].sort((a,b)=>b.initiative-a.initiative):[];
  const activeId=encounter?.members[encounter.turn]?.id;
  const modify=(id:string,fn:(m:DemoState["encounters"][number]["members"][number])=>void)=>update(d=>{const e=d.encounters.find(x=>x.id===encounter?.id);const m=e?.members.find(x=>x.id===id);if(m)fn(m);});
  useEffect(()=>setSelected(""),[state.activeCampaignId]);
  const next=()=>update(d=>{const e=d.encounters.find(x=>x.id===encounter?.id);if(!e||!e.members.length)return;const order=[...e.members].sort((a,b)=>b.initiative-a.initiative);const current=e.members[e.turn];const position=Math.max(0,order.findIndex(m=>m.id===current?.id));const nextPosition=(position+1)%order.length;e.turn=e.members.findIndex(m=>m.id===order[nextPosition].id);if(nextPosition===0)e.round=Math.min(9999,e.round+1);e.running=true;});
  const createEncounter=(e:React.FormEvent)=>{e.preventDefault();if(!editor)return;const id=demoId();const data=structuredClone(editor);const ok=update(d=>{if(d.encounters.length>=20)throw new Error();d.encounters.push({id,campaignId:d.activeCampaignId,name:data.name,round:1,turn:0,running:false,members:data.members});});if(ok){setEditor(null);setSelected(id);setMessage("Encounter prepared locally.");}};
  const prepare=()=>setEditor({name:"",members:chars.length?chars.map(c=>({id:demoId(),name:c.name,ac:c.ac,hp:c.hp,maxHp:c.hp,initiative:10,count:1,conditions:[]})):[{id:demoId(),name:"",ac:10,hp:10,maxHp:10,initiative:10,count:1,conditions:[]}]});
  const addMember=()=>setEditor(p=>p&&p.members.length<30?{...p,members:[...p.members,{id:demoId(),name:"",ac:10,hp:10,maxHp:10,initiative:10,count:1,conditions:[]}]}:p);
  return <>
    <PageHeading title="Initiative" description="Run a prepared encounter with a quick initiative order, shared group HP, and persistent browser-local round state."><CampaignPicker/></PageHeading>
    {message&&<p className="demo-success" role="status">{message}</p>}
    <Card title="Prepared encounters" action={<Button kind="primary" onClick={prepare}><Plus size={15}/> Prepare encounter</Button>}>
      {encounters.length===0?<div className="demo-empty">No encounters are prepared for this campaign.</div>:<div className="demo-actions">{encounters.map(e=><Button key={e.id} kind={encounter?.id===e.id?"primary":"default"} onClick={()=>setSelected(e.id)}>{e.name}</Button>)}</div>}
    </Card>
    {encounter&&<>
      <Card title={encounter.name} action={<div className="demo-actions"><span className="demo-pill">Round {encounter.round}</span><Button kind="primary" onClick={next}><ChevronRight size={15}/> Next turn</Button><Button onClick={()=>update(d=>{const e=d.encounters.find(x=>x.id===encounter.id);if(e)e.running=!e.running;})}>{encounter.running?"Pause":"Start"}</Button><Button kind="danger" onClick={()=>setDeleteId(encounter.id)}><Trash2 size={14}/></Button></div>}>
        <div className="demo-alert">Group HP is one shared demo value for the entire group, not individual creature tracking. Adjusting group size does not redistribute HP or conditions.</div>
        <div className="demo-table-wrap"><table className="demo-table"><thead><tr><th>Initiative</th><th>Combatant</th><th>Count</th><th>HP shared</th><th>AC</th><th>Conditions</th></tr></thead><tbody>{sorted.map(m=><tr key={m.id} className={activeId===m.id?"demo-combat-active":""}>
          <td><input aria-label={`${m.name} initiative`} type="number" min={-30} max={99} value={m.initiative} onChange={e=>modify(m.id,x=>{x.initiative=numeric(e.target.value,-30,99);})}/></td>
          <td><strong>{m.name}</strong>{activeId===m.id&&<span className="demo-pill" style={{marginLeft:7}}>Turn</span>}</td>
          <td><input aria-label={`${m.name} group count`} type="number" min={1} max={30} value={m.count} onChange={e=>modify(m.id,x=>{x.count=numeric(e.target.value,1,30);})}/></td>
          <td><div style={{display:"flex",alignItems:"center",gap:5}}><input aria-label={`${m.name} shared HP`} type="number" min={0} max={m.maxHp} value={m.hp} onChange={e=>modify(m.id,x=>{x.hp=numeric(e.target.value,0,x.maxHp);})}/><span className="demo-subtle">/ {m.maxHp}</span></div></td>
          <td>{m.ac}</td>
          <td><input key={`${m.id}:${m.conditions.join("|")}`} aria-label={`${m.name} conditions`} defaultValue={m.conditions.join(", ")} maxLength={600} placeholder="e.g. prone, restrained" onBlur={e=>{const value=e.currentTarget.value;modify(m.id,x=>{x.conditions=value.split(",").map(v=>v.trim()).filter(Boolean).slice(0,12).map(v=>v.slice(0,50));});}}/></td>
        </tr>)}</tbody></table></div>
        <div className="demo-actions" style={{marginTop:14}}><Button onClick={()=>update(d=>{const e=d.encounters.find(x=>x.id===encounter.id);if(e)e.round=Math.min(9999,e.round+1);})}>Advance round</Button><Button onClick={()=>update(d=>{const e=d.encounters.find(x=>x.id===encounter.id);if(e){e.round=1;e.turn=0;e.running=false;}})}><RotateCcw size={14}/> Reset encounter</Button></div>
      </Card>
      <Card title="Turn order"><div className="demo-list">{sorted.map((m,i)=><div className={`demo-row ${activeId===m.id?"demo-combat-active":""}`} key={m.id}><div><div className="demo-row-title">{i+1}. {m.name}</div><div className="demo-row-meta">Initiative {m.initiative} · {m.count} {m.count===1?"member":"members"} · {m.conditions.length?m.conditions.join(", "):"No conditions"}</div></div><Button onClick={()=>update(d=>{const e=d.encounters.find(x=>x.id===encounter.id);if(e)e.turn=encounter.members.findIndex(x=>x.id===m.id);})}>Set turn</Button></div>)}</div></Card>
    </>}
    {editor&&<Dialog title="Prepare encounter" onClose={()=>setEditor(null)} actions={<><Button onClick={()=>setEditor(null)}>Cancel</Button><Button type="submit" kind="primary" form="encounter-form">Save encounter</Button></>}>
      <form id="encounter-form" onSubmit={createEncounter} className="demo-grid"><Field label="Encounter name" value={editor.name} maxLength={2000} onChange={v=>setEditor({...editor,name:v})}/>
        <p className="demo-small demo-subtle">Choose from this campaign's fictional people, then tune initiative and group size.</p>
        {editor.members.map(m=><div className="demo-form-grid" key={m.id}>
          <Field label="Combatant" value={m.name} maxLength={2000} onChange={v=>setEditor({...editor,members:editor.members.map(x=>x.id===m.id?{...x,name:v}:x)})}/>
          <label className="demo-field">Use character<select value={chars.find(c=>c.name===m.name)?.id??""} onChange={e=>{const c=chars.find(x=>x.id===e.target.value);if(c)setEditor({...editor,members:editor.members.map(x=>x.id===m.id?{...x,name:c.name,hp:c.hp,maxHp:c.hp,ac:c.ac}:x)});}}><option value="">Custom / none</option>{chars.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <Field label="Initiative" type="number" min={-30} max={99} value={m.initiative} onChange={v=>setEditor({...editor,members:editor.members.map(x=>x.id===m.id?{...x,initiative:numeric(v,-30,99)}:x)})}/>
          <Field label="Group count" type="number" min={1} max={30} value={m.count} onChange={v=>setEditor({...editor,members:editor.members.map(x=>x.id===m.id?{...x,count:numeric(v,1,30)}:x)})}/>
          <Field label="Shared HP" type="number" min={1} max={999} value={m.hp} onChange={v=>setEditor({...editor,members:editor.members.map(x=>x.id===m.id?{...x,hp:numeric(v,1,999),maxHp:Math.max(x.maxHp,numeric(v,1,999))}:x)})}/>
          <Field label="AC" type="number" min={0} max={40} value={m.ac} onChange={v=>setEditor({...editor,members:editor.members.map(x=>x.id===m.id?{...x,ac:numeric(v,0,40)}:x)})}/>
          <Button kind="danger" disabled={editor.members.length<=1} onClick={()=>setEditor({...editor,members:editor.members.filter(x=>x.id!==m.id)})}><Trash2 size={14}/> Remove</Button>
        </div>)}
        <Button onClick={addMember} disabled={editor.members.length>=30}><Plus size={14}/> Add combatant</Button>
      </form>
    </Dialog>}
    {deleteId&&<Dialog title="Delete this prepared encounter?" onClose={()=>setDeleteId("")} actions={<><Button onClick={()=>setDeleteId("")}>Keep encounter</Button><Button kind="danger" onClick={()=>{update(d=>{d.encounters=d.encounters.filter(x=>x.id!==deleteId);});if(selected===deleteId)setSelected("");setDeleteId("");}}>Delete encounter</Button></>}><p className="demo-subtle">This removes only the prepared encounter from this campaign's browser-local demo.</p></Dialog>}
  </>;
}

export function SessionsPage() {
  const {state,update}=useDemo();const sessions=useCampaignRecords("sessions");
  const [selected,setSelected]=useState("");const [confirm,setConfirm]=useState<null|{kind:"restore"|"delete";revision?:number}>(null);const [message,setMessage]=useState("");
  useEffect(()=>setSelected(""),[state.activeCampaignId]);
  const session=sessions.find(s=>s.id===selected)??sessions[0];
  const changeSession=(fn:(draft:DemoState,s:DemoState["sessions"][number])=>void)=>session&&update(d=>{const s=d.sessions.find(x=>x.id===session.id);if(s)fn(d,s);});
  const createSession=()=>{const sections=emptySummarySections();const id=demoId();const ok=update(d=>{if(d.sessions.length>=40)throw new Error();d.sessions.unshift({id,campaignId:d.activeCampaignId,title:"Untitled session",date:today(),notes:"",sections,versions:[],sources:[]});});if(ok)setSelected(id);};
  const appendVersion=(status:"draft"|"approved")=>{if(!session)return;if(session.versions.length>=10){setMessage("Snapshot limit reached (10). Remove nothing here; Reset Demo clears the record history.");return;}const latest=session.versions[session.versions.length-1];const revision=(latest?.revision??0)+1;const ok=changeSession((d,s)=>s.versions.push({revision,status,sections:structuredClone(s.sections),createdAt:new Date().toISOString()}));if(ok)setMessage(status==="approved"?"Summary approved as a local snapshot.":"Draft snapshot saved locally.");};
  const restore=(revision:number)=>{if(!session)return;if(session.versions.length>=10){setMessage("Cannot restore: the 10-snapshot history limit is reached. Reset the demo to clear this fictional history.");setConfirm(null);return;}const old=session.versions.find(v=>v.revision===revision);if(!old)return;const latest=session.versions[session.versions.length-1];const next=(latest?.revision??0)+1;const ok=changeSession((d,s)=>{s.sections=structuredClone(old.sections);s.versions.push({revision:next,status:"draft",sections:structuredClone(old.sections),createdAt:new Date().toISOString()});});if(ok)setMessage(`Revision ${revision} restored as a new draft snapshot.`);setConfirm(null);};
  const section=(id:string)=>session?.sections.find(x=>x.id===id);
  return <>
    <PageHeading title="Session journal" description="Keep fictional table notes and manually reviewed summaries in the browser. Session notes autosave locally as you type."><CampaignPicker/></PageHeading>
    {message&&<p className="demo-success" role="status">{message}</p>}
    <div className="demo-main-grid">
      <aside>
        <Card title="Sessions" action={<Button kind="primary" onClick={createSession}><Plus size={15}/> New session</Button>}>
          {sessions.length===0?<div className="demo-empty">Start a local session journal for this campaign.</div>:<div className="demo-list">{sessions.map(s=><button key={s.id} className="demo-btn demo-quiet" style={{textAlign:"left",width:"100%"}} onClick={()=>setSelected(s.id)} aria-current={s.id===session?.id?"true":undefined}><strong>{s.title}</strong><span className="demo-row-meta" style={{display:"block"}}>{s.date}</span></button>)}</div>}
        </Card>
        {session&&<Card title="Session details"><Field label="Title" value={session.title} maxLength={150} onChange={v=>changeSession((d,s)=>{s.title=v||"Untitled session";})}/><div style={{height:10}}/><Field label="Date" value={session.date} type="date" onChange={v=>changeSession((d,s)=>{s.date=v;})}/><div style={{height:10}}/><Field label="Fictional session notes" value={session.notes} multiline maxLength={12000} placeholder="Use original fictional details only." onChange={v=>changeSession((d,s)=>{s.notes=v;})}/><LimitNote>Autosaved to this browser's demo storage. Do not enter private or real campaign notes.</LimitNote></Card>}
        {session&&session.sources.length>0&&<Card title="Fictional source comparison">{session.sources.map(source=><div className="demo-source" key={source.id}><strong>{source.title}</strong><p className="demo-small demo-subtle">Original source · read only</p><pre>{source.original}</pre><p className="demo-small demo-subtle">Reviewed source · read only</p><pre>{source.reviewed}</pre></div>)}</Card>}
      </aside>
      <div>
        {!session?<div className="demo-empty">Choose or create a session to review its summary.</div>:<>
          <Card title="Manual session summary" action={<div className="demo-actions"><Button onClick={()=>appendVersion("draft")}><Save size={14}/> Save snapshot</Button><Button kind="primary" onClick={()=>appendVersion("approved")}><Check size={14}/> Approve snapshot</Button></div>}>
            <p className="demo-small demo-subtle">Nine editable sections. Lock flags are review markers in this simulation; they do not block manual edits.</p>
            <div className="demo-list">{SUMMARY_SECTIONS.map(def=>{const current=section(def.id)!;return <section key={def.id} className="demo-source">
              <div className="demo-card-head"><h3>{def.title}</h3><Button kind={current.locked?"primary":"quiet"} onClick={()=>changeSession((d,s)=>{const item=s.sections.find(x=>x.id===def.id);if(item)item.locked=!item.locked;})}><Shield size={14}/>{current.locked?"Locked":"Lock section"}</Button></div>
              <Field label={`${def.title} summary`} value={current.text} multiline maxLength={12000} onChange={v=>changeSession((d,s)=>{const item=s.sections.find(x=>x.id===def.id);if(item)item.text=v;})}/>
              <div style={{height:10}}/><Field label="Review annotation" value={current.annotation} multiline maxLength={2000} onChange={v=>changeSession((d,s)=>{const item=s.sections.find(x=>x.id===def.id);if(item)item.annotation=v;})}/>
              <div className="demo-actions" style={{marginTop:9}}><label className="demo-field" style={{display:"flex",alignItems:"center",gap:7}}><input type="checkbox" checked={current.locked} onChange={e=>changeSession((d,s)=>{const item=s.sections.find(x=>x.id===def.id);if(item)item.locked=e.target.checked;})}/> Locked flag</label>
                <label className="demo-field" style={{minWidth:220}}>Fictional citation<select value="" onChange={e=>{if(e.target.value)changeSession((d,s)=>{const item=s.sections.find(x=>x.id===def.id);if(item&&!item.sourceIds.includes(e.target.value)&&item.sourceIds.length<40)item.sourceIds.push(e.target.value);});}}>
                  <option value="">Attach seeded source…</option>{session.sources.map(src=><option key={src.id} value={src.id}>{src.title}</option>)}
                </select></label>
              </div>
              {current.sourceIds.length>0&&<div className="demo-actions" style={{marginTop:8}}>{current.sourceIds.map(sourceId=><span className="demo-pill" key={sourceId}>{session.sources.find(src=>src.id===sourceId)?.title??"Fictional note"}<button aria-label="Remove citation" className="demo-btn demo-btn-quiet" style={{padding:"1px 5px",minHeight:22}} onClick={()=>changeSession((d,s)=>{const item=s.sections.find(x=>x.id===def.id);if(item)item.sourceIds=item.sourceIds.filter(x=>x!==sourceId);})}>×</button></span>)}</div>}
            </section>})}</div>
            {session.versions.length>=10&&<div className="demo-alert">Version history is full (10 snapshots). Saving, approving, and restoring are disabled until this demo record is removed with Reset Demo.</div>}
          </Card>
          <Card title="Snapshot history">{session.versions.length===0?<div className="demo-empty">No snapshots yet. Save a draft or approve the current summary.</div>:<div className="demo-list">{[...session.versions].reverse().map(v=><div className="demo-row" key={v.revision}><div><div className="demo-row-title">Revision {v.revision} <span className="demo-pill">{v.status}</span></div><div className="demo-row-meta">{new Date(v.createdAt).toLocaleString()}</div></div><Button disabled={session.versions.length>=10} onClick={()=>setConfirm({kind:"restore",revision:v.revision})}><RotateCcw size={14}/> Restore as new draft</Button></div>)}</div>}
            <LimitNote>Append-only local snapshots, capped at 10 per session. Restore creates another snapshot; it never edits old history.</LimitNote>
          </Card>
          <Card title="Session actions" action={<Button kind="danger" onClick={()=>setConfirm({kind:"delete"})}><Trash2 size={14}/> Delete session</Button>}><p className="demo-small demo-subtle">Deleting removes only this fictional session and its local snapshots.</p></Card>
        </>}
      </div>
    </div>
    {confirm&&<Dialog title={confirm.kind==="restore"?"Restore this snapshot?":"Delete this session?"} onClose={()=>setConfirm(null)} actions={<><Button onClick={()=>setConfirm(null)}>Cancel</Button><Button kind={confirm.kind==="delete"?"danger":"primary"} onClick={()=>{if(confirm.kind==="restore"&&confirm.revision)restore(confirm.revision);else if(session){update(d=>{d.sessions=d.sessions.filter(s=>s.id!==session.id);});setSelected("");setConfirm(null);}}}>{confirm.kind==="restore"?"Restore as new snapshot":"Delete session"}</Button></>}>
      <p className="demo-subtle">{confirm.kind==="restore"?"The chosen sections will be copied into the current summary and appended as a new draft revision.":"The notes, summary, sources, and snapshot history are removed from this browser demo."}</p>
    </Dialog>}
  </>;
}

export function SettingsPage() {
  const {state,update,reset,persistence}=useDemo();
  const [confirm,setConfirm]=useState(false);
  const [message,setMessage]=useState("");
  const skin=skins.find(s=>s.id===state.appearance.skin)??skins[0];
  return <>
    <PageHeading title="Demo settings" description="Choose a local visual treatment and inspect the boundaries of this public QA environment."/>
    <div className="demo-grid demo-grid-2">
      <Card title="Appearance">
        <div className="demo-grid" style={{gap:16}}>
          <label className="demo-field">Skin<select value={state.appearance.skin} onChange={e=>update(d=>{d.appearance.skin=e.target.value;})}>{skins.map(s=><option key={s.id} value={s.id}>{s.name} · {s.category}</option>)}</select></label>
          <div className="demo-actions"><Button kind={state.appearance.mode==="dark"?"primary":"default"} onClick={()=>update(d=>{d.appearance.mode="dark";})}>Dark</Button><Button kind={state.appearance.mode==="light"?"primary":"default"} onClick={()=>update(d=>{d.appearance.mode="light";})}>Light</Button></div>
          <div className="demo-source"><div className="demo-eyebrow">{skin.name} · {state.appearance.mode}</div><p className="demo-small demo-subtle">Only the demo wrapper is themed. This selection never changes your account theme or the rest of the site.</p></div>
        </div>
      </Card>
      <Card title="Browser-local storage">
        <p className="demo-small demo-subtle">Current state: <strong>{persistence==="browser"?"saved in this browser":"memory only"}</strong>. Demo records use a dedicated local storage key, separate from account data.</p>
        <Button kind="danger" onClick={()=>setConfirm(true)}><RotateCcw size={14}/> Reset Demo</Button>
        <p className="demo-small demo-subtle">Reset restores original fictional examples and clears local edits. It does not touch real account data.</p>
      </Card>
      <Card title="Simulated only">
        <div className="demo-list">
          <div className="demo-row"><div><div className="demo-row-title">Uploads, imports & audio</div><div className="demo-row-meta">Not available in this public demo. Nothing is uploaded or transcribed.</div></div><Button disabled title="Disabled: uploads and audio processing are not part of this browser demo">Unavailable</Button></div>
          <div className="demo-row"><div><div className="demo-row-title">AI-assisted actions</div><div className="demo-row-meta">Not connected; no AI requests or paid usage occur.</div></div><Button disabled title="Disabled: no AI services are called by the demo">Unavailable</Button></div>
          <div className="demo-row"><div><div className="demo-row-title">Administration & account controls</div><div className="demo-row-meta">No login, admin, entitlement, or account operations here.</div></div><Button disabled title="Disabled: this is not a signed-in account area">Unavailable</Button></div>
        </div>
      </Card>
      <Card title="What this demo cannot validate">
        <ul className="demo-small demo-subtle" style={{paddingLeft:20,lineHeight:1.8}}><li>Real authentication or access-control behavior</li><li>Isolation between real user accounts</li><li>Server-side persistence, synchronization, or backups</li><li>Uploads, imports, audio transcription, or AI workflows</li></ul>
        <p className="demo-small demo-subtle">Use original fictional values only. Browser edits may be cleared by the browser, and storage limits are intentionally bounded.</p>
      </Card>
    </div>
    {message&&<p role="status" className="demo-success">{message}</p>}
    {confirm&&<Dialog title="Reset this browser demo?" onClose={()=>setConfirm(false)} actions={<><Button onClick={()=>setConfirm(false)}>Keep edits</Button><Button kind="danger" onClick={()=>{reset();setConfirm(false);setMessage("Original fictional demo restored. Current view returned to fresh examples.");window.history.replaceState(null,"",window.location.pathname);}}>Reset Demo</Button></>}>
      <p className="demo-subtle">This permanently replaces local demo edits with original fictional examples in this browser. Real account data is not affected.</p>
    </Dialog>}
  </>;
}
