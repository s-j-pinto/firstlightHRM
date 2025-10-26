"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";

import { useAuth } from "@/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const createAdminSchema = z.object({
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type CreateAdminFormValues = z.infer<typeof createAdminSchema>;

export default function CreateAdminPage() {
  const [isPending, startTransition] = useTransition();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<CreateAdminFormValues>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: CreateAdminFormValues) => {
    startTransition(async () => {
      try {
        await createUserWithEmailAndPassword(auth, data.email, data.password);
        toast({
          title: "Admin Created",
          description: "New admin user successfully created. You can now log in.",
        });
        router.push("/admin-login");
      } catch (error: any) {
        let description = "An unexpected error occurred. Please try again.";
        if (error.code === 'auth/email-already-in-use') {
            description = "This email is already in use. Please use a different email."
        }
        toast({
          variant: "destructive",
          title: "Creation Failed",
          description: description,
        });
        console.error("Admin Creation Error:", error);
      }
    });
  };

  return (
    <main className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-sm mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold font-headline">Create Admin User</CardTitle>
          <CardDescription>
            Enter the details for the new administrator account.
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="admin@example.com" {...field} />
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
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending} className="w-full bg-accent hover:bg-accent/90">
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create Admin
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
