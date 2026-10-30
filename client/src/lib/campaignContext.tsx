import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Campaign } from "@shared/schema";

interface CampaignContextValue {
  activeCampaign: Campaign | null;
  setActiveCampaign: (campaign: Campaign | null) => void;
  storageScope: string;
}

const CampaignContext = createContext<CampaignContextValue>({
  activeCampaign: null,
  setActiveCampaign: () => {},
  storageScope: "unavailable",
});

export function CampaignProvider({ children, scope }: { children: ReactNode; scope: string }) {
  const [activeCampaign, setActiveCampaignState] = useState<Campaign | null>(null);
  const key = `fatebound:campaign-selection:${scope}`;
  const selectedByUser = useRef(false);
  const { data: campaigns } = useQuery<Campaign[]>({ queryKey: ["/api/campaigns"] });
  useEffect(() => {
    if (!campaigns) return;
    if (!selectedByUser.current) {
      try {
        const id = Number(sessionStorage.getItem(key));
        setActiveCampaignState(campaigns.find(c => c.id === id) ?? null);
      } catch { /* Selection is optional; account data still comes from the API. */ }
    } else {
      setActiveCampaignState(current => current ? campaigns.find(c => c.id === current.id) ?? null : null);
    }
  }, [campaigns, key]);

  const setActiveCampaign = (campaign: Campaign | null) => {
    selectedByUser.current = true;
    setActiveCampaignState(campaign);
    try {
      if (campaign) sessionStorage.setItem(key, String(campaign.id));
      else sessionStorage.removeItem(key);
    } catch { /* Do not block campaign use when browser storage is unavailable. */ }
  };

  return (
    <CampaignContext.Provider value={{ activeCampaign, setActiveCampaign, storageScope: scope }}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  return useContext(CampaignContext);
}
