import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import Link from 'next/link';

const hiringForms = [
  { name: "HCS 501 - Personnel Record 2019", href: "/candidate-hiring-forms/hcs501" },
  { name: "Caregiver Emergency Contact Numbers", href: "/candidate-hiring-forms/emergency-contact" },
  { name: "Reference Verification - CG", href: "/candidate-hiring-forms/reference-verification" },
  { name: "LIC 508 - Criminal Record Statement", href: "/candidate-hiring-forms/lic508" },
  { name: "SOC 341A - Elder Abuse Reporting Form", href: "/candidate-hiring-forms/soc341a" },
];

export default function CandidateHiringFormsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Hiring Forms</CardTitle>
          <CardDescription>
            Please complete all of the following forms to continue your onboarding process.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hiringForms.map((form) => (
            <Link href={form.href} key={form.name} className="block">
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <FileText className="h-6 w-6 text-accent" />
                  <span className="font-medium">{form.name}</span>
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
