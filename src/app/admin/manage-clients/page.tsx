
import ManageClientsClient from '@/components/manage-clients-client';

export default function ManageClientsPage() {
  return (
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
  );
}
