
"use client";

import { useTransition } from "react";
import Image from "next/image";
import { signInWithCustomToken } from "firebase/auth";
import { useAuth } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { loginNewClient } from "@/lib/new-client-auth.actions";
import { version } from "../../../package.json";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstLight_Logo_VRT_CMYK_ICO.ico?alt=media&token=1151ccf8-5dc3-4ffd-b5aa-ca13e8b083d9";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().length(4, "Password must be the last 4 digits of your mobile number."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function NewClientLoginPage() {
  const [isPending, startTransition] = useTransition();
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    startTransition(async () => {
      const result = await loginNewClient(data.email, data.password);

      if (result.error || !result.token) {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: result.error || "An unknown error occurred.",
        });
        return;
      }

      try {
        await signInWithCustomToken(auth, result.token);
        
        toast({
          title: "Login Successful",
          description: "Welcome! You are now being redirected to your dashboard.",
        });
        
        router.push('/new-client/dashboard');

      } catch (error) {
        console.error("Custom Token Sign-In Error:", error);
        toast({
          variant: "destructive",
          title: "Authentication Failed",
          description: "There was an issue signing you in. Please try again.",
        });
      }
    });
  };

  return (
    <main className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-sm mx-auto shadow-lg">
        <CardHeader className="text-center">
            <Image
                src={logoUrl}
                alt="FirstLight Home Care Logo"
                width={64}
                height={64}
                className="object-contain mx-auto mb-4"
            />
          <CardTitle className="text-2xl font-bold font-headline">New Client Portal</CardTitle>
          <CardDescription>
            Please sign in to review and sign your documents.
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
                    <FormLabel>Your Email</FormLabel>
                    <FormControl>
                      <Input placeholder="your.email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Last 4 digits of mobile" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending} className="w-full bg-accent hover:bg-accent/90">
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Sign In
              </Button>
            </form>
          </Form>
        </CardContent>
         <CardFooter className="flex justify-center text-xs text-muted-foreground pt-4">
          v{version}
        </CardFooter>
      </Card>
    </main>
  );
}
