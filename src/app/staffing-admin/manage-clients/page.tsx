import ManageClientsClient from '@/components/manage-clients-client';
import { HelpDialog } from '@/components/HelpDialog';

export default function ManageClientsPage() {
  return (
    <div>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Manage Clients
          </h1>
          <p className="text-muted-foreground">
            Upload and manage client information.
          </p>
        </div>
        <HelpDialog topic="manageClients" />
      </div>
      <div className="mt-6">
        <ManageClientsClient />
      </div>
    </div>
  );
}

    