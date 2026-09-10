'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Plus,
  Users,
  Phone,
  Clock,
  User,
  Loader2,
  ArrowRight,
  Factory,
  Share2,
  Check,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { formatMVR } from '@/lib/costing';
import { createOrder, createCustomer, setOrderStatus, buildPlanFromOrders } from '@/lib/actions/orders';
import { ExportButton } from '@/components/export-button';
import type { OrderStatus } from '@prisma/client';

type OrderVM = {
  id: string;
  status: OrderStatus;
  customerName: string | null;
  totalAmount: number;
  publicToken: string | null;
  deliveryDate: string | null;
  deliveryTime: string | null;
  notes: string | null;
  createdAt: string;
  items: { id: string; productName: string; quantity: number; unitPrice: number }[];
};

type CustomerVM = { id: string; name: string; phone: string | null; email: string | null; notes: string | null; orderCount: number };
type ProductVM = { id: string; name: string; sellingPrice: number; availableQuantity: number };

type LineForm = { productId: string; quantity: string };

const STATUS_META: Record<OrderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  PENDING: { label: 'Pending', variant: 'secondary' },
  CONFIRMED: { label: 'Confirmed', variant: 'default' },
  IN_PRODUCTION: { label: 'In Production', variant: 'default' },
  READY: { label: 'Ready', variant: 'default' },
  DELIVERED: { label: 'Delivered', variant: 'secondary' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

const NEXT_ACTION: Record<OrderStatus, { to: OrderStatus; label: string } | null> = {
  PENDING: { to: 'CONFIRMED', label: 'Confirm' },
  CONFIRMED: { to: 'IN_PRODUCTION', label: 'Start Production' },
  IN_PRODUCTION: { to: 'READY', label: 'Mark Ready' },
  READY: { to: 'DELIVERED', label: 'Mark Delivered' },
  DELIVERED: null,
  CANCELLED: null,
};

export function OrdersClient({
  orders: initialOrders,
  customers: initialCustomers,
  products,
}: {
  orders: OrderVM[];
  customers: CustomerVM[];
  products: ProductVM[];
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [customers, setCustomers] = useState(initialCustomers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const copyStatusLink = async (token: string) => {
    const url = `${window.location.origin}/status/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.open(url, '_blank');
    }
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const nextByDate = [...orders]
    .filter((o) => ['CONFIRMED', 'IN_PRODUCTION', 'READY'].includes(o.status) && o.deliveryDate)
    .sort((a, b) => (a.deliveryDate! < b.deliveryDate! ? -1 : 1))
    .slice(0, 5);

  const advanceStatus = async (id: string, to: OrderStatus) => {
    setBusyId(id);
    await setOrderStatus(id, to);
    setBusyId(null);
    router.refresh();
  };

  const planProduction = async (id: string) => {
    setBusyId(id);
    try {
      const plan = await buildPlanFromOrders([id]);
      const qs = plan.recipeItems.map((r) => `${r.recipeId}:${r.batchCount}`).join(',');
      router.push(`/produce?recipes=${qs}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Orders"
        description="Track customer orders and deliveries"
        action={
          <div className="flex items-center gap-2">
            <ExportButton
              filename="orders"
              label="Export"
              header={['Created', 'Status', 'Customer', 'Items', 'Total MVR', 'Delivery date', 'Delivery time']}
              rows={orders.map((o) => [
                o.createdAt.slice(0, 10),
                STATUS_META[o.status].label,
                o.customerName ?? 'Walk-in',
                o.items.map((i) => `${i.quantity}x ${i.productName}`).join('; '),
                o.totalAmount,
                o.deliveryDate ? o.deliveryDate.slice(0, 10) : '',
                o.deliveryTime ?? '',
              ])}
            />
            <Button className="gap-2" asChild>
              <a href="/orders?new=1">
                <Plus className="h-4 w-4" />
                New Order
              </a>
            </Button>
          </div>
        }
      />

      {nextByDate.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Upcoming Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nextByDate.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.customerName ?? 'Walk-in'} · {new Date(o.deliveryDate!).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    {o.deliveryTime ? ` at ${o.deliveryTime}` : ''}
                  </p>
                </div>
                <Badge variant={STATUS_META[o.status].variant}>{STATUS_META[o.status].label}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="orders">
        <TabsList className="w-full">
          <TabsTrigger value="orders" className="flex-1">Orders</TabsTrigger>
          <TabsTrigger value="customers" className="flex-1">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-3">
          {orders.length === 0 && (
            <Card><CardContent className="py-12 text-center">
              <p className="text-sm font-semibold">Start by adding your first customer order</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Orders flow into the Schedule, Forecast, and Shopping List on their own —
                or share your public order link and let customers submit them.
              </p>
              <a
                href="/orders?new=1"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Add your first order
              </a>
            </CardContent></Card>
          )}
          {orders.map((o) => {
            const next = NEXT_ACTION[o.status];
            return (
              <Card key={o.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">#{(o.id.slice(0, 4)).toUpperCase()} · {o.customerName ?? 'Walk-in'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {o.deliveryDate ? ` · deliver ${new Date(o.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                          {o.deliveryTime ? ` ${o.deliveryTime}` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge variant={STATUS_META[o.status].variant}>{STATUS_META[o.status].label}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {o.items.map((i) => (
                      <div key={i.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{i.quantity}× {i.productName}</span>
                        <span className="text-muted-foreground">{formatMVR(i.quantity * i.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                  {o.notes && <p className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">{o.notes}</p>}
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="font-display text-lg font-bold">{formatMVR(o.totalAmount)}</span>
                  </div>
                  {next && o.status !== 'CANCELLED' && (
                    <div className="flex gap-2">
                      {o.status === 'CONFIRMED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-2"
                          disabled={busyId === o.id}
                          onClick={() => planProduction(o.id)}
                        >
                          {busyId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Factory className="h-4 w-4" />}
                          Plan Production
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="flex-1 gap-2"
                        disabled={busyId === o.id}
                        onClick={() => advanceStatus(o.id, next.to)}
                      >
                        {busyId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                        {next.label}
                      </Button>
                    </div>
                  )}
                  {o.publicToken && o.status !== 'CANCELLED' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full gap-2 text-muted-foreground"
                      onClick={() => copyStatusLink(o.publicToken!)}
                    >
                      {copiedToken === o.publicToken ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Share2 className="h-4 w-4" />
                      )}
                      {copiedToken === o.publicToken ? 'Status link copied' : 'Copy customer status link'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="customers" className="space-y-3">
          <CustomerPanel customers={customers} onCreated={(c) => setCustomers((prev) => [...prev, c])} />
        </TabsContent>
      </Tabs>

      <NewOrderDialog
        customers={customers}
        products={products}
        open={typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1'}
        onOpenChange={(v) => {
          if (!v) router.replace('/orders');
        }}
        onCreated={(o) => {
          setOrders((prev) => [o, ...prev]);
          router.replace('/orders');
          router.refresh();
        }}
      />
    </div>
  );
}

function CustomerPanel({
  customers,
  onCreated,
}: {
  customers: CustomerVM[];
  onCreated: (c: CustomerVM) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransitionShim();

  const save = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const c = await createCustomer({ name, phone, email, notes });
      onCreated({ id: c.id, name: c.name, phone: c.phone, email: c.email, notes: c.notes, orderCount: 0 });
      setName(''); setPhone(''); setEmail(''); setNotes('');
      setOpen(false);
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{customers.length} customer{customers.length === 1 ? '' : 's'}</p>
        <div className="flex items-center gap-2">
          <ExportButton
            filename="customers"
            header={['Name', 'Phone', 'Email', 'Orders', 'Notes']}
            rows={customers.map((c) => [c.name, c.phone ?? '', c.email ?? '', c.orderCount, c.notes ?? ''])}
          />
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {customers.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No customers yet</CardContent></Card>
        )}
        {customers.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {c.phone ? <><Phone className="h-3 w-3" /> {c.phone}</> : 'No phone'}
                    {c.email ? ` · ${c.email}` : ''}
                  </p>
                </div>
              </div>
              <Badge variant="secondary">{c.orderCount} order{c.orderCount === 1 ? '' : 's'}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>Name and phone are most helpful for delivery.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ahmed Ibrahim" className="mt-1" /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+960 7XXX XXXX" className="mt-1" /></div>
            <div><Label>Email (optional)</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" /></div>
            <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={pending || !name.trim()} onClick={save}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function useTransitionShim() {
  const [pending, setPending] = useState(false);
  const startTransition = (fn: () => Promise<void>) => {
    setPending(true);
    fn().finally(() => setPending(false));
  };
  return [pending, startTransition] as const;
}

function NewOrderDialog({
  customers,
  products,
  open,
  onOpenChange,
  onCreated,
}: {
  customers: CustomerVM[];
  products: ProductVM[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (o: OrderVM) => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<LineForm[]>([{ productId: '', quantity: '1' }]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLine = () => setLines((prev) => [...prev, { productId: '', quantity: '1' }]);
  const setLine = (idx: number, patch: Partial<LineForm>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const submit = async () => {
    const parsed = lines
      .filter((l) => l.productId)
      .map((l) => ({ productId: l.productId, quantity: parseInt(l.quantity || '0', 10), unitPrice: 0 }));
    if (parsed.length === 0) { setError('Add at least one product'); return; }
    setError(null);
    setPending(true);
    try {
      const created = await createOrder({
        customerId: customerId || null,
        lines: parsed,
        deliveryDate: deliveryDate || null,
        deliveryTime: deliveryTime || null,
        notes,
      });
      onCreated(created);
      setLines([{ productId: '', quantity: '1' }]);
      setNotes(''); setDeliveryDate(''); setDeliveryTime(''); setCustomerId('');
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create order');
    } finally {
      setPending(false);
    }
  };

  const total = lines.reduce((sum, l) => {
    const p = products.find((x) => x.id === l.productId);
    return sum + (p?.sellingPrice ?? 0) * (parseInt(l.quantity || '0', 10) || 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Customer Order</DialogTitle>
          <DialogDescription>Customer, products and delivery details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select customer (optional)" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Products</Label>
              <Button variant="ghost" size="sm" className="gap-1" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" /> Add line
              </Button>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={line.productId}
                  onValueChange={(v) => setLine(idx, { productId: v })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} · {formatMVR(p.sellingPrice)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={line.quantity}
                  onChange={(e) => setLine(idx, { quantity: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Delivery date</Label>
              <Input type="date" className="mt-1" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div>
              <Label>Delivery time (optional)</Label>
              <Input type="time" className="mt-1" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. birthday cheesecake, blue sugar" />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold">Total</span>
            <span className="font-display text-lg font-bold">{formatMVR(total)}</span>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={pending} onClick={submit}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}