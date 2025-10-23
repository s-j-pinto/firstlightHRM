
import ManageClientsClient from '@/components/manage-clients-client';
import { CareLogGroupAdmin } from '@/components/carelog-group-admin';

export default function StaffingAdminPage() {
  return (
    <div className="space-y-8">
       <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Manage Clients
        </h1>
        <p className="text-muted-foreground">
          Upload and manage client information.
        </p>
        <div className="mt-6">
          <ManageClientsClient />
        </div>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          CareLog Group Administration
        </h1>
        <p className="text-muted-foreground">
          Create, edit, or delete groups linking clients to caregivers.
        </p>
        <div className="mt-6">
            <CareLogGroupAdmin />
        </div>
      </div>
    </div>
  );
}
