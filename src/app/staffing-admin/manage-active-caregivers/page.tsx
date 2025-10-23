
import ManageActiveCaregiversClient from '@/components/manage-active-caregivers-client';

export default function ManageActiveCaregiversPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Manage Active Caregivers
      </h1>
      <p className="text-muted-foreground">
        Upload and manage active caregiver information.
      </p>
      <div className="mt-6">
        <ManageActiveCaregiversClient />
      </div>
    </div>
  );
}
