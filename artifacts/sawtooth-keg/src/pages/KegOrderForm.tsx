import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListBeers,
  useAuthorizePayment,
  useCreateOrder,
  useSubmitCustomerReceipt,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/SignaturePad";
import { CheckCircle, Loader2, FileText, PlusCircle, Trash2 } from "lucide-react";

const POURING_OPTIONS = [
  { label: "My own equipment", fee: 0 },
  { label: "Hand Pump Party Tap rental ($10 rental)", fee: 10 },
  { label: "CO2 Party Tap rental ($10 rental + $10 CO2 fee)", fee: 20 },
  { label: "Jockey Box ($20 rental + $10 CO2 fee) Limited Supply", fee: 30 },
  { label: "Draft Trailer Rental ($125/day + $10 a mile both directions)", fee: 125 },
] as const;

const DEPOSIT_PER_KEG = 30;

interface KegLineItem {
  beerId: number;
  quantity: number;
}

const orderSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.string().email("Valid email required"),
  customerPhone: z.string().min(7, "Phone number required"),
  returnDate: z.string().min(1, "Return date required"),
  pickupDate: z.string().min(1, "Pickup date required"),
  pickupTime: z.string().min(1, "Pickup time required"),
  pouringMethod: z.string().min(1, "Select how you will pour the beer"),
  notes: z.string().optional(),
  cardNumber: z.string().min(13, "Card number required").max(19),
  cardExp: z.string().regex(/^\d{2}\/\d{2}$/, "Format: MM/YY"),
  cardCvv: z.string().min(3, "CVV required").max(4),
});
type OrderFormValues = z.infer<typeof orderSchema>;

const ispSchema = z.object({
  purchaserDob: z.string().min(1, "Date of birth is required"),
  consumptionLocation: z.string().min(1, "Consumption location is required"),
  consumptionDate: z.string().optional(),
  consumptionTime: z.string().optional(),
  validIdNumber: z.string().min(1, "Valid ID number is required"),
  vehicleYear: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleColor: z.string().optional(),
  vehiclePlate: z.string().optional(),
  agreeToTerms: z.boolean().refine((v) => v === true, "You must certify this statement"),
});
type IspFormValues = z.infer<typeof ispSchema>;

interface OrderConfirmationItem {
  beerName: string;
  kegSize: string;
  quantity: number;
  unitPrice: number;
}

interface OrderConfirmation {
  id: number;
  customerToken: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupDate: string;
  pickupTime: string;
  items: OrderConfirmationItem[];
  pouringMethod: string;
  totalAmount: number;
  depositAmount: number;
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex flex-col items-center gap-2 mb-6">
      <p className="text-xs text-muted-foreground font-medium">Step {step} of 2</p>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 text-sm font-medium ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>1</span>
          Keg Order
        </div>
        <div className={`h-px w-8 ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        <div className={`flex items-center gap-2 text-sm font-medium ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>2</span>
          State Form
        </div>
      </div>
    </div>
  );
}

