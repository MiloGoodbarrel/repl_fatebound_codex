import type { Pool } from "pg";
import { pool } from "./db";
import { profileLibraryColumns } from "../shared/creatureProfiles";
import {
  SESSION5_IMPORT_KEY, SESSION5_SOURCE, session5CombatProfiles, session5ReferenceProfiles,
  session5Notes, session5PreparedEncounters,
} from "./data/aetherfallSession5";

/**
 * Authorized, one-time content import into the existing Aetherfall only.
 * DML only: no schema changes, ownership changes, global catalog writes,
 * active encounter writes, party edits, or fabricated session outcomes.
 * Receipt + transaction lock prevent duplicates across restarts/instances.
 */
export async function importAetherfallSession5(database: Pool = pool) {
  const cx = await database.connect();
  try {
    await cx.query("BEGIN");
    await cx.query("SELECT pg_advisory_xact_lock(253148313)");
    if ((await cx.query("SELECT 1 FROM app_setup WHERE key=$1", [SESSION5_IMPORT_KEY])).rowCount) {
      await cx.query("COMMIT");
      return { applied: false, added: 0, updated: 0, encounters: 0 };
    }
    const target = await cx.query(
      "SELECT id FROM campaigns WHERE id=$1 AND name=$2 AND owner_user_id IS NOT NULL FOR UPDATE", [1, "Aetherfall"]);
    const fingerprints = await cx.query(
      "SELECT count(DISTINCT name)::int AS count FROM campaign_homebrew_monsters WHERE campaign_id=$1 AND name=ANY($2::text[])",
      [1, ["Ashborn Goblin", "Ashborn Orc", "Stonebound Peacekeeper"]]);
    if (!target.rowCount || fingerprints.rows[0].count !== 3) {
      await cx.query("COMMIT");
      console.info("[Aetherfall Session 5] Existing campaign identity could not be verified; nothing changed.");
      return { applied: false, added: 0, updated: 0, encounters: 0 };
    }
    let added = 0, updated = 0;
    for (const profile of [...session5CombatProfiles, ...session5ReferenceProfiles]) {
      const existing = await cx.query(
        "SELECT id FROM campaign_homebrew_monsters WHERE campaign_id=$1 AND name=$2 FOR UPDATE", [1, profile.name]);
      // Reference-only prose must never replace an established combat profile.
      if (profile.disposition?.referenceOnly && existing.rowCount) continue;
      if ((existing.rowCount ?? 0) > 1) throw new Error(`Ambiguous existing campaign profile: ${profile.name}`);
      const row = profileLibraryColumns(profile);
      const values = [1, row.name, row.creatureType, row.size, row.alignment, row.armorClass,
        row.printedAverageHp, row.hitDice, row.dexScore, row.challengeRating, JSON.stringify(row.profileData)];
      let id: number;
      if (existing.rowCount) {
        id = existing.rows[0].id;
        await cx.query(`UPDATE campaign_homebrew_monsters SET
          name=$2,creature_type=$3,size=$4,alignment=$5,armor_class=$6,printed_average_hp=$7,
          hit_dice=$8,dex_score=$9,challenge_rating=$10,profile_data=$11::jsonb
          WHERE campaign_id=$1 AND id=$12`, [...values, id]);
        await cx.query("DELETE FROM campaign_homebrew_actions WHERE monster_ref_id=$1", [id]);
        updated++;
      } else {
        const inserted = await cx.query(`INSERT INTO campaign_homebrew_monsters
          (campaign_id,name,creature_type,size,alignment,armor_class,printed_average_hp,hit_dice,dex_score,challenge_rating,profile_data)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) RETURNING id`, values);
        id = inserted.rows[0].id;
        added++;
      }
      for (const [order, action] of Array.from((profile.actions ?? []).entries())) {
        await cx.query(`INSERT INTO campaign_homebrew_actions
          (monster_ref_id,action_order,action_name,action_description,attack_bonus) VALUES ($1,$2,$3,$4,$5)`,
        [id, order, action.name, action.desc, action.attack_bonus ?? null]);
      }
    }
    let encounters = 0;
    for (const encounter of session5PreparedEncounters()) {
      const result = await cx.query(`INSERT INTO campaign_prepared_encounters(campaign_id,name,encounter_data)
        VALUES($1,$2,$3) ON CONFLICT (campaign_id,lower(name)) DO NOTHING RETURNING id`,
      [1, encounter.name, JSON.stringify(encounter.data)]);
      encounters += result.rowCount ?? 0;
    }
    // Fixed unique ID avoids duplicates; it identifies preparation, not a claimed played session.
    const preparationId = "aetherfall-session-5-the-hand-that-feeds-preparation";
    const preparationDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const existingSession = await cx.query("SELECT campaign_id FROM journal_sessions WHERE id=$1", [preparationId]);
    if (existingSession.rowCount && existingSession.rows[0].campaign_id !== 1) {
      throw new Error("Session 5 preparation identity belongs to a different campaign.");
    }
    await cx.query(`INSERT INTO journal_sessions(id,campaign_id,title,date,notes,revision,updated_at)
      VALUES($1,$2,$3,$4,$5,0,$6) ON CONFLICT(id) DO NOTHING`,
    [preparationId, 1, "Session 5 — The Hand That Feeds (DM preparation)", preparationDate,
      session5Notes, new Date().toISOString()]);
    await cx.query("INSERT INTO app_setup(key) VALUES($1)", [SESSION5_IMPORT_KEY]);
    await cx.query("COMMIT");
    console.info(`[Aetherfall Session 5] Added ${added} profiles, updated ${updated}, saved ${encounters} prepared rosters and DM preparation.`);
    return { applied: true, added, updated, encounters, source: SESSION5_SOURCE };
  } catch (error) {
    await cx.query("ROLLBACK");
    throw error;
  } finally { cx.release(); }
}
