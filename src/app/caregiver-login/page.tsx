
"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink } from "firebase/auth";
import { useAuth } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function CaregiverLoginPage() {
  const [isPending, startTransition] = useTransition();
  const [linkSent, setLinkSent] = useState(false);
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  });
  
  // Effect to handle the sign-in link when the component mounts
  useEffect(() => {
    // Only run if auth is initialized and the link is a sign-in link
    if (auth && isSignInWithEmailLink(auth, window.location.href)) {
      startTransition(async () => {
        // Confirm the link is intended for this user.
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
          // If the email is not in localStorage, ask the user for it.
          email = window.prompt('Please provide your email for confirmation');
          if (!email) {
             toast({
              variant: "destructive",
              title: "Sign-in failed",
              description: "Email is required to complete sign-in.",
            });
            return;
          }
        }
        
        try {
          // The client SDK will parse the code from the link for you.
          await signInWithEmailLink(auth, email, window.location.href);
          
          // Clear the email from storage upon successful login.
          window.localStorage.removeItem('emailForSignIn');
          
          toast({
            title: "Sign-in successful",
            description: "You are now logged in. Redirecting to your dashboard...",
          });

          // Redirect to the caregiver dashboard.
          router.push('/caregiver/dashboard');

        } catch (error) {
           toast({
            variant: "destructive",
            title: "Sign-in failed",
            description: "The sign-in link is invalid or has expired. Please try again.",
          });
        }
      });
    }
  }, [auth, toast, router]);

  const onSubmit = (data: LoginFormValues) => {
    startTransition(async () => {
      const actionCodeSettings = {
        // URL you want to redirect back to. The domain (www.example.com) for this
        // URL must be whitelisted in the Firebase Console.
        url: window.location.origin + window.location.pathname,
        // This must be true.
        handleCodeInApp: true,
      };

      try {
        await sendSignInLinkToEmail(auth, data.email, actionCodeSettings);
        // Save the email locally so you don't need to ask the user for it again
        // if they open the link on the same device.
        window.localStorage.setItem('emailForSignIn', data.email);

        setLinkSent(true);
        toast({
          title: "Check your email",
          description: "A sign-in link has been sent to your email address.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error sending link",
          description: "Could not send sign-in link. Please try again.",
        });
        console.error("Email Link Error:", error);
      }
    });
  };

  if (linkSent) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Card className="w-full max-w-sm mx-auto shadow-lg">
          <CardHeader className="items-center text-center">
            <Mail className="h-12 w-12 text-accent mb-4"/>
            <CardTitle className="text-2xl font-bold font-headline">Check Your Inbox</CardTitle>
            <CardDescription>
              A secure sign-in link has been sent to the email address you provided. Click the link to log in.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-sm mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold font-headline">Caregiver Login</CardTitle>
          <CardDescription>
            Enter your email to receive a secure, one-time login link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending} className="w-full bg-accent hover:bg-accent/90">
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Send Login Link
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
