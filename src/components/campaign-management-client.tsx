

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
  FileText,
  Mail,
  MessageSquare
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { saveCampaignTemplate, deleteCampaignTemplate } from "@/lib/campaign.actions";
import type { CampaignTemplate } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

const knownLeadSources = [
    { id: 'Google Ads Lead Received', label: 'Google Ads' },
    { id: 'App Referral Received', label: 'App Referral' },
];

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Name is required."),
  description: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().min(10, "Message body is required."),
  intervalDays: z.coerce.number().min(0, "Interval must be at least 0 days for immediate sends."),
  intervalHours: z.coerce.number().min(0, "Interval must be 0 or greater.").optional(),
  type: z.enum(["email", "sms"]),
  sendImmediatelyFor: z.array(z.string()).optional(),
}).refine(data => {
    if (data.type === 'email' && !data.subject) {
        return false;
    }
    return true;
}, {
    message: "Subject is required for email templates.",
    path: ["subject"],
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
      intervalHours: 0,
      type: "email",
      sendImmediatelyFor: [],
    },
  });

  const templateType = form.watch('type');

  const handleOpenModal = (template: CampaignTemplate | null) => {
    setEditingTemplate(template);
    if (template) {
      form.reset({
          ...template,
          type: template.type || 'email',
          sendImmediatelyFor: template.sendImmediatelyFor || [],
          intervalHours: template.intervalHours || 0,
      });
    } else {
      form.reset({ name: "", description: "", subject: "", body: "", intervalDays: 3, intervalHours: 0, type: "email", sendImmediatelyFor: [] });
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
            <CardTitle>Messaging Templates</CardTitle>
            <Button onClick={() => handleOpenModal(null)}>
              <PlusCircle className="mr-2" />
              Create Template
            </Button>
          </div>
          <CardDescription>
            These messages are sent automatically to leads after a set period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Message Content / Subject</TableHead>
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
                    <TableCell>
                        <Badge variant={template.type === 'sms' ? 'secondary' : 'outline'} className="capitalize">
                            {template.type === 'sms' ? <MessageSquare className="mr-2"/> : <Mail className="mr-2" />}
                            {template.type}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        {template.intervalDays === 0 && template.intervalHours && template.intervalHours > 0 
                            ? `${template.intervalHours} hour(s)`
                            : `${template.intervalDays} day(s)`
                        }
                    </TableCell>
                    <TableCell>{template.type === 'email' ? template.subject : template.body}</TableCell>
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
                  <TableCell colSpan={5} className="h-24 text-center">
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
            <DialogTitle>{editingTemplate ? "Edit" : "Create"} Messaging Template</DialogTitle>
            <DialogDescription>
              This message will be sent to leads who match the criteria after the specified interval.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
              
              <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Template Type</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                        <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="email" /></FormControl><FormLabel className="font-normal">Email</FormLabel></FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="sms" /></FormControl><FormLabel className="font-normal">SMS</FormLabel></FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><Label>Template Name</Label><FormControl><Input placeholder="e.g., 3-Day Follow Up" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="intervalDays" render={({ field }) => (
                  <FormItem><Label>Send After (Days)</Label><FormControl><Input type="number" placeholder="3" {...field} /></FormControl><p className="text-xs text-muted-foreground">Set to 0 for hourly sending.</p><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><Label>Description (Internal)</Label><FormControl><Input placeholder="Friendly check-in after initial contact" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                {form.getValues('intervalDays') === 0 && (
                    <FormField control={form.control} name="intervalHours" render={({ field }) => (
                        <FormItem><Label>Send After (Hours)</Label><FormControl><Input type="number" placeholder="1" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                )}
              </div>

               <FormField control={form.control} name="sendImmediatelyFor" render={() => (
                <FormItem>
                    <Label>Trigger Immediately For Source</Label>
                    <div className="flex flex-wrap gap-4 border p-4 rounded-md">
                        {knownLeadSources.map((source) => (
                        <FormField key={source.id} control={form.control} name="sendImmediatelyFor" render={({ field }) => (
                            <FormItem key={source.id} className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                <Checkbox
                                    checked={field.value?.includes(source.id)}
                                    onCheckedChange={(checked) => {
                                    return checked
                                        ? field.onChange([...(field.value || []), source.id])
                                        : field.onChange(field.value?.filter((value) => value !== source.id) || []);
                                    }}
                                />
                                </FormControl>
                                <Label className="font-normal">{source.label}</Label>
                            </FormItem>
                            )}
                        />
                        ))}
                    </div>
                     <p className="text-xs text-muted-foreground">Select lead sources that should trigger this message immediately upon creation. Interval must be 0 for this to work.</p>
                    <FormMessage />
                </FormItem>
              )}
              />
              
              {templateType === 'email' && (
                <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem><Label>Email Subject</Label><FormControl><Input placeholder="Following Up from FirstLight Home Care" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
              <FormField control={form.control} name="body" render={({ field }) => (
                <FormItem>
                    <FormLabel>Message Body</FormLabel>
                    <FormControl><Textarea placeholder="Enter your message here..." {...field} rows={8} /></FormControl>
                    <p className="text-xs text-muted-foreground">You can use {`{{clientName}}`} and {`{{assessmentLink}}`} as placeholders.</p>
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
