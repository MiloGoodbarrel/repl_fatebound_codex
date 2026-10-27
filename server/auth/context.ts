import { AsyncLocalStorage } from "node:async_hooks";
import type { Request } from "express";

export type Actor = { userId: string; admin: boolean };
export const actorContext = new AsyncLocalStorage<Actor>();
// Raw-body middleware can resume outside AsyncLocalStorage's event context.
// Keep the verified identity on a server-private map, never on client data.
export const requestActors = new WeakMap<Request, Actor>();
export function currentActor(): Actor {
  const actor = actorContext.getStore();
  if (!actor) throw new Error("Verified account context required.");
  return actor;
}
