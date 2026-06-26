import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Campaign } from "@shared/schema";

interface CampaignContextValue {
  activeCampaign: Campaign | null;
  setActiveCampaign: (campaign: Campaign | null) => void;
}

const CampaignContext = createContext<CampaignContextValue>({
  activeCampaign: null,
  setActiveCampaign: () => {},
});

export function CampaignProvider({ children }: { children: ReactNode }) {
  const [activeCampaign, setActiveCampaignState] = useState<Campaign | null>(() => {
    try {
      const stored = localStorage.getItem("activeCampaign");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setActiveCampaign = (campaign: Campaign | null) => {
    setActiveCampaignState(campaign);
    if (campaign) {
      localStorage.setItem("activeCampaign", JSON.stringify(campaign));
    } else {
      localStorage.removeItem("activeCampaign");
    }
  };

  return (
    <CampaignContext.Provider value={{ activeCampaign, setActiveCampaign }}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  return useContext(CampaignContext);
}
