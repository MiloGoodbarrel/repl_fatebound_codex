import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { skins, themeColors, contrast, normalizeAppearance, appearanceSchema, DEFAULT_APPEARANCE } from "../shared/appearance";
import { registerAppearanceRoutes } from "../server/auth/appearance";
import { apiPolicy } from "../server/auth/policy";

test("all 64 skins have valid, contrast-safe light/dark semantics",()=>{
  assert.equal(skins.length,64);
  assert.equal(new Set(skins.map(s=>s.id)).size,64);
  assert.equal(skins.filter(s=>s.category==="Deities").length,37);
  assert.equal(skins.filter(s=>s.category==="Classes").length,15);
  for(const skin of skins) for(const mode of ["light","dark"] as const) {
    assert.ok(appearanceSchema.safeParse({skin:skin.id,mode}).success);
    const colors=themeColors({skin:skin.id,mode});
    for(const value of Object.values(colors)) assert.match(value,/^#[0-9a-f]{6}$/i);
    for(const [fg,bg] of [["foreground","background"],["card-foreground","card"],["muted-foreground","card"],["primary","card"],["primary-foreground","primary"]]) {
      assert.ok(contrast(colors[fg],colors[bg])>=4.49,`${skin.id}/${mode} ${fg}/${bg}`);
    }
  }
  assert.equal(skins.find(s=>s.id==="illuskian")!.dark[0],"#0D1117");
  assert.equal(skins.find(s=>s.id==="illuskian")!.dark[2],"#8B5CF6");
});

test("retired or malformed preferences normalize to Classic Dark; writes are strict",()=>{
  for(const value of [null,undefined,{}, {skin:"unknown",mode:"dark"},{skin:"illuskian",mode:"system"},{skin:"classic",mode:"dark",userId:"someone"}]) {
    assert.deepEqual(normalizeAppearance(value),DEFAULT_APPEARANCE);
    assert.equal(appearanceSchema.safeParse(value).success,false);
  }
});

test("appearance endpoints enforce verified account isolation, CSRF, validation and failures",async()=>{
  const data=new Map<string,unknown>();
  let fail=false;
  const app=express(); app.use(express.json());
  app.use("/api",apiPolicy(async req=>{
    const id=req.get("test-identity"); return id?{userId:id,admin:false}:null;
  },{campaignOwner:async()=>null,characterCampaign:async()=>null,tableCampaign:async()=>null}));
  registerAppearanceRoutes(app,{
    async read(id) { if(fail) throw Error("private backend detail"); return data.get(id); },
    async write(id,value) { if(fail) throw Error("private backend detail"); data.set(id,value); },
  });
  app.use((err:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(500).json({message:err.message}));
  const server=app.listen(0,"127.0.0.1"); await once(server,"listening");
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const request=(user:string|null,method="GET",body?:unknown,extra?:Record<string,string>)=>fetch(origin+"/api/account/appearance",{
    method,headers:{Origin:origin,...(user?{"test-identity":user}:{}),...(body?{"Content-Type":"application/json"}:{}),...extra},
    body:body?JSON.stringify(body):undefined,
  });
  try {
    assert.equal((await request(null)).status,401);
    assert.equal((await request(null,"PUT",{skin:"wizard",mode:"dark"})).status,401);
    assert.deepEqual(await (await request("alice")).json(),DEFAULT_APPEARANCE);
    const chosen={skin:"illuskian",mode:"light"};
    assert.deepEqual(await (await request("alice","PUT",chosen)).json(),chosen);
    assert.deepEqual(await (await request("alice")).json(),chosen);
    assert.deepEqual(await (await request("bob")).json(),DEFAULT_APPEARANCE);
    for(const body of [{skin:"missing",mode:"light"},{skin:"wizard",mode:"wrong"},{skin:"wizard",mode:"dark",userId:"alice"}]) {
      assert.equal((await request("bob","PUT",body)).status,400);
    }
    assert.equal((await request("alice","PUT",chosen,{Origin:"https://attacker.invalid"})).status,403);
    assert.equal((await request("bob","PUT",chosen,{"X-Workspace-User":"alice"})).status,409);
    assert.equal((await request("alice")).headers.get("cache-control"),"private, no-store");
    fail=true;
    for(const method of ["GET","PUT"]) {
      const response=await request("alice",method,method==="PUT"?chosen:undefined);
      assert.equal(response.status,500);
      assert.doesNotMatch(await response.text(),/private backend detail/);
    }
    fail=false; data.set("alice",{skin:"retired",mode:"light"});
    assert.deepEqual(await (await request("alice")).json(),DEFAULT_APPEARANCE);
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
