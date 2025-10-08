
import AdminDashboard from "@/components/admin-dashboard";
import { sendCalendarInvite } from "@/lib/google-calendar.actions.ts";

export default async function AdminPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  let authUrl: string | undefined = undefined;

  async function sendInvite(appointment: any) {
    "use server";
    const result = await sendCalendarInvite(appointment);
    if (result.authUrl) {
      authUrl = result.authUrl;
    }
    // We need a way to return this to the component or trigger a re-render with the authUrl.
    // A simple prop drilling might not be enough if the action is triggered client-side.
    // Let's reconsider the approach.
  }

  // The above approach is flawed for client-side interactions.
  // The action is initiated from the client, so the response should be handled on the client.
  // The fix should be in `admin-dashboard.tsx` to handle the returned `authUrl`.
  // However, let's try to make it work by passing a server action.

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-headline">Interview Dashboard</h1>
      <p className="text-muted-foreground">
        View and manage upcoming caregiver interviews.
      </p>
      <div className="mt-6">
        <AdminDashboard />
      </div>
    </div>
  );
}
