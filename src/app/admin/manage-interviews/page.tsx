
import ManageInterviewsClient from '@/components/manage-interviews-client';

export default function ManageInterviewsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Manage Interviews
      </h1>
      <p className="text-muted-foreground">
        Conduct phone screens and schedule in-person interviews.
      </p>
      <div className="mt-6">
        <ManageInterviewsClient />
      </div>
    </div>
  );
}
