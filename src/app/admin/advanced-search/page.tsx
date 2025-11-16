import AdminDashboardClient from "@/components/admin-dashboard-client";
import { HelpDialog } from "@/components/HelpDialog";

export default function AdvancedSearchPage() {
  return (
    <div>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Phonescreen Dashboard</h1>
          <p className="text-muted-foreground">
            View and manage upcoming phone screen appointments.
          </p>
        </div>
        <HelpDialog topic="phonescreenDashboard" />
      </div>
      <div className="mt-6">
        <AdminDashboardClient />
      </div>
    </div>
  );
}

    