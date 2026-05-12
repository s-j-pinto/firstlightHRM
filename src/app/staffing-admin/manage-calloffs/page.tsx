
import ManageCalloffsClient from '@/components/manage-calloffs-client';
import { HelpDialog } from '@/components/HelpDialog';

export default function ManageCalloffsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Manage Caregiver Calloff
          </h1>
          <p className="text-muted-foreground">
            Identify shifts with calloffs and find replacement recommendations.
          </p>
        </div>
        <HelpDialog topic="manageCalloffs" />
      </div>
      <div className="mt-6">
        <ManageCalloffsClient />
      </div>
    </div>
  );
}
