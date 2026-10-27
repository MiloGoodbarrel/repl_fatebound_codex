import { SignIn, SignUp } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { BookOpen, ChevronRight, Compass, Feather, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const clerkAppearance = {
  theme: shadcn,
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(var(--primary))",
    colorForeground: "hsl(var(--foreground))",
    colorMutedForeground: "hsl(var(--muted-foreground))",
    colorDanger: "hsl(var(--destructive))",
    colorBackground: "hsl(var(--card))",
    colorInput: "hsl(var(--input))",
    colorInputForeground: "hsl(var(--foreground))",
    colorNeutral: "hsl(var(--border))",
    fontFamily: "var(--font-body)",
    borderRadius: "0.65rem",
  },
  elements: {
    rootBox: { width: "100%", display: "flex", justifyContent: "center" },
    cardBox: {
      width: "min(100%, 440px)",
      borderRadius: "1rem",
      overflow: "hidden",
      backgroundColor: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      boxShadow: "0 24px 70px hsl(30 30% 5% / 0.35)",
    },
    card: { backgroundColor: "transparent", boxShadow: "none", border: "0" },
    footer: { backgroundColor: "transparent", boxShadow: "none", border: "0" },
    headerTitle: {
      color: "hsl(var(--foreground))",
      fontFamily: "'Cinzel', serif",
      letterSpacing: "0.01em",
    },
    headerSubtitle: { color: "hsl(var(--muted-foreground))" },
    socialButtonsBlockButtonText: { color: "hsl(var(--foreground))", fontWeight: 600 },
    formFieldLabel: { color: "hsl(var(--foreground))", fontWeight: 600 },
    footerActionLink: { color: "hsl(var(--primary))", fontWeight: 700 },
    footerActionText: { color: "hsl(var(--muted-foreground))" },
    dividerText: { color: "hsl(var(--muted-foreground))" },
    identityPreviewEditButton: { color: "hsl(var(--primary))" },
    formFieldSuccessText: { color: "hsl(120 35% 68%)" },
    alertText: { color: "hsl(var(--foreground))" },
    logoBox: { marginBottom: "0.5rem" },
    logoImage: { height: "2.75rem", width: "2.75rem" },
    socialButtonsBlockButton: {
      border: "1px solid hsl(var(--border))",
      backgroundColor: "hsl(var(--background))",
      borderRadius: "0.65rem",
    },
    formButtonPrimary: {
      backgroundColor: "hsl(var(--primary))",
      color: "hsl(var(--primary-foreground))",
      fontWeight: 800,
      borderRadius: "0.65rem",
    },
    formFieldInput: {
      backgroundColor: "hsl(var(--input))",
      color: "hsl(var(--foreground))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "0.6rem",
    },
    footerAction: { borderTop: "1px solid hsl(var(--border))" },
    dividerLine: { backgroundColor: "hsl(var(--border))" },
    alert: { backgroundColor: "hsl(var(--destructive) / .12)", borderRadius: "0.6rem" },
    otpCodeFieldInput: {
      backgroundColor: "hsl(var(--input))",
      color: "hsl(var(--foreground))",
      borderColor: "hsl(var(--border))",
    },
    formFieldRow: { gap: "0.45rem" },
    main: { gap: "1.25rem" },
  },
};

export const clerkLocalization = {
  signIn: {
    start: {
      title: "Return to your table",
      subtitle: "Sign in to open your campaigns and private notes.",
    },
  },
  signUp: {
    start: {
      title: "Begin a new campaign",
      subtitle: "Create an account for your private campaign workspace.",
    },
  },
};

