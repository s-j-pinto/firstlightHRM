
import ManageApplicationsClient from '@/components/manage-applications-client';

export default function ManageApplicationsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Manage Applications
      </h1>
      <p className="text-muted-foreground">
        Search for and edit caregiver profile information.
      </p>
      <div className="mt-6">
        <ManageApplicationsClient />
      </div>
    </div>
  );
}
