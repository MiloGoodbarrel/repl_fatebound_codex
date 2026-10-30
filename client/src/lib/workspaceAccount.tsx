import { createContext, useContext } from "react";

export type WorkspaceAccount = {
  demo: boolean;
  email: string;
  signOut: () => Promise<void>;
  deleteLogin: () => Promise<void>;
};
export const WorkspaceAccountContext = createContext<WorkspaceAccount | null>(null);
export function useWorkspaceAccount() {
  const account = useContext(WorkspaceAccountContext);
  if (!account) throw new Error("Workspace account context required.");
  return account;
}