type AuthMode = "sign-in" | "sign-up";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const isSignIn = mode === "sign-in";
  const routePath = `${basePath}/${mode}`;
  const alternatePath = `${basePath}/${isSignIn ? "sign-up" : "sign-in"}`;

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 top-1/4 size-80 rounded-full border border-primary/10" />
        <div className="absolute -left-16 top-[30%] size-56 rounded-full border border-primary/10" />
        <div className="absolute -right-32 bottom-[-5rem] size-[28rem] rounded-full border border-primary/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_18%,hsl(var(--primary)/.09),transparent_52%)]" />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_440px] lg:gap-16">
        <section className="hidden max-w-lg lg:block">
          <Link href="/" className="mb-12 inline-flex items-center gap-3 text-foreground">
            <img src={`${basePath}/logo.svg`} alt="" className="size-11" />
            <span className="font-display text-sm font-bold tracking-[0.16em]">FATEBOUND CODEX</span>
          </Link>
          <p className="mb-4 font-mono text-[0.65rem] uppercase tracking-[0.3em] text-primary">A quiet place for loud adventures</p>
          <h1 className="max-w-md font-display text-4xl font-bold leading-tight text-foreground xl:text-5xl">
            The story is yours to keep.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
            Your campaign records, session journals, and table tools stay together in one private codex.
          </p>
          <div className="mt-10 flex items-center gap-3 border-t border-border/70 pt-6 text-sm text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
            <span>Sign-in verifies your identity. Your campaign belongs to you.</span>
          </div>
        </section>

        <div className="w-full">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2.5 text-foreground">
              <img src={`${basePath}/logo.svg`} alt="" className="size-9" />
              <span className="font-display text-xs font-bold tracking-[0.14em]">FATEBOUND CODEX</span>
            </Link>
            <Link href="/privacy" className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
              Privacy
            </Link>
          </div>
          {isSignIn ? (
            <SignIn
              routing="path"
              path={routePath}
              signUpUrl={alternatePath}
              appearance={clerkAppearance}
            />
          ) : (
            <SignUp
              routing="path"
              path={routePath}
              signInUrl={alternatePath}
              appearance={clerkAppearance}
            />
          )}
          <div className="mx-auto mt-5 flex max-w-[440px] items-center justify-between gap-4 px-1 text-xs text-muted-foreground">
            <Link href="/privacy" className="underline-offset-4 hover:text-primary hover:underline">Privacy & data</Link>
            <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
              Back to the codex <ChevronRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export function PublicLanding() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-3">
          <img src={`${basePath}/logo.svg`} alt="" className="size-10" />
          <span className="font-display text-xs font-bold tracking-[0.15em] sm:text-sm">FATEBOUND CODEX</span>
        </Link>
        <nav aria-label="Account navigation" className="flex items-center gap-2 sm:gap-3">
          <Link href="/privacy" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
            Privacy
          </Link>
          <Link href="/sign-in" className="rounded-md px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/50">
            Sign in
          </Link>
          <Link href="/sign-up" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5">
            Start a codex <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20 lg:grid-cols-[1.05fr_.95fr] lg:gap-8 lg:pb-32">
        <div aria-hidden="true" className="pointer-events-none absolute -right-48 top-0 size-[38rem] rounded-full border border-primary/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 top-20 size-[26rem] rounded-full border border-primary/10" />
        <div className="relative z-10">
          <p className="mb-5 flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.28em] text-primary sm:text-xs">
            <span className="h-px w-8 bg-primary/70" /> For the keeper behind the screen
          </p>
          <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">
            Every world deserves a <span className="text-primary">living record.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Fatebound Codex keeps the moving parts of your table close at hand: campaigns, session journals, loot, roll tables, and initiative.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/sign-up" className="inline-flex min-h-12 items-center gap-3 rounded-md bg-primary px-5 font-bold text-primary-foreground transition-transform hover:-translate-y-0.5">
              Make your first campaign <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/sign-in" className="inline-flex min-h-12 items-center rounded-md border border-border/80 px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-card/60">
              I have an account
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-3 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
            <span>Private workspace. Your campaign is not a public feed.</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
          <div className="absolute -inset-6 rounded-[2rem] border border-primary/10" />
          <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-sm sm:p-7">
            <div className="flex items-center justify-between border-b border-border/70 pb-4">
              <div>
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-primary">Campaign ledger · 01</p>
                <h2 className="mt-1 font-display text-xl font-bold">The Glass March</h2>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-primary">In play</span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-5 py-6">
              <div className="grid size-10 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><BookOpen aria-hidden="true" className="size-4" /></div>
              <div><p className="font-display text-sm font-semibold">Session journal</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A bell beneath the lake. Three names in the captain’s book.</p></div>
              <div className="grid size-10 place-items-center rounded-lg border border-border bg-background/50 text-primary"><Compass aria-hidden="true" className="size-4" /></div>
              <div><p className="font-display text-sm font-semibold">Places & people</p><p className="mt-1 text-xs leading-5 text-muted-foreground">The drowned road, the salt archivist, and what they know.</p></div>
              <div className="grid size-10 place-items-center rounded-lg border border-border bg-background/50 text-primary"><Feather aria-hidden="true" className="size-4" /></div>
              <div><p className="font-display text-sm font-semibold">Table-ready tools</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Loot, chance tables, and initiative, ready when play turns.</p></div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 px-4 py-3">
              <div className="mb-2 flex items-center justify-between text-[0.65rem] font-mono uppercase tracking-wider text-muted-foreground"><span>Next session</span><span className="text-primary">Chapter IV</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-[68%] rounded-full bg-primary" /></div>
            </div>
            <p className="mt-4 text-center font-serif text-xs italic text-muted-foreground">A table has many stories. Keep the threads in reach.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-border/70 bg-card/30">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-[.8fr_1.2fr] md:items-center">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-primary">The useful kind of magic</p>
            <h2 className="mt-3 max-w-sm font-display text-3xl font-bold leading-tight">Less searching. More “what happens next?”</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Keep your campaign notes and session records beside the tools you reach for at the table. Build a durable world without turning game night into admin night.
          </p>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>Fatebound Codex · Made for the next story.</span>
        <div className="flex items-center gap-5">
          <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">Privacy & data</Link>
          <Link href="/sign-up" className="underline-offset-4 hover:text-foreground hover:underline">Create account</Link>
        </div>
      </footer>
    </main>
  );
}

