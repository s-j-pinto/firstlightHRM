import { getAdminAppointments } from "@/lib/actions";
import AdminDashboard from "@/components/admin-dashboard";

export default async function AdminPage() {
  const appointments = await getAdminAppointments();

  return (
    <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Interview Dashboard</h1>
        <p className="text-muted-foreground">
            View and manage upcoming caregiver interviews.
        </p>
        <div className="mt-6">
            <AdminDashboard initialAppointments={appointments} />
        </div>
    </div>
  );
}
