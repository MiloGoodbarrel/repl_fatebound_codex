export const MAX_MODULE_BYTES = 100 * 1024 * 1024;
export const MAX_CAMPAIGN_MODULE_BYTES = 500 * 1024 * 1024;
export const MAX_ACCOUNT_MODULE_BYTES = 2 * 1024 * 1024 * 1024;
export interface ModuleBookmark { id: string; name: string; page: number }
export interface CampaignModule {
  id: string;
  name: string;
  filename: string;
  size: number;
  page: number;
  bookmarks: ModuleBookmark[];
  createdAt: string;
}
