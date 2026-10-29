import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, BookOpen, Compass, Dices, Package, Settings, Swords } from "lucide-react";
import { Link } from "wouter";
import CopyrightNotice from "@/components/CopyrightNotice";
import type { DemoState } from "./model";
import { useDemo } from "./store";
import { themeColors } from "../../../shared/appearance";

export function DemoNotice() {
  return <div className="demo-notice"><div className="demo-notice-inner">
    <strong>PUBLIC DEMO · FICTIONAL DATA</strong>
    <span>Changes stay in this browser only. Never enter private content. This demo does not validate real authentication, account isolation, or server persistence.</span>
  </div></div>;
}

const navItems = [
  { path: "/", label: "Campaigns", Icon: Compass },
  { path: "/loot", label: "Loot", Icon: Package },
  { path: "/tables", label: "Roll tables", Icon: Dices },
  { path: "/initiative", label: "Initiative", Icon: Swords },
  { path: "/sessions", label: "Sessions", Icon: BookOpen },
  { path: "/settings", label: "Settings", Icon: Settings },
];

export function DemoLayout({ children, basePath = "", title }: { children: React.ReactNode; basePath?: string; title: string }) {
  const { state, persistence, error } = useDemo();
  const root = "";
  return <div className="demo-root" data-demo-skin={state.appearance.skin} data-demo-mode={state.appearance.mode}>
    <div className="demo-shell">
      <header className="demo-topbar"><div className="demo-topbar-inner">
        <Link href={`${root}/`} className="demo-brand"><span aria-hidden="true" className="demo-brand-mark"><Compass size={17}/></span><strong>FATEBOUND CODEX</strong></Link>
        <nav className="demo-nav" aria-label="Demo tools">{navItems.map(({path,label,Icon})=><Link key={path} href={`${root}${path}`} aria-current={title === label || (path === "/" && title === "Campaigns") ? "page" : undefined}><Icon aria-hidden="true" size={15}/>{label}</Link>)}</nav>
        <a className="demo-exit" href={basePath || "/"}>Exit demo</a>
      </div></header>
      <DemoNotice/>
      <div className="demo-main">
        {error && <div className="demo-alert" role="alert"><AlertTriangle size={16} style={{verticalAlign:"-3px",marginRight:7}}/>{error}</div>}
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}><span className="demo-pill" role="status">{persistence === "browser" ? "Saved in this browser" : "Memory only · reload clears changes"}</span></div>
        {children}
      </div>
      <footer className="demo-footer"><CopyrightNotice compact/><span style={{display:"block",marginTop:4}}>Demo state is separate from any account or campaign workspace.</span></footer>
    </div>
  </div>;
}

export function PageHeading({eyebrow="DM TOOLKIT",title,description,children}: {eyebrow?:string;title:string;description:string;children?:React.ReactNode}) {
  return <div className="demo-heading"><div><div className="demo-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children}</div>;
}

export function CampaignPicker() {
  const {state,update}=useDemo();
  return <label className="demo-field demo-campaign-switch">Active campaign
    <select value={state.activeCampaignId} onChange={e=>update(d=>{if(d.activeCampaignId!==e.target.value)d.lootDraw=[];d.activeCampaignId=e.target.value})}>
      {state.campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  </label>;
}

export function Card({title,children,action}: {title:string;children:React.ReactNode;action?:React.ReactNode}) {
  return <section className="demo-card"><div className="demo-card-head"><h2>{title}</h2>{action}</div>{children}</section>;
}

export function Button({children,onClick,kind="default",disabled,type="button",title,form}: {children:React.ReactNode;onClick?:()=>void;kind?:"default"|"primary"|"danger"|"quiet";disabled?:boolean;type?:"button"|"submit";title?:string;form?:string}) {
  return <button type={type} form={form} title={title} disabled={disabled} onClick={onClick} className={`demo-btn ${kind==="primary"?"demo-btn-primary":kind==="danger"?"demo-btn-danger":kind==="quiet"?"demo-btn-quiet":""}`}>{children}</button>;
}

export function Field({label,value,onChange,multiline=false,maxLength,placeholder,type="text",min,max,step}: {
  label:string;value:string|number;onChange:(value:string)=>void;multiline?:boolean;maxLength?:number;placeholder?:string;type?:React.HTMLInputTypeAttribute;min?:number;max?:number;step?:number
}) {
  return <label className="demo-field">{label}{multiline?<textarea value={value} maxLength={maxLength} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/>:<input type={type} value={value} maxLength={maxLength} placeholder={placeholder} min={min} max={max} step={step} onChange={e=>onChange(e.target.value)}/>}</label>;
}

export function Dialog({title,onClose,children,actions}: {title:string;onClose:()=>void;children:React.ReactNode;actions:React.ReactNode}) {
  const {state}=useDemo();
  const colors=themeColors(state.appearance);
  const portalStyle=Object.fromEntries(["background","foreground","card","muted","primary","border"].map((key,index)=>[
    `--demo-${["bg","fg","card","muted","primary","border"][index]}`,colors[key]
  ])) as React.CSSProperties;
  const dialogRef=useRef<HTMLDivElement>(null);
  const onCloseRef=useRef(onClose);onCloseRef.current=onClose;
  useEffect(()=>{
    const node=dialogRef.current;
    const prior=document.activeElement as HTMLElement|null;
    const app=document.querySelector<HTMLElement>(".demo-root");
    const hadInert=app?.hasAttribute("inert")??false;
    app?.setAttribute("inert","");
    const focusables=()=>Array.from(node?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )??[]).filter(el=>!el.hasAttribute("hidden")&&el.getAttribute("aria-hidden")!=="true");
    const first=focusables()[0];
    (first??node)?.focus();
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){e.preventDefault();onCloseRef.current();return;}
      if(e.key!=="Tab")return;
      const items=focusables();
      if(!items.length){e.preventDefault();node?.focus();return;}
      const firstItem=items[0],lastItem=items[items.length-1],active=document.activeElement;
      if(e.shiftKey&&(active===firstItem||!node?.contains(active))){e.preventDefault();lastItem.focus();}
      else if(!e.shiftKey&&(active===lastItem||!node?.contains(active))){e.preventDefault();firstItem.focus();}
    };
    window.addEventListener("keydown",onKey,true);
    return()=>{
      window.removeEventListener("keydown",onKey,true);
      if(app&&!hadInert)app.removeAttribute("inert");
      prior?.focus();
    };
  },[]);
  return createPortal(<div className="demo-dialog-backdrop" style={{...portalStyle,color:colors.foreground,colorScheme:state.appearance.mode}} onMouseDown={e=>{if(e.target===e.currentTarget)onCloseRef.current();}}>
    <div className="demo-dialog" role="dialog" aria-modal="true" aria-labelledby="demo-dialog-title" tabIndex={-1} ref={dialogRef}>
      <h2 id="demo-dialog-title">{title}</h2>{children}<div className="demo-dialog-actions">{actions}</div>
    </div>
  </div>,document.body);
}

export function useActiveCampaign() {
  const {state}=useDemo();
  return state.campaigns.find(c=>c.id===state.activeCampaignId)!;
}
export function useCampaignRecords<K extends "characters"|"encounters"|"loot"|"tables"|"sessions">(key:K) {
  const {state}=useDemo();
  return state[key].filter(item=>item.campaignId===state.activeCampaignId) as DemoState[K];
}

export function LimitNote({children}: {children:React.ReactNode}) { return <p className="demo-disabled-note">{children}</p>; }
