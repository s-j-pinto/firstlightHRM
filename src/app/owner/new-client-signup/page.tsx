
import ClientSignupForm from "@/components/client-signup-form";

export default function NewClientSignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">New Client Intake</h1>
        <p className="text-muted-foreground">
          Fill out the form below to onboard a new client. The form is based on the saved intake template.
        </p>
      </div>
      <ClientSignupForm />
    </div>
  );
}
