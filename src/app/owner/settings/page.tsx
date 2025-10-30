
export default function OwnerSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Owner Settings</h1>
        <p className="text-muted-foreground">
          Manage high-level application settings and tools.
        </p>
      </div>
      <div>
        {/* The PDF Form Generator has been removed as the client intake form is now a static component. */}
        <p className="text-muted-foreground p-8 text-center border-2 border-dashed rounded-lg">
          Settings area for future feature controls.
        </p>
      </div>
    </div>
  );
}
