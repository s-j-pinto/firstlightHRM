
import AdminDashboardClient from "@/components/admin-dashboard-client";

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-headline">Phone Screen Appointments Dashboard</h1>
      <p className="text-muted-foreground">
        View and manage upcoming phone screen appointments.
      </p>
      <div className="mt-6">
        <AdminDashboardClient />
      </div>
    </div>
  );
}
