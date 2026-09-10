import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Quick Tutorials — Crumb',
};

const TUTORIALS: {
  title: string;
  minutes: string;
  steps: string[];
  outcome: string;
  href: string;
  cta: string;
}[] = [
  {
    title: 'Your first order',
    minutes: '2 min',
    steps: [
      'Add your ingredients, then create a recipe from them.',
      'Create a product for the recipe and set its selling price.',
      'Open Orders and add your first customer order.',
      'Press Confirm on the order.',
    ],
    outcome: 'Your order is in the schedule and the forecast fills itself in.',
    href: '/orders?new=1',
    cta: 'Start an order',
  },
  {
    title: 'Know if you are undercharging',
    minutes: '2 min',
    steps: [
      'Make sure each ingredient records a pack size and cost.',
      'Recipes pull packaging, utility, and labour from their cost tab.',
      'Open the Pricing page for your recipes.',
      'Compare your current price with the 30/40/50% shelf suggestions.',
    ],
    outcome: 'A verdict on each recipe: on target, or priced below cost.',
    href: '/pricing',
    cta: 'Open Pricing',
  },
  {
    title: 'Plan tomorrow\u2019s baking',
    minutes: '2 min',
    steps: [
      'Open the Schedule to see what is due tomorrow.',
      'Open Forecast — Crumb totals every ingredient for due orders.',
      'Generate the Shopping List to see what to buy.',
      'Plan production from confirmed orders with one tap.',
    ],
    outcome: 'A shopping list and a production plan for tomorrow, before you wake up.',
    href: '/forecast',
    cta: 'Open the forecast',
  },
  {
    title: 'Baking day',
    minutes: '2 min',
    steps: [
      'Open Floor Mode — big buttons, works with wet hands.',
      'Press Start on the batch you are baking.',
      'When the batch is done, Complete it and adjust what you actually used.',
      'Crumb records the difference between planned and used ingredients.',
    ],
    outcome: 'True ingredient usage recorded — variance and pricing stay honest.',
    href: '/floor',
    cta: 'Open Floor Mode',
  },
  {
    title: 'Accept orders on your website',
    minutes: '2 min',
    steps: [
      'Turn on the Order Portal in Settings.',
      'Copy your public order link and share it on WhatsApp or Instagram.',
      'Customers submit their own orders.',
      'Share each order\u2019s status page so customers can watch it bake.',
    ],
    outcome: 'No more copying orders out of chat messages.',
    href: '/settings',
    cta: 'Enable the portal',
  },
];

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Quick Tutorials
        </h1>
        <p className="text-sm text-muted-foreground">
          Five two-minute walkthroughs — every core workflow, no manual.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {TUTORIALS.map((t, i) => (
          <Card key={t.title} className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>
                  {i + 1}. {t.title}
                </span>
                <span className="text-xs font-normal text-muted-foreground">{t.minutes}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ol className="flex-1 space-y-1.5">
                {t.steps.map((step, j) => (
                  <li key={j} className="flex gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {j + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
                {t.outcome}
              </p>
              <Link
                href={t.href}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary"
              >
                {t.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
