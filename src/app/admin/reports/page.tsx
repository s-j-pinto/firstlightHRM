
import CancelledInterviewsReport from "@/components/cancelled-interviews-report";

export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-headline">Reports</h1>
      <p className="text-muted-foreground">
        Analyze trends and historical data.
      </p>
      <div className="mt-6">
        <CancelledInterviewsReport />
      </div>
    </div>
  );
}
