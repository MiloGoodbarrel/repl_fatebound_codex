import { sql } from "drizzle-orm";
import { campaignSavedEncounters } from "@shared/schema";

export function encounterRevisionConflictPredicate(saveRevision: number) {
  return sql`COALESCE((${campaignSavedEncounters.encounterData}::jsonb ->> 'saveRevision')::bigint, 0) <= ${saveRevision}`;
}

export function encounterBaseRevisionPredicate(revision: number) {
  return sql`COALESCE((${campaignSavedEncounters.encounterData}::jsonb ->> 'saveRevision')::bigint, 0) = ${revision}`;
}