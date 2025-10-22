
"use client";

import { useTransition } from "react";
import Image from "next/image";
import { signInAnonymously } from "firebase/auth";
import { useAuth } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { version } from '../../../package.json';

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstLight_Logo_VRT_CMYK_ICO.ico?alt=media&token=1151ccf8-5dc3-4ffd-b5aa-ca13e8b083d9";

export default function CaregiverLoginPage() {
  const [isPending, startTransition] = useTransition();
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleAnonymousLogin = () => {
    startTransition(async () => {
      try {
        await signInAnonymously(auth);
        toast({
          title: "Session Started",
          description: "You can now begin your application.",
        });
        router.push('/');
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Authentication Failed",
          description: "Could not start an anonymous session. Please try again.",
        });
        console.error("Anonymous Sign-In Error:", error);
      }
    });
  };

  return (
    <main className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-sm mx-auto shadow-lg text-center">
        <CardHeader>
          <div className="mx-auto bg-accent/10 p-3 rounded-full w-fit mb-4">
            <Image
                src={logoUrl}
                alt="FirstLight Home Care Logo"
                width={48}
                height={48}
                className="object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold font-headline">Ready to Make a Difference?</CardTitle>
          <CardDescription>
            Click the button below to start your application. Your progress will be saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            size="lg" 
            onClick={handleAnonymousLogin} 
            disabled={isPending} 
            className="w-full bg-accent hover:bg-accent/90"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Start Your Application
          </Button>
           <div className="relative">
              <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                      Or
                  </span>
              </div>
          </div>
           <Button asChild variant="outline" className="w-full">
            <Link href="/active-caregiver-login">
                Active Caregiver Login
            </Link>
          </Button>
        </CardContent>
         <CardFooter className="flex justify-center text-xs text-muted-foreground pt-4">
          v{version}
        </CardFooter>
      </Card>
    </main>
  );
}
