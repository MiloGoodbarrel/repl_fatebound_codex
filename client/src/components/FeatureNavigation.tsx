import { Link, useLocation } from "wouter";
import { BookOpen, Compass, Dices, Package, Swords } from "lucide-react";
import { useCampaign } from "@/lib/campaignContext";

const destinations = [
  { href: "/", label: "Campaigns", Icon: Compass },
  { href: "/loot", label: "Loot", Icon: Package },
  { href: "/tables", label: "Roll Tables", Icon: Dices },
  { href: "/initiative", label: "Initiative", Icon: Swords },
  { href: "/sessions", label: "Sessions", Icon: BookOpen },
] as const;

export default function FeatureNavigation() {
  const [location] = useLocation();
  const { activeCampaign } = useCampaign();
  const currentPath = location.split("?")[0];

  return (
    <nav
      aria-label="Campaign tools"
      className="sticky top-0 z-40 border-b border-border/80 bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      <div className="mx-auto flex min-h-14 max-w-screen-2xl items-center gap-3 px-3 sm:px-6">
        <div className="hidden shrink-0 items-center gap-2.5 md:flex">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary"
          >
            <Compass className="size-4" />
          </span>
          <span className="font-display text-sm font-semibold tracking-[0.12em] text-foreground">
            FATEBOUND CODEX
          </span>
        </div>

        <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-center">
          {destinations.map(({ href, label, Icon }) => {
            const isCurrent = currentPath === href;

            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`group relative flex min-h-10 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4 sm:text-sm ${
                    isCurrent
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                  }`}
                >
                  <Icon aria-hidden="true" className="hidden size-4 shrink-0 sm:block" />
                  <span>{label}</span>
                  {isCurrent && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 -bottom-2 h-0.5 rounded-full bg-primary"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div
          aria-label={
            activeCampaign?.name
              ? `Active campaign: ${activeCampaign.name}`
              : "No active campaign"
          }
          className="hidden max-w-48 shrink-0 items-center gap-2 border-l border-border pl-4 lg:flex"
        >
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-primary"
          />
          <span className="truncate text-xs text-muted-foreground">
            {activeCampaign?.name ?? "No campaign selected"}
          </span>
        </div>
      </div>
    </nav>
  );
}
