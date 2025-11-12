
"use client";

import * as React from "react";
import { useMemo, useState, useTransition } from "react";
import { collection, query, orderBy } from "firebase/firestore";
import { firestore, useCollection, useMemoFirebase } from "@/firebase";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Loader2,
  PlusCircle,
  Edit,
  Trash2,
  FileText
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormMessage } from "./ui/form";
import { Textarea } from "./ui/textarea";
import { saveCampaignTemplate, deleteCampaignTemplate } from "@/lib/campaign.actions";
import type { CampaignTemplate } from "@/lib/types";

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Name is required."),
  description: z.string().optional(),
  subject: z.string().min(5, "Subject is required."),
  body: z.string().min(10, "Email body is required."),
  intervalDays: z.coerce.number().min(1, "Interval must be at least 1 day."),
  type: z.literal("email").default("email"),
});

type TemplateFormData = z.infer<typeof templateSchema>;

export default function CampaignManagementClient() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CampaignTemplate | null>(null);

  const templatesQuery = useMemoFirebase(() => query(collection(firestore, "campaign_templates"), orderBy("intervalDays", "asc")), []);
  const { data: templates, isLoading } = useCollection<CampaignTemplate>(templatesQuery);

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      description: "",
      subject: "",
      body: "",
      intervalDays: 3,
      type: "email",
    },
  });

  const handleOpenModal = (template: CampaignTemplate | null) => {
    setEditingTemplate(template);
    if (template) {
      form.reset(template);
    } else {
      form.reset({ name: "", description: "", subject: "", body: "", intervalDays: 3, type: "email" });
    }
    setIsModalOpen(true);
  };

  const onSubmit = (data: TemplateFormData) => {
    startTransition(async () => {
      const result = await saveCampaignTemplate(data);
      if (result.error) {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: result.message });
        setIsModalOpen(false);
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
        const result = await deleteCampaignTemplate(id);
        if (result.error) {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.message });
        }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle>Email Templates</CardTitle>
            <Button onClick={() => handleOpenModal(null)}>
              <PlusCircle className="mr-2" />
              Create Template
            </Button>
          </div>
          <CardDescription>
            These emails are sent automatically to leads who have not converted after a set number of days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates && templates.length > 0 ? (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="font-medium">{template.name}</div>
                      <div className="text-sm text-muted-foreground">{template.description}</div>
                    </TableCell>
                    <TableCell>{template.intervalDays} days</TableCell>
                    <TableCell>{template.subject}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="icon" onClick={() => handleOpenModal(template)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Dialog key={`delete-dialog-${template.id}`}>
                            <DialogTrigger asChild>
                                <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Are you sure?</DialogTitle>
                                    <DialogDescription>This will permanently delete the "{template.name}" template. This action cannot be undone.</DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                    <DialogTrigger asChild>
                                      <Button variant="destructive" onClick={() => handleDelete(template.id)} disabled={isPending}>
                                          {isPending && <Loader2 className="animate-spin mr-2"/>}
                                          Delete Template
                                      </Button>
                                    </DialogTrigger>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No campaign templates found. Click "Create Template" to begin.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit" : "Create"} Follow-up Template</DialogTitle>
            <DialogDescription>
              This email will be sent to leads who match the criteria after the specified interval.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><Label>Template Name</Label><FormControl><Input placeholder="e.g., 3-Day Follow Up" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="intervalDays" render={({ field }) => (
                  <FormItem><Label>Send After (Days)</Label><FormControl><Input type="number" placeholder="3" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
               <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><Label>Description (Internal)</Label><FormControl><Input placeholder="Friendly check-in after initial contact" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem><Label>Email Subject</Label><FormControl><Input placeholder="Following Up from FirstLight Home Care" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="body" render={({ field }) => (
                <FormItem>
                    <Label>Email Body</Label>
                    <FormControl><Textarea placeholder="<p>Hello {{clientName}},</p><p>We hope you're having a good week...</p>" {...field} rows={10} /></FormControl>
                    <p className="text-xs text-muted-foreground">You can use `{'{{clientName}}'}` as a placeholder for the client's name. Use HTML for formatting.</p>
                    <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Template
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
