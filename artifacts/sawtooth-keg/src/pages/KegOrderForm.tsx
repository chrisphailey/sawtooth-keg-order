import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListBeers,
  useAuthorizePayment,
  useCreateOrder,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Loader2 } from "lucide-react";

const POURING_OPTIONS = [
  { label: "My own equipment", fee: 0 },
  { label: "Hand Pump Party Tap rental ($10 rental)", fee: 10 },
  { label: "CO2 Party Tap rental ($10 rental + $10 CO2 fee)", fee: 20 },
  { label: "Jockey Box ($20 rental + $10 CO2 fee) Limited Supply", fee: 30 },
  { label: "Draft Trailer Rental ($125/day + $10 a mile both directions)", fee: 125 },
] as const;

const schema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.string().email("Valid email required"),
  customerPhone: z.string().min(7, "Phone number required"),
  returnDate: z.string().min(1, "Return date required"),
  pickupDate: z.string().min(1, "Pickup date required"),
  pickupTime: z.string().min(1, "Pickup time required"),
  beerId: z.coerce.number().min(1, "Select a beer"),
  quantity: z.coerce.number().min(1).max(10),
  pouringMethod: z.string().min(1, "Select how you will pour the beer"),
  notes: z.string().optional(),
  cardNumber: z.string().min(13, "Card number required").max(19),
  cardExp: z.string().regex(/^\d{2}\/\d{2}$/, "Format: MM/YY"),
  cardCvv: z.string().min(3, "CVV required").max(4),
});

type FormValues = z.infer<typeof schema>;

