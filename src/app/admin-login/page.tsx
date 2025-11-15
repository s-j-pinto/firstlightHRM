
"use client";

import Image from "next/image";
import Link from "next/link";
import packageJson from '../../../package.json';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building } from "lucide-react";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstLight_Logo_VRT_CMYK_ICO.ico?alt=media&token=1151ccf8-5dc3-4ffd-b5aa-ca13e8b083d9";


export default function AdminLoginPage() {
  return (
    <main className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-md mx-auto shadow-lg">
        <CardHeader className="text-center">
            <Image
                src={logoUrl}
                alt="FirstLight Home Care Logo"
                width={64}
                height={64}
                className="object-contain mx-auto mb-4"
            />
          <CardTitle className="text-2xl font-bold font-headline">Administrative Portals</CardTitle>
          <CardDescription>
            Please select your designated portal to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Button asChild size="lg" className="w-full">
                <Link href="/login-form?role=hr">
                    <Users className="mr-2" />
                    HR Admin Portal
                </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="w-full">
                 <Link href="/login-form?role=staffing">
                    <Building className="mr-2" />
                    Staffing Admin Portal
                </Link>
            </Button>
        </CardContent>
        <CardFooter className="flex justify-center text-xs text-muted-foreground pt-4">
          v{packageJson.version}
        </CardFooter>
      </Card>
    </main>
  );
}
