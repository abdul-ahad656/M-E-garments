import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getGetAdminSessionQueryKey,
  getListAdminStaffQueryKey,
  useGetAdminSession,
  useListAdminStaff,
  useUpdateAdminStaffAccess,
  type AdminStaffMember,
} from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./layout";

function StaffAccessManager({
  members,
  currentUserId,
}: {
  members: AdminStaffMember[];
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutation = useUpdateAdminStaffAccess();

  const changeRole = (member: AdminStaffMember, role: "admin" | "staff" | null) => {
    mutation.mutate(
      { userId: member.userId, data: { role } },
      {
        onSuccess: async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getListAdminStaffQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetAdminSessionQueryKey() }),
          ]);
          toast({
            title: role ? "Staff access updated" : "Staff access revoked",
            description: `${member.email} will use the new access on their next dashboard check.`,
          });
        },
        onError: () => {
          toast({
            title: "Could not update staff access",
            description: "No access change was saved. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff access</CardTitle>
        <CardDescription>
          Grant only the access a team member needs. Every successful change is recorded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.map((member) => {
          const isProtected = member.userId === currentUserId || member.role === "owner";
          const isUpdating = mutation.isPending && mutation.variables?.userId === member.userId;
          return (
            <div
              key={member.userId}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{member.displayName || member.email}</div>
                <div className="truncate text-sm text-muted-foreground">{member.email}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={member.role ? "secondary" : "outline"}>
                  {member.role ?? "Customer"}
                </Badge>
                {!isProtected && (
                  <select
                    aria-label={`Access for ${member.email}`}
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={member.role ?? "customer"}
                    disabled={mutation.isPending}
                    onChange={(event) => {
                      const role = event.target.value;
                      changeRole(
                        member,
                        role === "admin" || role === "staff" ? role : null,
                      );
                    }}
                  >
                    <option value="customer">No dashboard access</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                )}
                {isUpdating && <span className="text-xs text-muted-foreground">Saving…</span>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function AdminStaffPage() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const adminSession = useGetAdminSession({
    query: {
      queryKey: [...getGetAdminSessionQueryKey(), user?.id ?? "signed-out"],
      enabled: Boolean(user?.id),
      staleTime: 0,
      retry: false,
    },
  });
  const staff = useListAdminStaff({
    query: {
      queryKey: [...getListAdminStaffQueryKey(), user?.id ?? "signed-out"],
      enabled: Boolean(user?.id) && adminSession.data?.canManageStaff === true,
      staleTime: 0,
    },
  });

  useEffect(() => {
    if (adminSession.isSuccess && !adminSession.data.canManageStaff) {
      setLocation("/admin");
    }
  }, [adminSession.data?.canManageStaff, adminSession.isSuccess, setLocation]);

  return (
    <AdminLayout>
      {staff.data && user?.id && (
        <StaffAccessManager members={staff.data} currentUserId={user.id} />
      )}
      {staff.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Staff access unavailable</AlertTitle>
          <AlertDescription>
            User access could not be loaded. No changes can be made right now.
          </AlertDescription>
        </Alert>
      )}
    </AdminLayout>
  );
}
