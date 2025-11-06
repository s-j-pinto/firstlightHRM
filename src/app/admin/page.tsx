import AdvancedSearchClient from '@/components/advanced-search-client';

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Candidate Search
      </h1>
      <p className="text-muted-foreground">
        Build a custom query to find candidates based on skills, status, and application date.
      </p>
      <div className="mt-6">
        <AdvancedSearchClient />
      </div>
    </div>
  );
}
