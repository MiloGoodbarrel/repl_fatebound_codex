import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import type { CampaignModule, ModuleBookmark } from "../../shared/modules";
import { MAX_ACCOUNT_MODULE_BYTES, MAX_CAMPAIGN_MODULE_BYTES } from "../../shared/modules";

export interface ModuleRow extends CampaignModule { objectKey: string; status: string }
export class ModuleError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
const row = (r: any): ModuleRow => ({
  id: r.id, name: r.name, filename: r.filename, size: r.size, page: r.page,
  bookmarks: r.bookmarks, createdAt: new Date(r.created_at).toISOString(),
  objectKey: r.object_key, status: r.status,
});
export class ModuleRepository {
  constructor(private pool: Pool) {}
  async list(campaign: number, owner: string) {
    const [modules, selection] = await Promise.all([
      this.pool.query("SELECT * FROM campaign_modules WHERE campaign_id=$1 AND owner_user_id=$2 AND status='ready' ORDER BY created_at DESC", [campaign, owner]),
      this.pool.query(`SELECT s.module_id FROM campaign_module_selection s JOIN campaign_modules m ON m.id=s.module_id
        WHERE s.campaign_id=$1 AND m.campaign_id=$1 AND m.owner_user_id=$2 AND m.status='ready'`, [campaign, owner]),
    ]);
    return { modules: modules.rows.map(row), selectedId: selection.rows[0]?.module_id ?? null };
  }
  async get(campaign: number, owner: string, id: string) {
    const value = await this.pool.query("SELECT * FROM campaign_modules WHERE campaign_id=$1 AND owner_user_id=$2 AND id=$3 AND status='ready'", [campaign, owner, id]);
    if (!value.rows[0]) throw new ModuleError(404, "Module not found in this campaign.");
    return row(value.rows[0]);
  }
  async reserve(campaign: number, owner: string, filename: string, size: number) {
    const cx = await this.pool.connect();
    try {
      await cx.query("BEGIN");
      await cx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`module-quota:${owner}`]);
      const permission = await cx.query("SELECT id FROM campaigns WHERE id=$1 AND owner_user_id=$2 FOR SHARE", [campaign, owner]);
      if (!permission.rowCount) throw new ModuleError(404, "Campaign no longer available.");
      const totals = await cx.query(`SELECT coalesce(sum(size),0)::bigint AS account,
        coalesce(sum(size) FILTER (WHERE campaign_id=$2),0)::bigint AS campaign
        FROM campaign_modules WHERE owner_user_id=$1`, [owner, campaign]);
      if (Number(totals.rows[0].account) + size > MAX_ACCOUNT_MODULE_BYTES ||
          Number(totals.rows[0].campaign) + size > MAX_CAMPAIGN_MODULE_BYTES)
        throw new ModuleError(413, "Module storage limit reached (500 MiB per campaign, 2 GiB per account). Delete an unused module first.");
      const id = randomUUID(), key = `campaign-modules/${id}.pdf`;
      const result = await cx.query(`INSERT INTO campaign_modules(id,campaign_id,owner_user_id,object_key,name,filename,size)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [id, campaign, owner, key, filename.replace(/\.pdf$/i, ""), filename, size]);
      await cx.query("COMMIT");
      return row(result.rows[0]);
    } catch (error) { await cx.query("ROLLBACK"); throw error; }
    finally { cx.release(); }
  }
  async ready(campaign: number, owner: string, id: string) {
    const result = await this.pool.query(`UPDATE campaign_modules m SET status='ready' WHERE id=$1 AND campaign_id=$2 AND owner_user_id=$3 AND status='pending'
      AND EXISTS(SELECT 1 FROM campaigns WHERE id=$2 AND owner_user_id=$3) RETURNING *`, [id, campaign, owner]);
    if (!result.rows[0]) throw new ModuleError(409, "The campaign changed during upload. Choose the file again.");
    return row(result.rows[0]);
  }
  async select(campaign: number, owner: string, id: string | null) {
    if (id) await this.get(campaign, owner, id);
    await this.pool.query(`INSERT INTO campaign_module_selection(campaign_id,module_id) VALUES($1,$2)
      ON CONFLICT(campaign_id) DO UPDATE SET module_id=EXCLUDED.module_id`, [campaign, id]);
  }
  async update(campaign: number, owner: string, id: string, values: { name?: string; page?: number; bookmarks?: ModuleBookmark[] }) {
    await this.get(campaign, owner, id);
    await this.pool.query(`UPDATE campaign_modules SET name=coalesce($4,name),page=coalesce($5,page),bookmarks=coalesce($6::jsonb,bookmarks)
      WHERE campaign_id=$1 AND owner_user_id=$2 AND id=$3 AND status='ready'`,
    [campaign, owner, id, values.name ?? null, values.page ?? null, values.bookmarks ? JSON.stringify(values.bookmarks) : null]);
    return this.get(campaign, owner, id);
  }
  async tombstone(id: string) { await this.pool.query("UPDATE campaign_modules SET status='deleting' WHERE id=$1", [id]); }
  async remove(id: string) { await this.pool.query("DELETE FROM campaign_modules WHERE id=$1 AND status='deleting'", [id]); }
  async abandoned() {
    const result = await this.pool.query(`UPDATE campaign_modules SET status='deleting'
      WHERE campaign_id IS NULL OR status='deleting' OR (status='pending' AND created_at < now()-interval '1 hour')
      RETURNING *`);
    return result.rows.map(row);
  }
}
