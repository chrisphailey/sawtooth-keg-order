import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOrder,
  useGetKegReceipt,
  useCreateOrUpdateKegReceipt,
  useSaveReceiptSignature,
  getGetOrderQueryKey,
  getGetKegReceiptQueryKey,
} from "@workspace/api-client-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SignaturePad } from "@/components/SignaturePad";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  dateOfSale: z.string().optional(),
  dateOfReturn: z.string().optional(),
  purchaserName: z.string().optional(),
  purchaserDob: z.string().optional(),
  purchaserPhone: z.string().optional(),
  consumptionLocation: z.string().optional(),
  consumptionTime: z.string().optional(),
  consumptionDate: z.string().optional(),
  validIdNumber: z.string().optional(),
  vehicleYear: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleColor: z.string().optional(),
  vehiclePlate: z.string().optional(),
  staffName: z.string().optional(),
  draftSystemNumber: z.string().optional(),
  co2TankNeeded: z.boolean().optional(),
  co2RegulatorNumber: z.string().optional(),
  trashCanNumbers: z.string().optional(),
  kegBrand: z.string().optional(),
  kegSize: z.string().optional(),
  kegIdNumbers: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <FormItem>
      <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">{label}</FormLabel>
      {children}
      <FormMessage />
    </FormItem>
  );
}

