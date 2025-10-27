
"use client";

import { useState, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import Link from 'next/link';
import { zodResolver } from "@hookform/resolvers/zod";
import { collection } from "firebase/firestore";
import { firestore, useCollection, useMemoFirebase } from "@/firebase";
import { Client, ActiveCaregiver, CareLogGroup, CareLog, CareLogTemplate } from "@/lib/types";
import { saveCareLogGroup, deleteCareLogGroup, reactivateCareLogGroup } from "@/lib/carelog-groups.actions";
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
import { Loader2, PlusCircle, Trash2, Edit, Users, RotateCw, FileText, ShieldCheck } from "lucide-react";

const careLogGroupSchema = z.object({
  groupId: z.string().optional(),
  clientId: z.string().min(1, "A client must be selected."),
  caregiverEmails: z.array(z.string().email()).min(1, "At least one caregiver must be selected."),
  careLogTemplateId: z.string().optional(),
  clientAccessEnabled: z.boolean().optional().default(false),
});

type CareLogGroupFormData = z.infer<typeof careLogGroupSchema>;

export function CareLogGroupAdmin() {
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CareLogGroup | null>(null);
  const { toast } = useToast();

  const clientsRef = useMemoFirebase(() => collection(firestore, 'Clients'), [firestore]);
  const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsRef);
  
  const clientsMap = useMemo(() => {
    if (!clients) return new Map();
    return new Map(clients.map(c => [c.id, c]));
  }, [clients]);

  const activeCaregiversRef = useMemoFirebase(() => collection(firestore, 'caregivers_active'), [firestore]);
  const { data: allCaregiversData, isLoading: caregiversLoading } = useCollection<ActiveCaregiver>(activeCaregiversRef);

  const careLogGroupsRef = useMemoFirebase(() => collection(firestore, 'carelog_groups'), [firestore]);
  const { data: careLogGroups, isLoading: groupsLoading } = useCollection<CareLogGroup>(careLogGroupsRef);
  
  const templatesRef = useMemoFirebase(() => collection(firestore, 'carelog_templates'), [firestore]);
  const { data: templates, isLoading: templatesLoading } = useCollection<CareLogTemplate>(templatesRef);
  
  const allCareLogsRef = useMemoFirebase(() => collection(firestore, 'carelogs'), [firestore]);
  const { data: allCareLogs, isLoading: logsLoading } = useCollection<CareLog>(allCareLogsRef);

  const activeClients = useMemo(() => clients?.filter(c => c.status === 'ACTIVE') || [], [clients]);
  
  const activeCaregivers = useMemo(() => {
    const filtered = allCaregiversData?.filter(c => c.status === 'ACTIVE' && c.Email) || [];
    return filtered.sort((a, b) => a.Name.localeCompare(b.Name));
  }, [allCaregiversData]);

  const sortedCareLogGroups = useMemo(() => {
    if (!careLogGroups) return [];
    return [...careLogGroups].sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [careLogGroups]);

  const form = useForm<CareLogGroupFormData>({
    resolver: zodResolver(careLogGroupSchema),
    defaultValues: {
      groupId: undefined,
      clientId: "",
      caregiverEmails: [],
      careLogTemplateId: "",
      clientAccessEnabled: false,
    },
  });

  const allCaregiversByEmailMap = useMemo(() => {
    if (!allCaregiversData) return new Map();
    // Maps email to the full caregiver object { Name, status }
    return new Map(allCaregiversData.map(cg => [cg.Email, { name: cg.Name, status: cg.status }]));
  }, [allCaregiversData]);

  const groupsWithLogs = useMemo(() => {
    if (!allCareLogs) return new Set();
    return new Set(allCareLogs.map(log => log.careLogGroupId));
  }, [allCareLogs]);


  const handleOpenModal = (group: CareLogGroup | null) => {
    setEditingGroup(group);
    if (group) {
      form.reset({
        groupId: group.id,
        clientId: group.clientId,
        caregiverEmails: group.caregiverEmails || [],
        careLogTemplateId: group.careLogTemplateId || "",
        clientAccessEnabled: group.clientAccessEnabled || false,
      });
    } else {
      form.reset({
        groupId: undefined,
        clientId: "",
        caregiverEmails: [],
        careLogTemplateId: "",
        clientAccessEnabled: false,
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

  const handleReactivate = (groupId: string) => {
    startTransition(async () => {
        const result = await reactivateCareLogGroup(groupId);
        if (result.error) {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        } else {
            toast({ title: "Success", description: result.message });
        }
    });
  };

  const isLoading = clientsLoading || caregiversLoading || groupsLoading || logsLoading || templatesLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>CareLog Group Administration</CardTitle>
            <CardDescription>Create, edit, or mark groups as inactive.</CardDescription>
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
            {sortedCareLogGroups && sortedCareLogGroups.length > 0 ? (
              sortedCareLogGroups.map(group => {
                const client = clientsMap.get(group.clientId);
                const isClientInactive = client?.status === 'INACTIVE';
                const isGroupInactive = group.status === 'INACTIVE';
                
                return (
                  <Card key={group.id} className={cn("flex flex-col sm:flex-row justify-between items-start sm:items-center p-4", (isClientInactive || isGroupInactive) && "bg-destructive/10 border-destructive/50")}>
                    <div className="flex-1 mb-4 sm:mb-0">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Users className={cn((isClientInactive || isGroupInactive) ? "text-destructive" : "text-accent")} />
                          {group.clientName}
                          {group.clientAccessEnabled && <ShieldCheck className="h-5 w-5 text-green-600" title="Client Access Enabled" />}
                          {(isClientInactive || isGroupInactive) && (
                              <Badge variant="destructive">{isGroupInactive ? 'GROUP INACTIVE' : 'CLIENT INACTIVE'}</Badge>
                          )}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                          {Array.isArray(group.caregiverEmails) && group.caregiverEmails.map(email => {
                              const caregiverInfo = allCaregiversByEmailMap.get(email);
                              const isInactive = caregiverInfo?.status === 'INACTIVE';
                              return (
                                <Badge key={email} variant={isInactive ? "destructive" : "secondary"} className={cn(isInactive && "line-through")}>
                                    {caregiverInfo?.name || email}
                                    {isInactive && ' (Inactive)'}
                                </Badge>
                              )
                          })}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {groupsWithLogs.has(group.id) && (
                            <Button asChild variant="outline" size="icon">
                                <Link href={`/staffing-admin/reports/carelog/${group.id}`}>
                                    <FileText className="h-4 w-4" />
                                </Link>
                            </Button>
                        )}
                        <Button variant="outline" size="icon" onClick={() => handleOpenModal(group)}><Edit className="h-4 w-4" /></Button>
                        {isGroupInactive ? (
                             <Button variant="outline" size="icon" onClick={() => handleReactivate(group.id)} disabled={isPending}>
                                <RotateCw className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Are you sure?</DialogTitle>
                                        <DialogDescription>This will mark the group for {group.clientName} as inactive. Caregivers will no longer be able to submit logs for this group. This action can be undone by reactivating the group.</DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                        <Button variant="destructive" onClick={() => handleDelete(group.id)} disabled={isPending}>
                                            {isPending && <Loader2 className="animate-spin mr-2"/>}
                                            Mark as Inactive
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                  </Card>
                );
              })
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
                name="careLogTemplateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CareLog Template</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {templates?.map(template => (
                          <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
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
               <FormField
                control={form.control}
                name="clientAccessEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Allow Client to Access CareLogs
                      </FormLabel>
                      <FormMessage />
                    </div>
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