export default function KegOrderForm() {
  const [step, setStep] = useState<1 | 2 | "done">(1);
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ispError, setIspError] = useState<string | null>(null);
  const [kegItems, setKegItems] = useState<KegLineItem[]>([{ beerId: 0, quantity: 1 }]);
  const [kegItemsError, setKegItemsError] = useState<string | null>(null);

  const beers = useListBeers({ availableOnly: true });
  const authorizePayment = useAuthorizePayment();
  const createOrder = useCreateOrder();
  const submitCustomerReceipt = useSubmitCustomerReceipt();

  const orderForm = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      returnDate: "",
      pickupDate: "",
      pickupTime: "12:00",
      pouringMethod: "",
      notes: "",
      cardNumber: "",
      cardExp: "",
      cardCvv: "",
    },
  });

  const ispForm = useForm<IspFormValues>({
    resolver: zodResolver(ispSchema),
    defaultValues: {
      purchaserDob: "",
      consumptionLocation: "",
      consumptionDate: "",
      consumptionTime: "",
      validIdNumber: "",
      vehicleYear: "",
      vehicleMake: "",
      vehicleColor: "",
      vehiclePlate: "",
      agreeToTerms: false,
    },
  });

  const pouringMethod = orderForm.watch("pouringMethod");
  const selectedPouring = POURING_OPTIONS.find((o) => o.label === pouringMethod);
  const rentalFee = selectedPouring?.fee ?? 0;

  const beerMap = new Map((beers.data ?? []).map((b) => [b.id, b]));

  // Compute totals from keg items
  const beerTotal = kegItems.reduce((sum, item) => {
    const beer = beerMap.get(item.beerId);
    if (!beer || item.beerId === 0) return sum;
    return sum + Number(beer.price) * item.quantity;
  }, 0);
  const totalKegCount = kegItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const depositAmount = DEPOSIT_PER_KEG * totalKegCount;
  const total = beerTotal + depositAmount + rentalFee;

  const updateKegItem = (index: number, field: keyof KegLineItem, value: number) => {
    setKegItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    setKegItemsError(null);
  };

  const addKegItem = () => {
    setKegItems((prev) => [...prev, { beerId: 0, quantity: 1 }]);
  };

  const removeKegItem = (index: number) => {
    setKegItems((prev) => prev.filter((_, i) => i !== index));
  };

  const validateKegItems = (): boolean => {
    if (kegItems.length === 0) {
      setKegItemsError("Add at least one keg to your order.");
      return false;
    }
    for (const item of kegItems) {
      if (!item.beerId || item.beerId === 0) {
        setKegItemsError("Please select a beer for each keg row.");
        return false;
      }
      if (!item.quantity || item.quantity < 1) {
        setKegItemsError("Each keg must have a quantity of at least 1.");
        return false;
      }
    }
    return true;
  };

  const onOrderSubmit = async (values: OrderFormValues) => {
    if (!validateKegItems()) return;
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
              items: kegItems.map((item) => ({ beerId: item.beerId, quantity: item.quantity })),
              pouringMethod: values.pouringMethod,
              notes: values.notes || null,
              cloverPaymentToken: auth.cloverPaymentId,
              idempotencyKey: auth.idempotencyKey,
            },
          },
          {
            onSuccess: (order) => {
              const confirmationItems: OrderConfirmationItem[] = (order.items ?? []).map((i) => ({
                beerName: i.beerName,
                kegSize: i.kegSize,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
              }));
              setOrderConfirmation({
                id: order.id,
                customerToken: order.customerToken,
                customerName: order.customerName,
                customerEmail: order.customerEmail,
                customerPhone: order.customerPhone,
                pickupDate: order.pickupDate,
                pickupTime: order.pickupTime,
                items: confirmationItems,
                pouringMethod: order.pouringMethod,
                totalAmount: order.totalAmount,
                depositAmount: order.depositAmount,
              });
              ispForm.setValue("consumptionDate", order.pickupDate);
              setStep(2);
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

  const onIspSubmit = async (values: IspFormValues) => {
    if (!orderConfirmation) return;
    setIspError(null);

    if (!signature) {
      setIspError("A signature is required to complete the state form.");
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        submitCustomerReceipt.mutate(
          {
            id: orderConfirmation.id,
            data: {
              customerToken: orderConfirmation.customerToken,
              purchaserDob: values.purchaserDob,
              consumptionLocation: values.consumptionLocation,
              consumptionDate: values.consumptionDate || null,
              consumptionTime: values.consumptionTime || null,
              validIdNumber: values.validIdNumber,
              vehicleYear: values.vehicleYear || null,
              vehicleMake: values.vehicleMake || null,
              vehicleColor: values.vehicleColor || null,
              vehiclePlate: values.vehiclePlate || null,
              customerSignature: signature,
              signedAt: new Date().toISOString(),
            },
          },
          {
            onSuccess: () => { setStep("done"); resolve(); },
            onError: (err) => reject(err),
          }
        );
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit form. Please try again.";
      setIspError(msg);
    }
  };

  if (step === "done" && orderConfirmation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center" data-testid="card-order-confirmation">
          <CardContent className="pt-10 pb-8 flex flex-col items-center gap-4">
            <CheckCircle className="h-14 w-14 text-primary" />
            <h2 className="text-2xl font-bold font-serif">{"You're All Set!"}</h2>
            <p className="text-muted-foreground">
              Thank you, <strong>{orderConfirmation.customerName}</strong>. Your keg order #{orderConfirmation.id} has been submitted and the Idaho state form is on file.
            </p>
            <p className="text-sm text-muted-foreground">
              A confirmation email has been sent to <strong>{orderConfirmation.customerEmail}</strong>. {"We'll reach out to confirm your pickup."}
            </p>
            <p className="text-sm text-muted-foreground border-t pt-4 w-full">
              A ${orderConfirmation.depositAmount.toFixed(2)} deposit has been pre-authorized. It will be captured when we confirm your order.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setStep(1);
                setOrderConfirmation(null);
                setSignature(null);
                setKegItems([{ beerId: 0, quantity: 1 }]);
                orderForm.reset();
                ispForm.reset();
              }}
              data-testid="button-order-another"
            >
              Place Another Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 2 && orderConfirmation) {
    return (
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold font-serif text-foreground">Idaho Keg Receipt</h1>
            <p className="mt-2 text-muted-foreground">Idaho State Police require this form for all keg purchases.</p>
          </div>

          <StepIndicator step={2} />

          <Card className="mb-4 border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Order #{orderConfirmation.id} received!</p>
                  {orderConfirmation.items.map((item, i) => (
                    <p key={i} className="text-sm text-muted-foreground mt-0.5">
                      {item.beerName} — {item.kegSize} × {item.quantity}
                    </p>
                  ))}
                  <p className="text-xs text-muted-foreground mt-1">
                    Pickup {orderConfirmation.pickupDate} at {orderConfirmation.pickupTime}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Form {...ispForm}>
            <form onSubmit={ispForm.handleSubmit(onIspSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Trade Name: Sawtooth Brewery</CardTitle>
                  <CardDescription className="text-xs">Receipt for Sale of Beer in Kegs to Unlicensed Group or Individual</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Purchaser Name</p>
                    <p className="text-sm font-medium">{orderConfirmation.customerName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Phone</p>
                    <p className="text-sm font-medium">{orderConfirmation.customerPhone}</p>
                  </div>
                  <FormField control={ispForm.control} name="purchaserDob" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">Date of Birth</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-purchaser-dob" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={ispForm.control} name="validIdNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">Valid ID Number</FormLabel>
                      <FormControl><Input placeholder="Driver's license or ID #" {...field} data-testid="input-valid-id" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Consumption Location</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <FormField control={ispForm.control} name="consumptionLocation" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">Address / Location</FormLabel>
                      <FormControl><Input placeholder="Where will the keg be consumed?" {...field} data-testid="input-consumption-location" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={ispForm.control} name="consumptionDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">Date</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-consumption-date" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={ispForm.control} name="consumptionTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">Time</FormLabel>
                      <FormControl><Input type="time" {...field} data-testid="input-consumption-time" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Vehicle Information</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <FormField control={ispForm.control} name="vehicleYear" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">Year</FormLabel>
                      <FormControl><Input placeholder="2024" {...field} data-testid="input-vehicle-year" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={ispForm.control} name="vehicleMake" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">Make</FormLabel>
                      <FormControl><Input placeholder="Ford" {...field} data-testid="input-vehicle-make" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={ispForm.control} name="vehicleColor" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">Color</FormLabel>
                      <FormControl><Input placeholder="Blue" {...field} data-testid="input-vehicle-color" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={ispForm.control} name="vehiclePlate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">License Plate</FormLabel>
                      <FormControl><Input placeholder="1A2B3C4" {...field} data-testid="input-vehicle-plate" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Customer Certification &amp; Signature</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground italic">
                    "I certify that the keg(s) rented/sold by the above firm has/have been used for personal use and not for resale, and that I have read and agree to all requirements as stated on the reverse side of this form."
                  </p>
                  <p className="text-xs font-bold text-destructive uppercase tracking-wide">
                    ILLEGAL RESALE OF THIS PRODUCT IS A VIOLATION OF IDAHO STATE LAW
                  </p>

                  <FormField control={ispForm.control} name="agreeToTerms" render={({ field }) => (
                    <FormItem className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-agree-terms"
                        />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel className="font-normal text-sm leading-snug">
                          I certify the above statement and agree that this keg will not be resold.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )} />

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Signature <span className="text-destructive">*</span></p>
                    <SignaturePad
                      onSave={(dataUrl) => setSignature(dataUrl)}
                      onClear={() => setSignature(null)}
                    />
                  </div>
                </CardContent>
              </Card>

              {ispError && (
                <div className="text-destructive text-sm p-3 border border-destructive/30 rounded-lg bg-destructive/5" data-testid="text-isp-error">
                  {ispError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={submitCustomerReceipt.isPending}
                data-testid="button-submit-isp"
              >
                {submitCustomerReceipt.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                ) : "Submit State Form & Complete Order"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold font-serif text-foreground">Reserve a Keg</h1>
          <p className="mt-2 text-muted-foreground">Fill out the form below to request a keg pickup from Sawtooth Brewery.</p>
        </div>

        <StepIndicator step={1} />

        <Form {...orderForm}>
          <form onSubmit={orderForm.handleSubmit(onOrderSubmit)} className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Your Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={orderForm.control} name="customerName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="Jane Smith" {...field} data-testid="input-customer-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={orderForm.control} name="customerEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="jane@example.com" {...field} data-testid="input-customer-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={orderForm.control} name="customerPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input type="tel" placeholder="(208) 555-0123" {...field} data-testid="input-customer-phone" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Keg Selection</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addKegItem}
                    className="h-8 text-xs gap-1.5"
                    data-testid="button-add-keg"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Add Keg
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {beers.isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading beers...</div>
                ) : (
                  <div className="space-y-3">
                    {kegItems.map((item, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-[1fr_80px] gap-2">
                          <Select
                            value={item.beerId ? String(item.beerId) : ""}
                            onValueChange={(val) => updateKegItem(index, "beerId", Number(val))}
                          >
                            <SelectTrigger data-testid={`select-beer-${index}`}>
                              <SelectValue placeholder="Select a beer" />
                            </SelectTrigger>
                            <SelectContent>
                              {beers.data?.map((beer) => (
                                <SelectItem key={beer.id} value={String(beer.id)} data-testid={`option-beer-${beer.id}`}>
                                  {beer.name} — {beer.kegSize} (${Number(beer.price).toFixed(2)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={item.quantity}
                            onChange={(e) => updateKegItem(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                            className="text-center"
                            data-testid={`input-quantity-${index}`}
                          />
                        </div>
                        {kegItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeKegItem(index)}
                            data-testid={`button-remove-keg-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {kegItemsError && (
                      <p className="text-sm text-destructive" data-testid="text-keg-items-error">{kegItemsError}</p>
                    )}
                    {kegItems.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Each keg requires a <strong>${DEPOSIT_PER_KEG} refundable deposit</strong>.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Pickup &amp; Return</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={orderForm.control} name="pickupDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Date</FormLabel>
                      <FormControl><Input type="date" {...field} min={new Date().toISOString().slice(0, 10)} data-testid="input-pickup-date" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={orderForm.control} name="pickupTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Time</FormLabel>
                      <FormControl><Input type="time" {...field} data-testid="input-pickup-time" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={orderForm.control} name="returnDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>When will you return the keg and equipment?</FormLabel>
                    <FormControl><Input type="date" {...field} min={new Date().toISOString().slice(0, 10)} data-testid="input-return-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">How will you pour the beer?</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={orderForm.control} name="pouringMethod" render={({ field }) => (
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
                <FormField control={orderForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Notes (optional)</FormLabel>
                    <FormControl><Textarea rows={2} placeholder="Any special requests or notes..." {...field} data-testid="textarea-notes" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment</CardTitle>
                <CardDescription>A $30 deposit per keg is required to hold your order. Your card will be pre-authorized and charged only when the brewery confirms your order.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={orderForm.control} name="cardNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Card Number</FormLabel>
                    <FormControl><Input placeholder="1234 5678 9012 3456" maxLength={19} {...field} data-testid="input-card-number" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={orderForm.control} name="cardExp" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration</FormLabel>
                      <FormControl><Input placeholder="MM/YY" maxLength={5} {...field} data-testid="input-card-exp" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={orderForm.control} name="cardCvv" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CVV</FormLabel>
                      <FormControl><Input placeholder="123" maxLength={4} {...field} data-testid="input-card-cvv" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Separator />
                <div className="space-y-1 text-sm">
                  {kegItems.map((item, index) => {
                    const beer = beerMap.get(item.beerId);
                    if (!beer || item.beerId === 0) return null;
                    const lineTotal = Number(beer.price) * item.quantity;
                    return (
                      <div key={index} className="flex justify-between">
                        <span>{beer.name} — {beer.kegSize} × {item.quantity}</span>
                        <span>${lineTotal.toFixed(2)}</span>
                      </div>
                    );
                  })}
                  {rentalFee > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Equipment rental</span>
                      <span>${rentalFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Deposit ({totalKegCount} keg{totalKegCount !== 1 ? "s" : ""} × ${DEPOSIT_PER_KEG}, refundable)</span>
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
              disabled={orderForm.formState.isSubmitting || authorizePayment.isPending || createOrder.isPending}
              data-testid="button-submit-order"
            >
              {orderForm.formState.isSubmitting || authorizePayment.isPending || createOrder.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                `Continue to State Form ($${total.toFixed(2)} pre-auth)`
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground -mt-2">
              Step 2 will collect the required Idaho State Police keg receipt information.
            </p>
          </form>
        </Form>
      </div>
    </div>
  );
}
