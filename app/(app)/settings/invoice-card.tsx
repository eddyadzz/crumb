'use client';

import { useState, useTransition } from 'react';
import { Loader2, Landmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { setInvoiceDetails } from '@/lib/actions/invoices';

export function InvoiceCard({ details }: { details: string | null }) {
  const [text, setText] = useState(details ?? '');
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      try {
        const next = await setInvoiceDetails(text);
        setText(next);
        setSaved(next);
        setTimeout(() => setSaved(null), 2000);
      } catch {
        // leave the field as-is on failure
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-5 w-5 text-muted-foreground" />
          Invoice payment details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          This is what customers see on invoice emails when you send an invoice
          or deliver an order — bank name, account number, phone, whatever they
          need to pay you.
        </p>
        <Textarea
          placeholder={
            'e.g.\nBML Savings • 7771234567890\nAhmed Bakr\nPhone: 771 2345'
          }
          className="min-h-[100px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
          {saved !== null && !pending && (
            <p className="text-xs text-success">Saved</p>
          )}
          {pending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
