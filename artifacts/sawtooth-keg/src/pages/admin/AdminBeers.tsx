import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListBeers, useCreateBeer, useUpdateBeer, useDeleteBeer, getListBeersQueryKey } from "@workspace/api-client-react";
import type { Beer } from "@workspace/api-client-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const beerSchema = z.object({
  name: z.string().min(1, "Name required"),
  kegSize: z.string().min(1, "Keg size required"),
  price: z.coerce.number().min(0, "Price must be positive"),
  available: z.boolean(),
  notes: z.string().optional(),
});
type BeerFormValues = z.infer<typeof beerSchema>;

function BeerDialog({
  open,
  onClose,
  editBeer,
}: {
  open: boolean;
  onClose: () => void;
  editBeer: Beer | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createBeer = useCreateBeer();
  const updateBeer = useUpdateBeer();

  const form = useForm<BeerFormValues>({
    resolver: zodResolver(beerSchema),
    defaultValues: editBeer
      ? { name: editBeer.name, kegSize: editBeer.kegSize, price: editBeer.price, available: editBeer.available, notes: editBeer.notes ?? "" }
      : { name: "", kegSize: "1/2 BBL", price: 0, available: true, notes: "" },
  });

  const onSubmit = (values: BeerFormValues) => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: getListBeersQueryKey() });
    if (editBeer) {
      updateBeer.mutate(
        { id: editBeer.id, data: values },
        {
          onSuccess: () => { toast({ title: "Beer updated" }); invalidate(); onClose(); },
          onError: () => toast({ title: "Update failed", variant: "destructive" }),
        }
      );
    } else {
      createBeer.mutate(
        { data: { ...values, notes: values.notes || null } },
        {
          onSuccess: () => { toast({ title: "Beer added" }); invalidate(); onClose(); },
          onError: () => toast({ title: "Create failed", variant: "destructive" }),
        }
      );
    }
  };

  const isPending = createBeer.isPending || updateBeer.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editBeer ? "Edit Beer" : "Add Beer"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Beer Name</FormLabel>
                <FormControl><Input {...field} data-testid="input-beer-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="kegSize" render={({ field }) => (
                <FormItem>
                  <FormLabel>Keg Size</FormLabel>
                  <FormControl><Input {...field} placeholder="1/2 BBL" data-testid="input-keg-size" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Price ($)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-beer-price" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl><Textarea rows={2} {...field} data-testid="textarea-beer-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="available" render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-beer-available" />
                </FormControl>
                <FormLabel className="!mt-0 font-normal">Available for ordering</FormLabel>
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-beer">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editBeer ? "Save Changes" : "Add Beer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminBeers() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBeer, setEditBeer] = useState<Beer | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const beers = useListBeers(undefined, { query: { queryKey: getListBeersQueryKey() } });
  const deleteBeer = useDeleteBeer();

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    deleteBeer.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Beer deleted" });
        queryClient.invalidateQueries({ queryKey: getListBeersQueryKey() });
      },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    });
  };

  const openAdd = () => { setEditBeer(null); setDialogOpen(true); };
  const openEdit = (beer: Beer) => { setEditBeer(beer); setDialogOpen(true); };

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold font-serif" data-testid="heading-beers">Keg Inventory</h1>
          <Button onClick={openAdd} data-testid="button-add-beer">
            <Plus className="h-4 w-4 mr-2" /> Add Beer
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {beers.isLoading ? (
              <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}</div>
            ) : beers.data && beers.data.length > 0 ? (
              <table className="w-full text-sm" data-testid="table-beers">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Size</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Price</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Notes</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {beers.data.map((beer) => (
                    <tr key={beer.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`row-beer-${beer.id}`}>
                      <td className="px-4 py-3 font-medium">{beer.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{beer.kegSize}</td>
                      <td className="px-4 py-3">${Number(beer.price).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${beer.available ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-500"}`}>
                          {beer.available ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{beer.notes ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(beer)} data-testid={`button-edit-beer-${beer.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(beer.id, beer.name)} data-testid={`button-delete-beer-${beer.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-10 text-center text-muted-foreground">No beers added yet. Add your first keg option.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <BeerDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editBeer={editBeer} />
    </AdminLayout>
  );
}
