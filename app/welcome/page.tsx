import Link from 'next/link';
import {
  ArrowRight,
  CircleCheck,
  Cookie,
  Factory,
  LineChart,
  ShoppingBasket,
  Store,
  Timer,
} from 'lucide-react';

export const metadata = {
  title: 'Crumb — From Recipe to Profit',
  description:
    'Orders, production, pricing, and profit for home bakers. Built for the kitchen, not the office.',
};

const FEATURES = [
  {
    title: 'Orders & portal',
    body: 'Take orders manually or share your public order link — customers submit and track on their own, no more copying from chat.',
    icon: Store,
  },
  {
    title: 'Baking-day Floor Mode',
    body: 'Big buttons, one screen, no distractions. Records what you actually used against what you planned — works offline.',
    icon: Factory,
  },
  {
    title: 'Shopping lists & forecast',
    body: 'Confirmed orders automatically become an ingredient forecast and a shopping list for tomorrow.',
    icon: ShoppingBasket,
  },
  {
    title: 'Know what to charge',
    body: 'Recipe costing + your real ingredient usage suggests shelf prices — and flags anything selling below cost.',
    icon: Cookie,
  },
  {
    title: 'Profit & variance',
    body: 'Every batch compares planned against actual usage, so profit is a measurement, not a guess.',
    icon: LineChart,
  },
  {
    title: 'Reminders & schedule',
    body: 'A morning briefing of what to bake, buy, and deliver — before the oven warms the kitchen.',
    icon: Timer,
  },
];

const WORKFLOW = [
  'Customer',
  'Order',
  'Schedule',
  'Forecast',
  'Shopping list',
  'Production',
  'Delivery',
];

export default function WelcomePage() {
  return (
    <div className="min-h-dvh bg-background">
      {/* Top bar */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="font-display text-xl font-bold tracking-tight">Crumb</h1>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/sign-in" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-16 text-center sm:py-24">
          <div className="flex h-24 w-24 items-center justify-center">
            {// eslint-disable-next-line @next/next/no-img-element -- brand asset; images are unoptimized (next.config)
              <img
                src="/crumb-logo-256.png"
                alt="Crumb logo"
                className="h-24 w-24 object-contain drop-shadow-sm"
              />}
          </div>
          <div className="max-w-2xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              For home bakers & small bakeries
            </p>
            <h2 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Don&apos;t just manage orders — know whether they&apos;re worth taking.
            </h2>
            <p className="text-base text-muted-foreground sm:text-lg">
              Crumb turns your recipes into real prices, your orders into a baking
              schedule, and every batch into honest numbers — what it cost, what it
              earned, and what to buy tomorrow.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex h-12 w-full max-w-xs items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Start your 14-day free trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline"
              >
                Already baking with Crumb? Sign in
              </Link>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              Free 14-day trial · no card required · your data exports anytime
            </p>
          </div>
        </div>
      </section>

      {/* Workflow strip */}
      <section className="border-y border-border bg-muted/40 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-2 px-4 text-xs font-medium text-muted-foreground sm:text-sm">
          {WORKFLOW.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-primary" />}
              <span className="rounded-full bg-background px-3 py-1 shadow-sm">
                {step}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-3 font-display text-base font-bold">{f.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Built for the day job */}
      <section className="border-y border-border bg-primary/5 py-14">
        <div className="mx-auto max-w-4xl px-4 text-center sm:text-left">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Built for the day job
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">
                Data islands out. One honest system in.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Most home bakers juggle WhatsApps, spreadsheets, paper, and a
                calculator. Crumb replaces the juggling — one place for recipes,
                orders, baking day, and the numbers that decide if you profit.
              </p>
              <ul className="mt-6 grid gap-2 text-sm text-left">
                {[
                  'Installs on the phone in your pocket — works in the kitchen and off the grid',
                  'Every customer gets a live status page for their order',
                  'Your data exports as CSV — it stays yours',
                  'Team members and roles when you grow',
                ].map((line) => (
                  <li key={line} className="flex items-center gap-2">
                    <CircleCheck aria-hidden className="h-5 w-5 shrink-0 text-primary" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-1 flex-col items-center gap-3 rounded-3xl border border-border bg-card p-8 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- brand asset; images are unoptimized (next.config) */}
              <img src="/icons/icon-192.png" alt="Crumb app icon" className="h-20 w-20 rounded-2xl" />
              <p className="font-display text-lg font-bold tracking-tight">Crumb</p>
              <p className="text-xs text-muted-foreground">Installable · works offline</p>
              <Link
                href="/sign-up"
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
              >
                Start baking smarter
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          Stop relying on memory. Start knowing your numbers.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Pricing suggestions, live shopping lists, batch variance, and a customer
          portal — all in one calm dashboard built for your kitchen.
        </p>
        <Link
          href="/sign-up"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
        >
          Start your free trial
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-muted-foreground sm:flex-row">
          <p>Crumb by BoliFlow · © {new Date().getFullYear()}</p>
          <div className="flex items-center gap-4">
            <Link href="/learn" className="hover:text-foreground">
              Quick tutorials
            </Link>
            <Link href="/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:text-foreground">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
