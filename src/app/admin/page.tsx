import AdvancedSearchClient from '@/components/advanced-search-client';
import { HelpDialog } from '@/components/HelpDialog';

export default function AdminPage() {
  return (
    <div>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Candidate Search
          </h1>
          <p className="text-muted-foreground">
            Build a custom query to find candidates based on skills, status, and application date.
          </p>
        </div>
        <HelpDialog topic="candidateSearch" />
      </div>
      <div className="mt-6">
        <AdvancedSearchClient />
      </div>
    </div>
  );
}

    