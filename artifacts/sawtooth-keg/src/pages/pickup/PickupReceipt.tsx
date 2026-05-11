import { useParams, Link } from "wouter";
import {
  useGetOrder,
  useGetKegReceipt,
  getGetOrderQueryKey,
  getGetKegReceiptQueryKey,
} from "@workspace/api-client-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, Printer } from "lucide-react";

function ReceiptRow({ label, value }: { label: string; value?: string | null | boolean }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex gap-4 py-1.5 text-sm border-b border-dashed border-border/50 last:border-0">
      <span className="text-muted-foreground w-48 flex-shrink-0">{label}</span>
      <span className="font-medium">{typeof value === "boolean" ? (value ? "Yes" : "No") : value}</span>
    </div>
  );
}

export default function PickupReceipt() {
  const params = useParams<{ orderId: string }>();
  const orderId = Number(params.orderId);

  const order = useGetOrder(orderId, { query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId) } });
  const receipt = useGetKegReceipt(orderId, { query: { enabled: !!orderId, queryKey: getGetKegReceiptQueryKey(orderId) } });

  const handlePrint = () => window.print();

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Link href={`/admin/orders/${orderId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back-order">
            <ArrowLeft className="h-4 w-4" /> Back to Order
          </Link>
          <Button variant="outline" onClick={handlePrint} data-testid="button-print-receipt">
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>

        {order.isLoading || receipt.isLoading ? (
          <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded" />)}</div>
        ) : !receipt.data ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="mb-4">No receipt found for this order.</p>
            <Link href={`/pickup/${orderId}/forms`}>
              <Button variant="outline" data-testid="link-fill-forms">Fill Out Receipt</Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-8 space-y-6" data-testid="card-receipt">
            {receipt.data.submittedByCustomer && (
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 print:hidden" data-testid="banner-customer-prefilled">
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
                <span><strong>Customer completed this form at order time.</strong> Fields below were pre-filled by the customer.</span>
              </div>
            )}
            <div className="text-center border-b pb-6">
              <h1 className="text-xl font-bold font-serif uppercase tracking-wide">Receipt for Sale of Beer in Kegs</h1>
              <p className="text-sm text-muted-foreground mt-1">to Unlicensed Group or Individual</p>
              <p className="font-bold text-base mt-2">Sawtooth Brewery</p>
            </div>

            <div className="space-y-1">
              <h2 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">Sale Information</h2>
              <ReceiptRow label="Date of Sale" value={receipt.data.dateOfSale} />
              <ReceiptRow label="Date of Return" value={receipt.data.dateOfReturn} />
            </div>

            <Separator />

            <div className="space-y-1">
              <h2 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">Purchaser Information</h2>
              <ReceiptRow label="Name" value={receipt.data.purchaserName} />
              <ReceiptRow label="Date of Birth" value={receipt.data.purchaserDob} />
              <ReceiptRow label="Phone" value={receipt.data.purchaserPhone} />
              <ReceiptRow label="Valid ID Number" value={receipt.data.validIdNumber} />
            </div>

            <Separator />

            <div className="space-y-1">
              <h2 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">Consumption Location</h2>
              <ReceiptRow label="Location" value={receipt.data.consumptionLocation} />
              <ReceiptRow label="Date" value={receipt.data.consumptionDate} />
              <ReceiptRow label="Time" value={receipt.data.consumptionTime} />
            </div>

            <Separator />

            <div className="space-y-1">
              <h2 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">Vehicle</h2>
              <ReceiptRow label="Year" value={receipt.data.vehicleYear} />
              <ReceiptRow label="Make" value={receipt.data.vehicleMake} />
              <ReceiptRow label="Color" value={receipt.data.vehicleColor} />
              <ReceiptRow label="License Plate" value={receipt.data.vehiclePlate} />
            </div>

            <Separator />

            {order.data?.items && order.data.items.length > 0 && (
              <>
                <div className="space-y-1">
                  <h2 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">Ordered Kegs</h2>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                          <th className="text-left px-3 py-2 font-medium">Beer</th>
                          <th className="text-left px-3 py-2 font-medium">Keg Size</th>
                          <th className="text-right px-3 py-2 font-medium">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.data.items.map((item) => (
                          <tr key={item.id} className="border-t border-border/50">
                            <td className="px-3 py-2">{item.beerName}</td>
                            <td className="px-3 py-2">{item.kegSize}</td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <Separator />
              </>
            )}

            <div className="space-y-1">
              <h2 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">Keg & Equipment</h2>
              <ReceiptRow label="Keg Brand" value={receipt.data.kegBrand} />
              <ReceiptRow label="Keg Size" value={receipt.data.kegSize} />
              <ReceiptRow label="Keg ID Numbers" value={receipt.data.kegIdNumbers} />
              <ReceiptRow label="Draft System #" value={receipt.data.draftSystemNumber} />
              <ReceiptRow label="CO2 Tank Needed" value={receipt.data.co2TankNeeded} />
              <ReceiptRow label="CO2 Regulator #" value={receipt.data.co2RegulatorNumber} />
              <ReceiptRow label="Trash Can Numbers" value={receipt.data.trashCanNumbers} />
              <ReceiptRow label="Staff Name" value={receipt.data.staffName} />
            </div>

            <Separator />

            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">Customer Certification</h2>
              <p className="text-xs text-muted-foreground italic">
                "I certify that the keg(s) rented/sold by the above firm has/have been used for personal use and not for resale, and that I have read and agree to all requirements as stated on the reverse side of this form."
              </p>
              <p className="text-xs font-bold text-destructive uppercase tracking-wide">
                ILLEGAL RESALE OF THIS PRODUCT IS A VIOLATION OF IDAHO STATE LAW
              </p>

              {receipt.data.customerSignature ? (
                <div className="border rounded-lg p-3 bg-white">
                  <p className="text-xs text-muted-foreground mb-2">Customer Signature</p>
                  <img
                    src={receipt.data.customerSignature}
                    alt="Customer signature"
                    className="max-h-24 object-contain"
                    data-testid="img-signature"
                  />
                  {receipt.data.signedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Signed {new Date(receipt.data.signedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="border rounded-lg p-6 text-center text-muted-foreground text-sm">
                  No signature on file
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
