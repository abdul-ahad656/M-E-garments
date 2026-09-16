import { useState } from "react";
import { useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminOrderQueryKey,
  getListAdminOrdersQueryKey,
  useCancelAdminOrder,
  useFulfillAdminOrder,
  useGetAdminOrder,
  useRefundAdminOrder,
  type AdminOrderCancelInputReason,
} from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./layout";

function apiErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const data = "data" in error ? (error as { data: unknown }).data : undefined;
    if (typeof data === "object" && data !== null && "error" in data) {
      return String((data as { error: unknown }).error);
    }
    if ("message" in error) {
      return String((error as { message: unknown }).message);
    }
  }
  return "Shopify rejected the request";
}

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = decodeURIComponent(params.id);
  const orderPathId = encodeURIComponent(orderId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const order = useGetAdminOrder(orderPathId, {
    query: {
      queryKey: getGetAdminOrderQueryKey(orderPathId),
      enabled: Boolean(orderPathId),
      staleTime: 5_000,
    },
  });
  const fulfill = useFulfillAdminOrder();
  const refund = useRefundAdminOrder();
  const cancel = useCancelAdminOrder();

  const [trackingCompany, setTrackingCompany] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundFull, setRefundFull] = useState(false);
  const [cancelReason, setCancelReason] =
    useState<AdminOrderCancelInputReason>("OTHER");

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetAdminOrderQueryKey(orderPathId) }),
      queryClient.invalidateQueries({ queryKey: getListAdminOrdersQueryKey() }),
    ]);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {order.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Order unavailable</AlertTitle>
            <AlertDescription>Shopify Admin could not load this order.</AlertDescription>
          </Alert>
        )}

        {order.data && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-serif text-2xl font-semibold">{order.data.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {order.data.customerName || order.data.customerEmail || "Guest"} ·{" "}
                  {new Date(order.data.processedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {order.data.displayFinancialStatus ?? "unknown"}
                </Badge>
                <Badge variant="secondary">
                  {order.data.displayFulfillmentStatus ?? "unfulfilled"}
                </Badge>
                {order.data.cancelledAt && <Badge variant="destructive">Cancelled</Badge>}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Line items</CardTitle>
                <CardDescription>
                  Total {order.data.totalPrice.amount} {order.data.totalPrice.currencyCode}
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                {order.data.lineItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="font-medium">
                        {item.title}
                        {item.variantTitle ? ` · ${item.variantTitle}` : ""}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        qty {item.quantity} · fulfillable {item.fulfillableQuantity}
                      </div>
                    </div>
                    <div className="text-sm">
                      {item.price.amount} {item.price.currencyCode}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {order.data.fulfillments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Fulfillments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order.data.fulfillments.map((fulfillment) => (
                    <div key={fulfillment.id} className="rounded-lg border p-3 text-sm">
                      <div className="font-medium">{fulfillment.status}</div>
                      {fulfillment.tracking.map((track) => (
                        <a
                          key={`${track.number}-${track.url}`}
                          href={track.url}
                          className="mt-1 block text-primary underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {track.company || "Carrier"} {track.number}
                        </a>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {!order.data.cancelledAt && (
              <div className="grid gap-6 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Fulfill</CardTitle>
                    <CardDescription>Create fulfillment for remaining items</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Tracking company</Label>
                      <Input
                        value={trackingCompany}
                        onChange={(e) => setTrackingCompany(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tracking number</Label>
                      <Input
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                      />
                    </div>
                    <Button
                      disabled={fulfill.isPending}
                      onClick={() =>
                        fulfill.mutate(
                          {
                            id: orderPathId,
                            data: {
                              trackingCompany: trackingCompany || null,
                              trackingNumber: trackingNumber || null,
                              notifyCustomer: true,
                            },
                          },
                          {
                            onSuccess: async () => {
                              await refresh();
                              toast({ title: "Order fulfilled" });
                            },
                            onError: (error) =>
                              toast({
                                title: "Fulfillment failed",
                                description: apiErrorMessage(error),
                                variant: "destructive",
                              }),
                          },
                        )
                      }
                    >
                      {fulfill.isPending ? "Fulfilling…" : "Fulfill order"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Refund</CardTitle>
                    <CardDescription>Partial amount or full refund</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        value={refundAmount}
                        disabled={refundFull}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder={order.data.totalPrice.amount}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={refundFull}
                        onChange={(e) => setRefundFull(e.target.checked)}
                      />
                      Full refund
                    </label>
                    <Button
                      disabled={refund.isPending}
                      onClick={() =>
                        refund.mutate(
                          {
                            id: orderPathId,
                            data: {
                              amount: refundFull ? null : refundAmount || null,
                              full: refundFull,
                              notify: true,
                            },
                          },
                          {
                            onSuccess: async () => {
                              await refresh();
                              toast({ title: "Refund created" });
                            },
                            onError: (error) =>
                              toast({
                                title: "Refund failed",
                                description: apiErrorMessage(error),
                                variant: "destructive",
                              }),
                          },
                        )
                      }
                    >
                      {refund.isPending ? "Refunding…" : "Create refund"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cancel</CardTitle>
                    <CardDescription>Cancel and optionally restock</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Reason</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={cancelReason}
                        onChange={(e) =>
                          setCancelReason(e.target.value as AdminOrderCancelInputReason)
                        }
                      >
                        <option value="CUSTOMER">Customer</option>
                        <option value="DECLINED">Declined</option>
                        <option value="FRAUD">Fraud</option>
                        <option value="INVENTORY">Inventory</option>
                        <option value="OTHER">Other</option>
                        <option value="STAFF">Staff</option>
                      </select>
                    </div>
                    <Button
                      variant="destructive"
                      disabled={cancel.isPending}
                      onClick={() =>
                        cancel.mutate(
                          {
                            id: orderPathId,
                            data: {
                              reason: cancelReason,
                              restock: true,
                              notifyCustomer: true,
                            },
                          },
                          {
                            onSuccess: async () => {
                              await refresh();
                              toast({ title: "Order cancelled" });
                            },
                            onError: (error) =>
                              toast({
                                title: "Cancel failed",
                                description: apiErrorMessage(error),
                                variant: "destructive",
                              }),
                          },
                        )
                      }
                    >
                      {cancel.isPending ? "Cancelling…" : "Cancel order"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