export function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-10 inline-flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <img src={`${basePath}/logo.svg`} alt="" className="size-9" />
          <span className="font-display font-semibold tracking-wide">FATEBOUND CODEX</span>
        </Link>
        <div className="border-b border-border/80 pb-8">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-primary">The small print, plainly spoken</p>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Privacy & your campaign</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            Fatebound Codex is a private workspace for tabletop campaigns. This page describes what the app handles and how you can remove your information.
          </p>
        </div>
        <div className="divide-y divide-border/70">
          <PrivacySection title="Sign-in and identity">
            You can authenticate with Google through Clerk. Google and Clerk are used to verify your identity and manage your sign-in session. Fatebound Codex does not request access to Google Drive or Gmail.
          </PrivacySection>
          <PrivacySection title="Campaign information">
            The application stores campaign and journal text, along with uploaded audio recordings, in its Postgres database. These materials are private to your workspace and are used to provide the campaign tools you choose to use.
          </PrivacySection>
          <PrivacySection title="Audio recordings">
            Uploaded recordings are not automatically transcribed or shared. The app does not send them to other users as a public feed.
          </PrivacySection>
          <PrivacySection title="Removing your data">
            You can delete individual campaigns from the campaign interface. In Settings, you can delete all workspace data, or delete both your workspace data and your Clerk login account. This includes journal text and uploaded recordings. Deleting a Google account is separate and must be done through Google; it does not itself run the campaign-data deletion workflow.
          </PrivacySection>
          <PrivacySection title="Questions">
            For help with your workspace, use the app’s account or settings controls. Do not add sensitive information to a campaign unless you are comfortable storing it in this service.
          </PrivacySection>
        </div>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/sign-up" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground hover:-translate-y-0.5">
            Create an account <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
          <Link href="/" className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:border-primary/40">
            Back to the codex
          </Link>
        </div>
      </div>
    </main>
  );
}

function PrivacySection({ title, children }: { title: string; children: string }) {
  return (
    <section className="grid gap-2 py-6 sm:grid-cols-[180px_1fr] sm:gap-8">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <p className="text-sm leading-7 text-muted-foreground">{children}</p>
    </section>
  );
}
