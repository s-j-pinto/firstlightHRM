
"use client";

import { useState, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection } from "firebase/firestore";
import { firestore, useCollection, useMemoFirebase } from "@/firebase";
import { CareLogTemplate, careLogTemplateSchema } from "@/lib/types";
import { saveCareLogTemplate, deleteCareLogTemplate } from "@/lib/carelog-groups.actions";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PlusCircle, Trash2, Edit, FileText } from "lucide-react";

type CareLogTemplateFormData = z.infer<typeof careLogTemplateSchema>;

const subsections = [
  { id: 'personal_care', label: 'Personal Care' },
  { id: 'meals_hydration', label: 'Meals & Hydration' },
  { id: 'medication_support', label: 'Medication Support' },
  { id: 'companionship', label: 'Companionship & Engagement' },
  { id: 'household_tasks', label: 'Household Tasks' },
  { id: 'client_condition', label: 'Client Condition & Observations' },
  { id: 'communication', label: 'Communication & Follow-Up' },
  { id: 'signature', label: 'Caregiver Signature' }
];

export function CareLogTemplateAdmin() {
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CareLogTemplate | null>(null);
  const { toast } = useToast();

  const templatesRef = useMemoFirebase(() => collection(firestore, 'carelog_templates'), []);
  const { data: templates, isLoading: templatesLoading } = useCollection<CareLogTemplate>(templatesRef);

  const form = useForm<CareLogTemplateFormData>({
    resolver: zodResolver(careLogTemplateSchema),
    defaultValues: { name: "", description: "", subsections: [] },
  });

  const handleOpenModal = (template: CareLogTemplate | null) => {
    setEditingTemplate(template);
    if (template) {
      form.reset({
        name: template.name,
        description: template.description || "",
        subsections: template.subsections || [],
      });
    } else {
      form.reset({ name: "", description: "", subsections: [] });
    }
    setIsModalOpen(true);
  };

  const onSubmit = (data: CareLogTemplateFormData) => {
    startTransition(async () => {
      const payload = editingTemplate ? { ...data, id: editingTemplate.id } : data;
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
        toast({ title: "Error", description: result.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: result.message });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>CareLog Template Administration</CardTitle>
            <CardDescription>Create and manage reusable templates for care logs.</CardDescription>
          </div>
          <Button onClick={() => handleOpenModal(null)}>
            <PlusCircle className="mr-2" />
            Create Template
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {templatesLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="ml-4 text-muted-foreground">Loading templates...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {templates && templates.length > 0 ? (
              templates.map(template => (
                <Card key={template.id} className="flex justify-between items-center p-4">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2"><FileText className="text-accent" />{template.name}</h3>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleOpenModal(template)}><Edit className="h-4 w-4" /></Button>
                    <Dialog>
                        <DialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Are you sure?</DialogTitle>
                                <DialogDescription>This will permanently delete the &quot;{template.name}&quot; template. This action cannot be undone.</DialogDescription>
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
                </Card>
              ))
            ) : (
              <div className="text-center py-10 border-dashed border-2 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900">No Templates Found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Click &quot;Create Template&quot; to get started.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit" : "Create"} CareLog Template</DialogTitle>
            <DialogDescription>Build a new template by selecting the sections you want to include.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Template Name</FormLabel><FormControl><Input placeholder="e.g., Standard Daily Log" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="A short description of when to use this template" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="subsections" render={() => (
                <FormItem>
                    <FormLabel>Subsections</FormLabel>
                    <div className="grid grid-cols-2 gap-4 border p-4 rounded-md">
                        {subsections.map((item) => (
                        <FormField key={item.id} control={form.control} name="subsections" render={({ field }) => (
                            <FormItem key={item.id} className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                <Checkbox
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                    return checked
                                        ? field.onChange([...field.value, item.id])
                                        : field.onChange(field.value?.filter((value) => value !== item.id));
                                    }}
                                />
                                </FormControl>
                                <FormLabel className="font-normal">{item.label}</FormLabel>
                            </FormItem>
                            )}
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
    </Card>
  );
}
