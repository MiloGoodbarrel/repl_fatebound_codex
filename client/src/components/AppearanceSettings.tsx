import { useMemo, useState } from "react";
import { Check, Moon, Sun, RotateCcw, Search } from "lucide-react";
import { DEFAULT_APPEARANCE, skins, themeColors, type SkinCategory } from "@shared/appearance";
import { useAppearance } from "@/lib/appearance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const categories: Array<SkinCategory|"All">=["All","Classic","Classes","Settings","Adventures","Deities"];
export default function AppearanceSettings() {
  const {appearance,ready,saving,error,dirty,choose,retry}=useAppearance();
  const [search,setSearch]=useState(""),[category,setCategory]=useState<SkinCategory|"All">("All");
  const filtered=useMemo(()=>skins.filter(s=>(category==="All"||s.category===category)&&
    s.name.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(
      search.trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""))),[search,category]);
  const disabled=!ready||saving;
  return <section aria-labelledby="appearance-title" className="space-y-4 rounded-lg border bg-card/40 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="appearance-title" className="font-display text-xl">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your personal DM screen. Applies to all your tools—not your campaigns or players.</p></div>
      <Button size="sm" variant="outline" disabled={disabled} onClick={()=>choose({...DEFAULT_APPEARANCE})}><RotateCcw className="mr-2 size-4" />Reset</Button>
    </div>
    <div role="group" aria-label="Color mode" className="flex flex-wrap gap-2">
      {(["light","dark"] as const).map(mode=><Button key={mode} variant={appearance.mode===mode?"default":"outline"} aria-pressed={appearance.mode===mode}
        disabled={disabled} onClick={()=>choose({...appearance,mode})}>
        {mode==="light"?<Sun className="mr-2 size-4" />:<Moon className="mr-2 size-4" />}{mode==="light"?"Light":"Dark"}
      </Button>)}
    </div>
    <label className="block text-sm font-medium" htmlFor="skin-search">Find a skin</label>
    <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
      <Input id="skin-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Class, setting, adventure or deity…" className="pl-9" />
    </div>
    <div role="group" aria-label="Skin categories" className="flex flex-wrap gap-1.5">
      {categories.map(group=><Button size="sm" variant={category===group?"secondary":"ghost"} key={group} aria-pressed={category===group} onClick={()=>setCategory(group)}>{group}</Button>)}
    </div>
    <div className="max-h-[25rem] overflow-y-auto overscroll-contain rounded-md p-1" aria-label="Skin gallery">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map(skin=>{
          const selected=appearance.skin===skin.id,colors=themeColors({skin:skin.id,mode:appearance.mode});
          return <button key={skin.id} type="button" disabled={disabled} aria-pressed={selected} aria-label={`${skin.name}, ${skin.category}`}
            onClick={()=>choose({...appearance,skin:skin.id})}
            className={`skin-choice min-w-0 rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${selected?"ring-2 ring-primary":"border-border"}`}
            style={{backgroundColor:colors.background,color:colors.foreground}}>
            <span className="mb-2 flex h-8 items-center gap-1.5 rounded border px-2" style={{borderColor:colors.border,backgroundColor:colors.card}} aria-hidden="true">
              <span className="size-2 rounded-full" style={{backgroundColor:colors.primary}} />
              <span className="h-1.5 w-1/3 rounded" style={{backgroundColor:colors["muted-foreground"]}} />
              {selected&&<Check className="ml-auto size-4" style={{color:colors.primary}} />}
            </span>
            <span className="block break-words text-sm font-semibold">{skin.name}</span>
            <span className="text-xs" style={{color:colors["muted-foreground"]}}>{skin.category}</span>
          </button>;
        })}
      </div>
      {!filtered.length&&<p className="py-6 text-center text-sm">No skins match. Try another name or category.</p>}
    </div>
    <p className="text-sm text-muted-foreground" role="status">{!ready?(error?"Appearance unavailable.":"Loading your appearance…"):saving?"Saving appearance…":dirty?"Unsaved preview":`Saved · ${skins.find(s=>s.id===appearance.skin)?.name} · ${appearance.mode}`}</p>
    {error&&<div role="alert" className="space-y-2"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" disabled={saving} onClick={retry}>Retry appearance</Button></div>}
    <p className="text-xs text-muted-foreground">64 skins, each in light and dark. Original fan tributes; not affiliated with Wizards of the Coast. Deity roster: <a className="underline" href="https://www.dndbeyond.com/sources/dnd/basic-rules-2014/appendix-b-gods-of-the-multiverse" target="_blank" rel="noreferrer">Basic Rules (2014), Appendix B</a>.</p>
  </section>;
}
