
import PdfFormGenerator from "@/components/pdf-form-generator";

export default function OwnerSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Owner Settings</h1>
        <p className="text-muted-foreground">
          Manage high-level application settings and tools.
        </p>
      </div>
      <PdfFormGenerator />
    </div>
  );
}
