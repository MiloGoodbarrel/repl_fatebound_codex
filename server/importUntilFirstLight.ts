import { pool } from "./db";
import { profileLibraryColumns } from "../shared/creatureProfiles";
import { untilFirstLightProfiles, UNTIL_FIRST_LIGHT_SOURCE } from "./data/untilFirstLight";

const importKey = "campaign-content:until-first-light:aetherfall";
/**
 * One-time additive import into the existing, verified legacy Aetherfall only.
 * A durable receipt means an explicit later Clear stays cleared across restarts.
 * No new campaigns, ownership changes, global bestiary rows or encounters.
 */
export async function importUntilFirstLight() {
  const cx = await pool.connect();
  try {
    await cx.query("BEGIN");
    await cx.query("SELECT pg_advisory_xact_lock(253148312)");
    const done = await cx.query("SELECT 1 FROM app_setup WHERE key=$1", [importKey]);
    if (done.rowCount) { await cx.query("COMMIT"); return 0; }
    const target = await cx.query("SELECT id FROM campaigns WHERE id=$1 AND name=$2 AND owner_user_id IS NOT NULL FOR UPDATE", [1, "Aetherfall"]);
    const fingerprints = await cx.query("SELECT count(DISTINCT name)::int AS count FROM campaign_homebrew_monsters WHERE campaign_id=$1 AND name=ANY($2::text[])", [1, ["Ashborn Goblin", "Ashborn Orc", "Stonebound Peacekeeper"]]);
    if (!target.rowCount || fingerprints.rows[0].count !== 3) {
      await cx.query("COMMIT");
      console.info("[Until First Light] Import not applied: existing Aetherfall target could not be verified.");
      return 0;
    }
    let added = 0;
    for (const profile of untilFirstLightProfiles) {
      const exists = await cx.query("SELECT id FROM campaign_homebrew_monsters WHERE campaign_id=$1 AND profile_data->>'source'=$2 AND profile_data->>'index'=$3", [1, UNTIL_FIRST_LIGHT_SOURCE, profile.index]);
      if (exists.rowCount) continue;
      const row = profileLibraryColumns(profile);
      const inserted = await cx.query(
        "INSERT INTO campaign_homebrew_monsters (campaign_id,name,creature_type,size,alignment,armor_class,printed_average_hp,hit_dice,dex_score,challenge_rating,profile_data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) RETURNING id",
        [1, row.name, row.creatureType, row.size, row.alignment, row.armorClass, row.printedAverageHp, row.hitDice, row.dexScore, row.challengeRating, JSON.stringify(row.profileData)],
      );
      for (const [order, action] of Array.from((profile.actions ?? []).entries())) {
        await cx.query("INSERT INTO campaign_homebrew_actions (monster_ref_id,action_order,action_name,action_description,attack_bonus) VALUES ($1,$2,$3,$4,$5)", [inserted.rows[0].id, order, action.name, action.desc, action.attack_bonus ?? null]);
      }
      added++;
    }
    await cx.query("INSERT INTO app_setup(key) VALUES($1)", [importKey]);
    await cx.query("COMMIT");
    console.info(`[Until First Light] Added ${added} profiles to the existing Aetherfall homebrew bestiary.`);
    return added;
  } catch (error) {
    await cx.query("ROLLBACK");
    throw error;
  } finally { cx.release(); }
}
