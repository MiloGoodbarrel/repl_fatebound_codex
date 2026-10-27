import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {normalizeAppearance} from "../shared/appearance";

test("real account rows persist isolated appearance and preserve campaign ownership",{
  skip:process.env.APPEARANCE_DATABASE_TEST!=="1",
},async()=>{
  const {pool}=await import("../server/db");
  const a=`appearance-test-${randomUUID()}`,b=`appearance-test-${randomUUID()}`;
  const cx=await pool.connect();
  try {
    await cx.query("BEGIN");
    await cx.query("INSERT INTO app_accounts(user_id) VALUES($1),($2)",[a,b]);
    const preference={skin:"illuskian",mode:"light"};
    await cx.query("UPDATE app_accounts SET appearance=$2::jsonb WHERE user_id=$1",[a,JSON.stringify(preference)]);
    const result=await cx.query("SELECT user_id, appearance FROM app_accounts WHERE user_id=ANY($1::text[])",[[a,b]]);
    assert.deepEqual(result.rows.find(r=>r.user_id===a).appearance,preference);
    assert.deepEqual(normalizeAppearance(result.rows.find(r=>r.user_id===b).appearance),{skin:"classic",mode:"dark"});
    assert.equal((await cx.query("SELECT count(*)::int AS count FROM campaigns WHERE owner_user_id=ANY($1::text[])",[[a,b]])).rows[0].count,0);
    await cx.query("UPDATE app_accounts SET appearance=NULL WHERE user_id=$1",[a]);
    assert.deepEqual(normalizeAppearance((await cx.query("SELECT appearance FROM app_accounts WHERE user_id=$1",[a])).rows[0].appearance),{skin:"classic",mode:"dark"});
  } finally {
    await cx.query("ROLLBACK");cx.release();await pool.end();
  }
});