export default function PickupForms() {
  const params = useParams<{ orderId: string }>();
  const orderId = Number(params.orderId);
  const [signature, setSignature] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const order = useGetOrder(orderId, { query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId) } });
  const existingReceipt = useGetKegReceipt(orderId, { query: { enabled: !!orderId, queryKey: getGetKegReceiptQueryKey(orderId) } });

  const createOrUpdateReceipt = useCreateOrUpdateKegReceipt();
  const saveSignature = useSaveReceiptSignature();

  const today = new Date().toISOString().slice(0, 10);
  const returnDate = order.data ? new Date(new Date(order.data.pickupDate).getTime() + 7 * 86400000).toISOString().slice(0, 10) : "";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: existingReceipt.data ? {
      dateOfSale: existingReceipt.data.dateOfSale ?? today,
      dateOfReturn: existingReceipt.data.dateOfReturn ?? returnDate,
      purchaserName: existingReceipt.data.purchaserName ?? order.data?.customerName ?? "",
      purchaserDob: existingReceipt.data.purchaserDob ?? "",
      purchaserPhone: existingReceipt.data.purchaserPhone ?? order.data?.customerPhone ?? "",
      consumptionLocation: existingReceipt.data.consumptionLocation ?? "",
      consumptionTime: existingReceipt.data.consumptionTime ?? "",
      consumptionDate: existingReceipt.data.consumptionDate ?? order.data?.pickupDate ?? "",
      validIdNumber: existingReceipt.data.validIdNumber ?? "",
      vehicleYear: existingReceipt.data.vehicleYear ?? "",
      vehicleMake: existingReceipt.data.vehicleMake ?? "",
      vehicleColor: existingReceipt.data.vehicleColor ?? "",
      vehiclePlate: existingReceipt.data.vehiclePlate ?? "",
      staffName: existingReceipt.data.staffName ?? "",
      draftSystemNumber: existingReceipt.data.draftSystemNumber ?? "",
      co2TankNeeded: existingReceipt.data.co2TankNeeded ?? false,
      co2RegulatorNumber: existingReceipt.data.co2RegulatorNumber ?? "",
      trashCanNumbers: existingReceipt.data.trashCanNumbers ?? "",
      kegBrand: existingReceipt.data.kegBrand ?? "Sawtooth Brewery",
      kegSize: existingReceipt.data.kegSize ?? order.data?.kegSize ?? "",
      kegIdNumbers: existingReceipt.data.kegIdNumbers ?? "",
    } : {
      dateOfSale: today,
      dateOfReturn: returnDate,
      purchaserName: order.data?.customerName ?? "",
      purchaserPhone: order.data?.customerPhone ?? "",
      consumptionDate: order.data?.pickupDate ?? "",
      kegBrand: "Sawtooth Brewery",
      kegSize: order.data?.kegSize ?? "",
      co2TankNeeded: false,
    },
  });

  const onSubmit = async (values: FormValues) => {
    await new Promise<void>((resolve, reject) => {
      createOrUpdateReceipt.mutate(
        { orderId, data: values },
        {
          onSuccess: () => resolve(),
          onError: reject,
        }
      );
    });

    if (signature) {
      await new Promise<void>((resolve, reject) => {
        saveSignature.mutate(
          { orderId, data: { customerSignature: signature, signedAt: new Date().toISOString() } },
          { onSuccess: () => resolve(), onError: reject }
        );
      });
    }

    queryClient.invalidateQueries({ queryKey: getGetKegReceiptQueryKey(orderId) });
    toast({ title: "Receipt saved" });
    setSaved(true);
  };

  if (saved) {
    return (
      <AdminLayout>
        <div className="p-6 max-w-2xl flex flex-col items-center gap-4 pt-16">
          <CheckCircle className="h-14 w-14 text-green-500" />
          <h2 className="text-xl font-bold font-serif">Receipt Saved</h2>
          <div className="flex gap-3">
            <Link href={`/pickup/${orderId}/receipt`}>
              <Button data-testid="link-view-receipt">View Receipt</Button>
            </Link>
            <Link href={`/admin/orders/${orderId}`}>
              <Button variant="outline" data-testid="link-back-order">Back to Order</Button>
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl">
        <Link href={`/admin/orders/${orderId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors" data-testid="link-back-order">
          <ArrowLeft className="h-4 w-4" /> Back to Order
        </Link>

        <h1 className="text-2xl font-bold font-serif mb-2" data-testid="heading-pickup-forms">Idaho Keg Receipt</h1>
        <p className="text-sm text-muted-foreground mb-6">Receipt for Sale of Beer in Kegs to Unlicensed Group or Individual</p>

        {order.isLoading || existingReceipt.isLoading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-sm">Trade Name: Sawtooth Brewery</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="dateOfSale" render={({ field }) => (
                    <Field label="Date of Sale">
                      <FormControl><Input type="date" {...field} data-testid="input-date-of-sale" /></FormControl>
                    </Field>
                  )} />
                  <FormField control={form.control} name="dateOfReturn" render={({ field }) => (
                    <Field label="Date of Return">
                      <FormControl><Input type="date" {...field} data-testid="input-date-of-return" /></FormControl>
                    </Field>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Purchaser Information</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="purchaserName" render={({ field }) => (
                    <Field label="Name"><FormControl><Input {...field} data-testid="input-purchaser-name" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="purchaserDob" render={({ field }) => (
                    <Field label="Date of Birth"><FormControl><Input type="date" {...field} data-testid="input-purchaser-dob" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="purchaserPhone" render={({ field }) => (
                    <Field label="Phone"><FormControl><Input {...field} data-testid="input-purchaser-phone" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="validIdNumber" render={({ field }) => (
                    <Field label="Valid ID Number"><FormControl><Input {...field} data-testid="input-valid-id" /></FormControl></Field>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Consumption Location</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="consumptionLocation" render={({ field }) => (
                    <Field label="Location"><FormControl><Input {...field} data-testid="input-consumption-location" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="consumptionDate" render={({ field }) => (
                    <Field label="Date"><FormControl><Input type="date" {...field} data-testid="input-consumption-date" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="consumptionTime" render={({ field }) => (
                    <Field label="Time"><FormControl><Input type="time" {...field} data-testid="input-consumption-time" /></FormControl></Field>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Vehicle Information</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="vehicleYear" render={({ field }) => (
                    <Field label="Year"><FormControl><Input {...field} data-testid="input-vehicle-year" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="vehicleMake" render={({ field }) => (
                    <Field label="Make"><FormControl><Input {...field} data-testid="input-vehicle-make" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="vehicleColor" render={({ field }) => (
                    <Field label="Color"><FormControl><Input {...field} data-testid="input-vehicle-color" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="vehiclePlate" render={({ field }) => (
                    <Field label="License Plate"><FormControl><Input {...field} data-testid="input-vehicle-plate" /></FormControl></Field>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Keg & Equipment</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="kegBrand" render={({ field }) => (
                    <Field label="Keg Brand"><FormControl><Input {...field} data-testid="input-keg-brand" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="kegSize" render={({ field }) => (
                    <Field label="Keg Size"><FormControl><Input {...field} data-testid="input-keg-size" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="kegIdNumbers" render={({ field }) => (
                    <Field label="Keg ID Numbers"><FormControl><Input {...field} data-testid="input-keg-ids" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="draftSystemNumber" render={({ field }) => (
                    <Field label="Draft System #"><FormControl><Input {...field} data-testid="input-draft-system" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="trashCanNumbers" render={({ field }) => (
                    <Field label="Trash Can Numbers"><FormControl><Input {...field} data-testid="input-trash-cans" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="co2RegulatorNumber" render={({ field }) => (
                    <Field label="CO2 Regulator #"><FormControl><Input {...field} data-testid="input-co2-regulator" /></FormControl></Field>
                  )} />
                  <FormField control={form.control} name="co2TankNeeded" render={({ field }) => (
                    <FormItem className="flex items-center gap-3 col-span-2">
                      <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} data-testid="checkbox-co2-tank" /></FormControl>
                      <FormLabel className="!mt-0 font-normal">CO2 Tank Needed</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="staffName" render={({ field }) => (
                    <Field label="Staff Name"><FormControl><Input {...field} data-testid="input-staff-name" /></FormControl></Field>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Customer Signature</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3 italic">
                    "I certify that the keg(s) rented/sold by the above firm has/have been used for personal use and not for resale, and that I have read and agree to all requirements as stated on the reverse side of this form."
                  </p>
                  <p className="text-xs font-bold text-destructive mb-4 uppercase tracking-wide">
                    ILLEGAL RESALE OF THIS PRODUCT IS A VIOLATION OF IDAHO STATE LAW
                  </p>
                  <SignaturePad
                    onSave={(dataUrl) => setSignature(dataUrl)}
                    onClear={() => setSignature(null)}
                  />
                  {existingReceipt.data?.customerSignature && !signature && (
                    <p className="text-xs text-green-600 mt-2">Signature on file. Draw a new one to replace it.</p>
                  )}
                </CardContent>
              </Card>

              <Button
                type="submit"
                className="w-full h-12"
                disabled={createOrUpdateReceipt.isPending || saveSignature.isPending}
                data-testid="button-save-receipt"
              >
                {(createOrUpdateReceipt.isPending || saveSignature.isPending) ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : "Save Receipt"}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </AdminLayout>
  );
}
