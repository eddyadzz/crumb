'use client';

import { useState, useTransition } from 'react';
import { Loader2, Send, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { submitPortalOrder } from './submit-order';

interface PortalProduct {
  id: string;
  name: string;
  sellingPrice: number;
}

export function OrderPortalForm({
  slug,
  products,
}: {
  slug: string;
  products: PortalProduct[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [productId, setProductId] = useState<string>('');

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await submitPortalOrder(slug, {
        name: formData.get('name') ?? undefined,
        phone: formData.get('phone') ?? undefined,
        productId: productId || undefined,
        quantity: formData.get('quantity') ?? undefined,
        deliveryDate: formData.get('deliveryDate') ?? undefined,
        deliveryTime: formData.get('deliveryTime') ?? undefined,
        message: formData.get('message') ?? undefined,
        company: formData.get('company') ?? undefined,
      });
      if (result.ok) {
        setReference(result.reference);
        setToken(result.token);
      } else setError(result.error);
    });
  };

  if (reference) {
    return (
      <div className="mt-8 rounded-2xl border border-success/40 bg-success/5 p-8 text-center">
        <PartyPopper className="mx-auto mb-3 h-10 w-10 text-success" />
        <p className="font-display text-xl font-bold text-success">Order received!</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you — we&apos;ll confirm your order shortly.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Reference: <span className="font-mono font-bold">{reference}</span>
        </p>
        {token && (
          <Button asChild variant="outline" className="mt-5">
            <a href={`/status/${token}`}>Track your order</a>
          </Button>
        )}
        <Button variant="ghost" className="mt-2 block w-full" onClick={() => setReference(null)}>
          Place another order
        </Button>
      </div>
    );
  }

  return (
    <form
      className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
    >
      <div>
        <h1 className="font-display text-xl font-bold">Place an order</h1>
        <p className="text-sm text-muted-foreground">
          Tell us what you&apos;d like and when you need it — we&apos;ll confirm by phone.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" placeholder="Aisha Ahmed" required maxLength={80} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" name="phone" type="tel" placeholder="+960 777-1234" required maxLength={20} />
      </div>

      <div className="space-y-1.5">
        <Label>What would you like?</Label>
        <Select value={productId} onValueChange={setProductId} required>
          <SelectTrigger>
            <SelectValue placeholder={products.length > 0 ? 'Choose an item' : 'No items available'} />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} — MVR {p.sellingPrice.toFixed(0)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="quantity">How many?</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={500}
            defaultValue={1}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deliveryDate">Delivery date</Label>
          <Input id="deliveryDate" name="deliveryDate" type="date" min={todayStr} required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deliveryTime">Preferred time (optional)</Label>
        <Input id="deliveryTime" name="deliveryTime" placeholder="e.g. morning, 3pm" maxLength={40} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Message (optional)</Label>
        <Textarea
          id="message"
          name="message"
          placeholder="Allergies, custom text on the cake, delivery notes…"
          rows={3}
          maxLength={500}
        />
      </div>

      {/* Honeypot — hidden from humans, catches bots */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="h-12 w-full text-base font-bold" disabled={pending || products.length === 0}>
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
        {pending ? 'Sending…' : 'Send order'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        No account needed — we&apos;ll call to confirm before baking.
      </p>
    </form>
  );
}