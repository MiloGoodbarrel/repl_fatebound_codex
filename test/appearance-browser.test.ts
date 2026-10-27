import test from "node:test";
import assert from "node:assert/strict";
import { chromium,expect } from "@playwright/test";
import {build} from "esbuild";
import {readFile,readdir} from "node:fs/promises";
import express from "express";
import {once} from "node:events";
import path from "node:path";

test("appearance UI saves, reloads, retries and isolates accounts without remounting work",{
  skip:process.env.APPEARANCE_BROWSER_TEST!=="1",timeout:120000,
},async()=>{
  const result=await build({entryPoints:["test/appearance-browser-fixture.tsx"],bundle:true,write:false,format:"iife",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"'},tsconfig:"tsconfig.json"});
  const assetDir="dist/public/assets";
  const cssFiles=(await readdir(assetDir)).filter(name=>name.endsWith(".css"));
  const css=(await Promise.all(cssFiles.map(name=>readFile(path.join(assetDir,name),"utf8")))).join("\n");
  const app=express();
  app.get("/",(_req,res)=>res.type("html").send('<html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'));
  app.get("/fixture.js",(_req,res)=>res.type("js").send(result.outputFiles[0].text));
  app.get("/style.css",(_req,res)=>res.type("css").send(css));
  const server=app.listen(0,"127.0.0.1"); await once(server,"listening");
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
  try {
    for(const viewport of [{width:1280,height:1000},{width:390,height:844}]) {
      const page=await browser.newPage({viewport});
      const saved:Record<string,any>={},errors:string[]=[];
      let currentUser="alice",fail=false;
      page.on("pageerror",e=>errors.push(e.message));
      await page.route("**/api/account/appearance",async route=>{
        if(fail) { await route.fulfill({status:500,json:{message:"Test failure"}});return; }
        if(route.request().method()==="PUT") saved[currentUser]=route.request().postDataJSON();
        await route.fulfill({json:saved[currentUser]??{skin:"classic",mode:"dark"}});
      });
      await page.goto(origin);
      await expect(page.getByRole("status")).toContainText("Saved · Classic");
      await page.getByRole("button",{name:"Advance sample turn 1"}).click();
      await page.getByLabel("Sample journal draft").fill("Keep this live note");
      await page.getByRole("button",{name:"Light",exact:true}).click();
      await expect(page.getByRole("status")).toContainText("light");
      await page.getByLabel("Find a skin").fill("illuskian");
      await page.getByRole("button",{name:"Illuskian, Settings"}).click();
      await expect(page.getByRole("status")).toContainText("Saved · Illuskian");
      await expect(page.locator("html")).toHaveAttribute("data-skin","illuskian");
      await expect(page.getByRole("button",{name:"Advance sample turn 2"})).toBeVisible();
      await expect(page.getByLabel("Sample journal draft")).toHaveValue("Keep this live note");
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      fail=true;
      await page.getByRole("button",{name:"Dark",exact:true}).click();
      await expect(page.getByRole("alert")).toContainText("was not saved");
      await expect(page.getByRole("status")).toHaveText("Unsaved preview");
      fail=false;
      await page.getByRole("button",{name:"Retry appearance"}).click();
      await expect(page.getByRole("status")).toContainText("Saved · Illuskian · dark");
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-skin","illuskian");
      currentUser="bob";
      await page.evaluate(()=>(window as any).renderAccount("bob"));
      await expect(page.getByRole("status")).toContainText("Saved · Classic · dark");
      await expect(page.locator("html")).toHaveAttribute("data-skin","classic");
      await page.getByRole("button",{name:"Light",exact:true}).click();
      await expect(page.getByRole("status")).toContainText("Saved · Classic · light");
      currentUser="alice";
      await page.evaluate(()=>(window as any).renderAccount("alice"));
      await expect(page.getByRole("status")).toContainText("Saved · Illuskian · dark");
      await page.getByRole("button",{name:"Reset",exact:true}).click();
      await expect(page.getByRole("status")).toContainText("Saved · Classic · dark");
      assert.deepEqual(errors,[]);
      await page.close();
    }
  } finally {
    await browser.close();server.closeAllConnections();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
});
