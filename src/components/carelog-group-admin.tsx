
"use client";

import { useState, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection } from "firebase/firestore";
import { firestore, useCollection, useMemoFirebase } from "@/firebase";
import { Client, ActiveCaregiver, CareLogGroup } from "@/lib/types";
import { saveCareLogGroup, deleteCareLogGroup } from "@/lib/carelog-groups.actions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlusCircle, Trash2, Edit, X, Users } from "lucide-react";

const careLogGroupSchema = z.object({
  groupId: z.string().optional(),
  clientId: z.string().min(1, "A client must be selected."),
  caregiverEmails: z.array(z.string().email()).min(1, "At least one caregiver must be selected."),
});

type CareLogGroupFormData = z.infer<typeof careLogGroupSchema>;

export function CareLogGroupAdmin() {
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CareLogGroup | null>(null);
  const { toast } = useToast();

  const clientsRef = useMemoFirebase(() => collection(firestore, 'Clients'), [firestore]);
  const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsRef);

  const activeCaregiversRef = useMemoFirebase(() => collection(firestore, 'caregivers_active'), [firestore]);
  const { data: caregivers, isLoading: caregiversLoading } = useCollection<ActiveCaregiver>(activeCaregiversRef);

  const careLogGroupsRef = useMemoFirebase(() => collection(firestore, 'carelog_groups'), [firestore]);
  const { data: careLogGroups, isLoading: groupsLoading } = useCollection<CareLogGroup>(careLogGroupsRef);

  const activeClients = useMemo(() => clients?.filter(c => c.status === 'ACTIVE') || [], [clients]);
  const activeCaregivers = useMemo(() => caregivers?.filter(c => c.status === 'ACTIVE' && c.Email) || [], [caregivers]);

  const form = useForm<CareLogGroupFormData>({
    resolver: zodResolver(careLogGroupSchema),
    defaultValues: {
      groupId: undefined,
      clientId: "",
      caregiverEmails: [],
    },
  });

  const caregiversByEmailMap = useMemo(() => {
    if (!caregivers) return new Map();
    return new Map(caregivers.map(cg => [cg.Email, cg.Name]));
  }, [caregivers]);

  const handleOpenModal = (group: CareLogGroup | null) => {
    setEditingGroup(group);
    if (group) {
      form.reset({
        groupId: group.id,
        clientId: group.clientId,
        caregiverEmails: group.caregiverEmails || [],
      });
    } else {
      form.reset({
        groupId: undefined,
        clientId: "",
        caregiverEmails: [],
      });
    }
    setIsModalOpen(true);
  };

  const onSubmit = (data: CareLogGroupFormData) => {
    startTransition(async () => {
      const result = await saveCareLogGroup(data);
      if (result.error) {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: result.message });
        setIsModalOpen(false);
      }
    });
  };

  const handleDelete = (groupId: string) => {
    startTransition(async () => {
      const result = await deleteCareLogGroup(groupId);
      if (result.error) {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: result.message });
      }
    });
  };

  const isLoading = clientsLoading || caregiversLoading || groupsLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>CareLog Group Administration</CardTitle>
            <CardDescription>Create, edit, or delete groups linking clients to caregivers.</CardDescription>
          </div>
          <Button onClick={() => handleOpenModal(null)}>
            <PlusCircle className="mr-2" />
            Create Group
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="ml-4 text-muted-foreground">Loading groups...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {careLogGroups && careLogGroups.length > 0 ? (
              careLogGroups.map(group => (
                <Card key={group.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4">
                  <div className="flex-1 mb-4 sm:mb-0">
                    <h3 className="font-semibold text-lg flex items-center gap-2"><Users className="text-accent" />{group.clientName}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {Array.isArray(group.caregiverEmails) && group.caregiverEmails.map(email => (
                            <Badge key={email} variant="secondary">{caregiversByEmailMap.get(email) || email}</Badge>
                        ))}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="icon" onClick={() => handleOpenModal(group)}><Edit className="h-4 w-4" /></Button>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Are you sure?</DialogTitle>
                                <DialogDescription>This will permanently delete the group for {group.clientName}. This action cannot be undone.</DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                <Button variant="destructive" onClick={() => handleDelete(group.id)} disabled={isPending}>
                                    {isPending && <Loader2 className="animate-spin mr-2"/>}
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-10 border-dashed border-2 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900">No CareLog Groups Found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Click "Create Group" to get started.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit" : "Create"} CareLog Group</DialogTitle>
            <DialogDescription>Link a client to one or more active caregivers.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!editingGroup}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeClients.map(client => (
                          <SelectItem key={client.id} value={client.id}>{client['Client Name']}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="caregiverEmails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Active Caregivers</FormLabel>
                    <ScrollArea className="h-64 w-full rounded-md border p-4">
                      <div className="space-y-2">
                        {activeCaregivers.map(cg => (
                           <FormItem
                            key={cg.id}
                            className="flex flex-row items-center space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(cg.Email)}
                                onCheckedChange={checked => {
                                  return checked
                                    ? field.onChange([...(field.value || []), cg.Email])
                                    : field.onChange(field.value?.filter(email => email !== cg.Email));
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">{cg.Name} ({cg.Email})</FormLabel>
                          </FormItem>
                        ))}
                      </div>
                    </ScrollArea>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Group
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