export default function KegOrderForm() {
  const [submitted, setSubmitted] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState<{ id: number; customerName: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const beers = useListBeers({ availableOnly: true });
  const authorizePayment = useAuthorizePayment();
  const createOrder = useCreateOrder();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      returnDate: "",
      pickupDate: "",
      pickupTime: "12:00",
      beerId: 0,
      quantity: 1,
      pouringMethod: "",
      notes: "",
      cardNumber: "",
      cardExp: "",
      cardCvv: "",
    },
  });

  const selectedBeerId = form.watch("beerId");
  const quantity = form.watch("quantity");
  const pouringMethod = form.watch("pouringMethod");
  const selectedBeer = beers.data?.find((b) => b.id === Number(selectedBeerId));
  const selectedPouring = POURING_OPTIONS.find((o) => o.label === pouringMethod);
  const beerTotal = selectedBeer ? Number(selectedBeer.price) * quantity : 0;
  const rentalFee = selectedPouring?.fee ?? 0;
  const depositAmount = 30;
  const total = beerTotal + depositAmount + rentalFee;

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    const idempotencyKey = crypto.randomUUID();
    const amountCents = Math.round(total * 100);

    try {
      const auth = await new Promise<{ cloverPaymentId: string; idempotencyKey: string }>((resolve, reject) => {
        authorizePayment.mutate(
          { data: { amount: amountCents, source: `tok_mock_${Date.now()}`, idempotencyKey } },
          {
            onSuccess: (data) => resolve({ cloverPaymentId: data.cloverPaymentId, idempotencyKey: data.idempotencyKey }),
            onError: (err) => reject(err),
          }
        );
      });

      await new Promise<void>((resolve, reject) => {
        createOrder.mutate(
          {
            data: {
              customerName: values.customerName,
              customerEmail: values.customerEmail,
              customerPhone: values.customerPhone,
              pickupDate: values.pickupDate,
              pickupTime: values.pickupTime,
              beerId: Number(values.beerId),
              quantity: values.quantity,
              pouringMethod: values.pouringMethod,
              notes: values.notes || null,
              cloverPaymentToken: auth.cloverPaymentId,
              idempotencyKey: auth.idempotencyKey,
            },
          },
          {
            onSuccess: (order) => {
              setOrderConfirmation({ id: order.id, customerName: order.customerName });
              setSubmitted(true);
              resolve();
            },
            onError: (err) => reject(err),
          }
        );
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed. Please try again.";
      setSubmitError(msg);
    }
  };

  if (submitted && orderConfirmation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center" data-testid="card-order-confirmation">
          <CardContent className="pt-10 pb-8 flex flex-col items-center gap-4">
            <CheckCircle className="h-14 w-14 text-primary" />
            <h2 className="text-2xl font-bold font-serif">Order Received!</h2>
            <p className="text-muted-foreground">
              Thank you, <strong>{orderConfirmation.customerName}</strong>. Your keg order #{orderConfirmation.id} has been submitted. We'll reach out to confirm your pickup.
            </p>
            <p className="text-sm text-muted-foreground border-t pt-4 w-full">
              A $30 deposit has been pre-authorized. It will be captured when we confirm your order.
            </p>
            <Button
              variant="outline"
              onClick={() => { setSubmitted(false); form.reset(); }}
              data-testid="button-order-another"
            >
              Place Another Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold font-serif text-foreground">Reserve a Keg</h1>
          <p className="mt-2 text-muted-foreground">Fill out the form below to request a keg pickup from Sawtooth Brewery.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Contact */}
            <Card>
              <CardHeader><CardTitle className="text-base">Your Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="customerName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="Jane Smith" {...field} data-testid="input-customer-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="customerEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="jane@example.com" {...field} data-testid="input-customer-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="customerPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input type="tel" placeholder="(208) 555-0123" {...field} data-testid="input-customer-phone" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* Keg */}
            <Card>
              <CardHeader><CardTitle className="text-base">Keg Selection</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {beers.isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading beers...</div>
                ) : (
                  <FormField control={form.control} name="beerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beer / Keg Style</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ? String(field.value) : ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-beer">
                            <SelectValue placeholder="Select a beer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {beers.data?.map((beer) => (
                            <SelectItem key={beer.id} value={String(beer.id)} data-testid={`option-beer-${beer.id}`}>
                              {beer.name} — {beer.kegSize} (${Number(beer.price).toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl><Input type="number" min={1} max={10} {...field} data-testid="input-quantity" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Pickup & Return */}
            <Card>
              <CardHeader><CardTitle className="text-base">Pickup & Return</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="pickupDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Date</FormLabel>
                      <FormControl><Input type="date" {...field} min={new Date().toISOString().slice(0, 10)} data-testid="input-pickup-date" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="pickupTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Time</FormLabel>
                      <FormControl><Input type="time" {...field} data-testid="input-pickup-time" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="returnDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>When will you return the keg and equipment?</FormLabel>
                    <FormControl><Input type="date" {...field} min={new Date().toISOString().slice(0, 10)} data-testid="input-return-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Pouring method */}
            <Card>
              <CardHeader><CardTitle className="text-base">How will you pour the beer?</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="pouringMethod" render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-pouring-method">
                          <SelectValue placeholder="Choose" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {POURING_OPTIONS.map((opt) => (
                          <SelectItem key={opt.label} value={opt.label} data-testid={`option-pouring-${opt.label.split(" ")[0].toLowerCase()}`}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {rentalFee > 0 && (
                  <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                    Rental fee of <strong>${rentalFee.toFixed(2)}</strong> will be added to your pre-authorization.
                  </p>
                )}

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Notes (optional)</FormLabel>
                    <FormControl><Textarea rows={2} placeholder="Any special requests or notes..." {...field} data-testid="textarea-notes" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Payment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment</CardTitle>
                <CardDescription>A $30 deposit is required to hold your order. Your card will be pre-authorized and charged only when the brewery confirms your order.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="cardNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Card Number</FormLabel>
                    <FormControl><Input placeholder="1234 5678 9012 3456" maxLength={19} {...field} data-testid="input-card-number" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="cardExp" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration</FormLabel>
                      <FormControl><Input placeholder="MM/YY" maxLength={5} {...field} data-testid="input-card-exp" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cardCvv" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CVV</FormLabel>
                      <FormControl><Input placeholder="123" maxLength={4} {...field} data-testid="input-card-cvv" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Separator />
                <div className="space-y-1 text-sm">
                  {selectedBeer && (
                    <div className="flex justify-between">
                      <span>{selectedBeer.name} — {selectedBeer.kegSize} × {quantity}</span>
                      <span>${beerTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {rentalFee > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Equipment rental</span>
                      <span>${rentalFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Deposit (refundable)</span>
                    <span>${depositAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1 border-t">
                    <span>Pre-authorization total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {submitError && (
              <div className="text-destructive text-sm p-3 border border-destructive/30 rounded-lg bg-destructive/5" data-testid="text-submit-error">
                {submitError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={form.formState.isSubmitting || authorizePayment.isPending || createOrder.isPending}
              data-testid="button-submit-order"
            >
              {form.formState.isSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                `Submit Order & Pre-Authorize $${total.toFixed(2)}`
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
