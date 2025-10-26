
import ManageClientRequestsClient from '@/components/manage-client-requests-client';

export default function ManageClientRequestsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Manage Client Care Requests
      </h1>
      <p className="text-muted-foreground">
        Review and process additional care requests from clients.
      </p>
      <div className="mt-6">
        <ManageClientRequestsClient />
      </div>
    </div>
  );
}
