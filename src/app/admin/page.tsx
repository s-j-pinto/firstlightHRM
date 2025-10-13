
import AdminDashboardClient from "@/components/admin-dashboard-client";

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-headline">Interview Dashboard</h1>
      <p className="text-muted-foreground">
        View and manage upcoming caregiver interviews.
      </p>
      <div className="mt-6">
        <AdminDashboardClient />
      </div>
    </div>
  );
}
