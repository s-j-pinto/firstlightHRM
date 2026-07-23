
import ManageUnassignedShiftsClient from '@/components/manage-unassigned-shifts-client';
import { HelpDialog } from '@/components/HelpDialog';

export default function ManageUnassignedShiftsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Manage Unassigned Shifts
          </h1>
          <p className="text-muted-foreground">
            Identify open shifts from TeleTrack and find the best matching caregivers.
          </p>
        </div>
        <HelpDialog topic="manageCalloffs" />
      </div>
      <div className="mt-6">
        <ManageUnassignedShiftsClient />
      </div>
    </div>
  );
}
