

"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, query, orderBy } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { saveCareLogTemplate, deleteCareLogTemplate } from "@/lib/carelog-groups.actions";
import type { CareLogTemplate } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";

const subsections = [
  { id: 'personal_care', label: 'Personal Care' },
  { id: 'meals_hydration', label: 'Meals & Hydration' },
  { id: 'medication_support', label: 'Medication Support' },
  { id: 'companionship', label: 'Companionship & Engagement' },
  { id: 'household_tasks', label: 'Household Tasks' },
  { id: 'client_condition', label: 'Client Condition & Observations' },
  { id: 'communication', label: 'Communication & Follow-Up' },
  { id: 'signature', label: 'Caregiver Signature' },
  { id: 'allstar_health_providers', label: 'Allstar Health Providers' },
];

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Name is required."),
  description: z.string().optional(),
  subsections: z.array(z.string()).min(1, "At least one subsection must be selected."),
});

type TemplateFormData = z.infer<typeof templateSchema>;

export function CareLogTemplateAdmin() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CareLogTemplate | null>(null);
  const firestore = useFirestore();

  const templatesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "carelog_templates"), orderBy("name", "asc")) : null, 
    [firestore]
  );
  const { data: templates, isLoading } = useCollection<CareLogTemplate>(templatesQuery);

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      description: "",
      subsections: [],
    },
  });

  const handleOpenModal = (template: CareLogTemplate | null) => {
    setEditingTemplate(template);
    if (template) {
      form.reset({
          name: template.name,
          description: template.description,
          subsections: template.subsections || [],
      });
    } else {
      form.reset({ name: "", description: "", subsections: [] });
    }
    setIsModalOpen(true);
  };

  const onSubmit = (data: TemplateFormData) => {
    startTransition(async () => {
      const payload = { ...data, id: editingTemplate?.id };
      const result = await saveCareLogTemplate(payload);
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
        const result = await deleteCareLogTemplate(id);
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
            <CardTitle>CareLog Templates</CardTitle>
            <Button onClick={() => handleOpenModal(null)}>
              <PlusCircle className="mr-2" />
              Create Template
            </Button>
          </div>
          <CardDescription>
            Create and manage reusable templates for caregiver daily logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates && templates.length > 0 ? (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="font-medium">{template.name}</div>
                    </TableCell>
                    <TableCell>{template.description}</TableCell>
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
                                    <Button variant="destructive" onClick={() => handleDelete(template.id)} disabled={isPending}>
                                        {isPending && <Loader2 className="animate-spin mr-2"/>}
                                        Delete Template
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    No templates found. Click "Create Template" to begin.
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
            <DialogTitle>{editingTemplate ? "Edit" : "Create"} CareLog Template</DialogTitle>
            <DialogDescription>
              Select the sections to include in this template.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><Label>Template Name</Label><FormControl><Input placeholder="e.g., Standard Daily Log" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><Label>Description</Label><FormControl><Textarea placeholder="A short description of when to use this template" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
               <FormField
                control={form.control}
                name="subsections"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Subsections</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Select all the sections you want to include in this log template.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {subsections.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="subsections"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={item.id}
                                className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([
                                            ...(field.value || []),
                                            item.id,
                                          ])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== item.id
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {item.label}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
