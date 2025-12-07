
"use client";

import { useState, useMemo, useTransition, useRef, useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useUser, firestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, query, where, addDoc, Timestamp } from "firebase/firestore";
import { CareLogGroup, Client, CareLog, CareLogTemplate } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { extractCareLogData } from "@/ai/flows/extract-carelog-flow";
import { Loader2, Users, Camera, Trash2, FileText, Clock, Upload, Info, Calendar as CalendarIcon, PlusCircle, MinusCircle, RefreshCw, Bath, Shirt, PersonStanding, Dumbbell, UserCog, Utensils, GlassWater, Pill, MessageSquare, BookOpen, Puzzle, Sun, Sparkles as HouseSparkles, Trash, Shirt as Laundry, Utensils as MealPrep, ShoppingCart, Smile, Droplet, Stethoscope, HeartPulse, ShieldAlert, AlertTriangle, Speaker, Notebook, Signature } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";
import { format, set } from "date-fns";
import { careLogSchema } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import { Label } from "./ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc } from 'firebase/firestore';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import SignatureCanvas from 'react-signature-canvas';


const initialTemplateData = {
    personal_care: [
        { activity: 'Bathing / Hygiene', icon: Bath, status: '', notes: '' },
        { activity: 'Dressing / Grooming', icon: Shirt, status: '', notes: '' },
        { activity: 'Toileting / Incontinence', icon: PersonStanding, status: '', notes: '' },
        { activity: 'Mobility / Transfers', icon: UserCog, status: '', notes: '' },
        { activity: 'Exercise / Physical Therapy', icon: Dumbbell, status: '', notes: '' },
    ],
    meals_hydration: [
        { meal: 'Breakfast', icon: Utensils, prepared: '', eaten: '', notes: '' },
        { meal: 'Lunch', icon: Utensils, prepared: '', eaten: '', notes: '' },
        { meal: 'Dinner', icon: Utensils, prepared: '', eaten: '', notes: '' },
        { meal: 'Fluids Intake', icon: GlassWater, prepared: '', eaten: '', notes: '' },
    ],
    medication_support: [{ time: '', medication: '', assisted: '', notes: '' }],
    companionship: [
        { activity: 'Conversation', icon: MessageSquare, duration: '', response: '' },
        { activity: 'Reading / Music / TV', icon: BookOpen, duration: '', response: '' },
        { activity: 'Games / Activities', icon: Puzzle, duration: '', response: '' },
        { activity: 'Outdoor Time', icon: Sun, duration: '', response: '' },
    ],
    household_tasks: [
        { task: 'Light Cleaning', icon: HouseSparkles, completed: '', notes: '' },
        { task: 'Laundry', icon: Laundry, completed: '', notes: '' },
        { task: 'Meal Preparation', icon: MealPrep, completed: '', notes: '' },
        { task: 'Errands / Shopping', icon: ShoppingCart, completed: '', notes: '' },
    ],
    client_condition: [
        { category: 'Mood / Behavior', icon: Smile, observation: '' },
        { category: 'Appetite', icon: Utensils, observation: '' },
        { category: 'Sleep', icon: Clock, observation: '' },
        { category: 'Mobility / Balance', icon: UserCog, observation: '' },
        { category: 'Skin Integrity', icon: Droplet, observation: '' },
        { category: 'Pain or Discomfort', icon: Stethoscope, observation: '' },
        { category: 'Other Health Concerns', icon: HeartPulse, observation: '' },
    ],
    communication: { familyNotified: '', familyReason: '', officeUpdate: '', incidentReport: '', incidentDescription: '', suppliesNeeded: '' },
    signature: { caregiverSignature: '' },
    logNotes: "",
};


const FormattedTemplateData = ({ data }: { data: any }) => {
    if (!data) return null;

    const renderSection = (title: string, items: any[], columns: { key: string, label: string }[]) => {
        if (!items || !Array.isArray(items)) return null;
        const filteredItems = items.filter(item => Object.values(item).some(val => val && val !== ''));
        if (filteredItems.length === 0) return null;

        return (
            <div className="space-y-2">
                <h4 className="font-semibold text-md">{title}</h4>
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredItems.map((item, index) => (
                            <TableRow key={index}>
                                {columns.map(col => <TableCell key={col.key}>{item[col.key] || '-'}</TableCell>)}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    };
    
    const renderSimpleSection = (title: string, item: any) => {
        if (!item || typeof item !== 'object') return null;
        const entries = Object.entries(item).filter(([_, value]) => value);
        if (entries.length === 0) return null;
        
        return (
             <div className="space-y-2">
                <h4 className="font-semibold text-md">{title}</h4>
                <div className="p-3 bg-muted/50 rounded-md grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    {entries.map(([key, value]) => (
                        <div key={key} className="flex justify-between border-b pb-1">
                             <span className="font-medium capitalize text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}:</span>
                             <span className='text-right'>{String(value)}</span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 text-sm pt-4 mt-4 border-t">
            {renderSection('Personal Care', data.personal_care, [
                { key: 'activity', label: 'Activity' },
                { key: 'status', label: 'Status' },
                { key: 'notes', label: 'Notes' },
            ])}
            {renderSection('Meals & Hydration', data.meals_hydration, [
                { key: 'meal', label: 'Meal' },
                { key: 'prepared', label: 'Prepared' },
                { key: 'eaten', label: 'Eaten' },
                { key: 'notes', label: 'Notes' },
            ])}
            {renderSection('Medication Support', data.medication_support, [
                { key: 'time', label: 'Time' },
                { key: 'medication', label: 'Medication' },
                { key: 'assisted', label: 'Assisted' },
                { key: 'notes', label: 'Notes' },
            ])}
            {renderSection('Companionship & Engagement', data.companionship, [
                { key: 'activity', label: 'Activity' },
                { key: 'duration', label: 'Duration' },
                { key: 'response', label: 'Response' },
            ])}
            {renderSection('Household Tasks', data.household_tasks, [
                { key: 'task', label: 'Task' },
                { key: 'completed', label: 'Completed' },
                { key: 'notes', label: 'Notes' },
            ])}
            {renderSection('Client Condition & Observations', data.client_condition, [
                { key: 'category', label: 'Category' },
                { key: 'observation', label: 'Observation' },
            ])}
            {renderSimpleSection('Communication & Follow-Up', data.communication)}

            {data.signature?.caregiverSignature && (
                 <div className="space-y-2">
                    <h4 className="font-semibold text-md">Caregiver Signature</h4>
                    <div className="p-3 bg-muted/50 rounded-md flex justify-center">
                        <Image src={data.signature.caregiverSignature} alt="Caregiver Signature" width={200} height={100} className="object-contain" />
                    </div>
                </div>
            )}
        </div>
    );
};


export default function CareLogClient() {
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isExtracting, startExtractTransition] = useTransition();

  const [selectedGroup, setSelectedGroup] = useState<CareLogGroup | null>(null);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  
  const [shiftDate, setShiftDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  
  const [extractedShiftDateTime, setExtractedShiftDateTime] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignatureCanvas>(null);

  const form = useForm({ defaultValues: initialTemplateData });
  const { control, register, handleSubmit, reset, getValues, watch, setValue } = form;
  const logNotes = watch('logNotes');
  
  const { fields: medFields, append: appendMed, remove: removeMed } = useFieldArray({ control, name: "medication_support" });

  const clientsRef = useMemoFirebase(() => collection(firestore, 'Clients'), []);
  const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsRef);

  const clientsMap = useMemo(() => {
    if (!clients) return new Map();
    return new Map(clients.map(c => [c.id, c]));
  }, [clients]);

  const careLogGroupsQueryRef = useMemoFirebase(
    () => user?.email ? query(collection(firestore, 'carelog_groups'), where('caregiverEmails', 'array-contains', user.email)) : null,
    [user]
  );
  const { data: allCareLogGroups, isLoading: groupsLoading } = useCollection<CareLogGroup>(careLogGroupsQueryRef);

  const templateRef = useMemoFirebase(() => selectedGroup?.careLogTemplateId ? doc(firestore, 'carelog_templates', selectedGroup.careLogTemplateId) : null, [selectedGroup]);
  const { data: template, isLoading: templateLoading } = useDoc<CareLogTemplate>(templateRef);

  const careLogGroups = useMemo(() => {
    if (!allCareLogGroups || !clientsMap) return [];
    return allCareLogGroups.filter(group => {
        const client = clientsMap.get(group.clientId);
        const isClientActive = client && client.status === 'Active';
        const isGroupActive = !group.status || group.status === 'Active';
        return isClientActive && isGroupActive;
    });
  }, [allCareLogGroups, clientsMap]);


  const careLogsRef = useMemoFirebase(
    () => selectedGroup ? query(collection(firestore, 'carelogs'), where('careLogGroupId', '==', selectedGroup.id)) : null,
    [selectedGroup]
  );
  const { data: careLogsData, isLoading: logsLoading } = useCollection<CareLog>(careLogsRef);
  
  const careLogs = useMemo(() => {
    if (!careLogsData) return [];
    const logsWithDates = careLogsData.map(log => ({
      ...log,
      shiftDateTimeJS: log.shiftDateTime ? (log.shiftDateTime as any).toDate() : new Date(0)
    }));
    logsWithDates.sort((a, b) => b.shiftDateTimeJS.getTime() - a.shiftDateTimeJS.getTime());
    return logsWithDates;
  }, [careLogsData]);

  const resetFormState = () => {
    reset(initialTemplateData);
    if (sigPadRef.current) {
        sigPadRef.current.clear();
    }
    setScannedImage(null);
    setShowCamera(false);
    setExtractedShiftDateTime(null);
    setShiftDate(new Date());
    setStartTime("09:00");
    setEndTime("17:00");
  }

  const handleGroupSelect = (groupId: string) => {
    const group = careLogGroups?.find(g => g.id === groupId) || null;
    setSelectedGroup(group);
    resetFormState();
  };

  const handleScanClick = () => {
    setShowCamera(true);
  };

  useEffect(() => {
    if (showCamera) {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          setHasCameraPermission(true);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings to use this app.',
          });
        }
      };

      getCameraPermission();
    } else {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    }
  }, [showCamera, toast]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            const dataUrl = canvas.toDataURL('image/jpeg');
            setScannedImage(dataUrl);

            startExtractTransition(async () => {
                try {
                    const result = await extractCareLogData({ imageDataUri: dataUrl });
                    reset({ ...getValues(), logNotes: result.extractedText });
                    setExtractedShiftDateTime(result.shiftDateTime);
                     toast({
                        title: "Text Extracted",
                        description: "AI has processed the log. Please review the details.",
                    });
                } catch(e: any) {
                    toast({
                        title: "Extraction Failed",
                        description: `Could not read the text from the image: ${e.message}`,
                        variant: "destructive",
                    });
                }
            });
        }
        setShowCamera(false);
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
    }
  };

  const onSubmit = (data: any) => {
    if (!selectedGroup || !user) {
        toast({ title: "Error", description: "Please select a client group first.", variant: "destructive" });
        return;
    }
    
    startSubmitTransition(async () => {
        let finalShiftDateTime: string | null = null;
        let finalShiftEndDateTime: string | null = null;
        
        if (scannedImage) {
             finalShiftDateTime = extractedShiftDateTime;
            if (!finalShiftDateTime && logNotes) {
                try {
                    const result = await extractCareLogData({ textContent: logNotes });
                    finalShiftDateTime = result.shiftDateTime;
                } catch (e) {}
            }
        } else {
             if (!shiftDate || !startTime || !endTime) {
                toast({ title: "Missing Information", description: "Please provide the shift date, start time, and end time.", variant: "destructive" });
                return;
            }
            const [startHours, startMinutes] = startTime.split(':').map(Number);
            const startDate = set(shiftDate, { hours: startHours, minutes: startMinutes, seconds: 0, milliseconds: 0 });
            finalShiftDateTime = startDate.toISOString();

            const [endHours, endMinutes] = endTime.split(':').map(Number);
            const endDate = set(shiftDate, { hours: endHours, minutes: endMinutes, seconds: 0, milliseconds: 0 });
            finalShiftEndDateTime = endDate.toISOString();
        }
        
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            data.signature.caregiverSignature = sigPadRef.current.toDataURL();
        }
        
        submitLog(finalShiftDateTime, finalShiftEndDateTime, data);
    });
  };
  
  const submitLog = (startIso: string | null, endIso: string | null, formData: any) => {
     if (!selectedGroup || !user || !user.email) return;

     // Create a plain object from formData to remove any symbols or methods from react-hook-form
     const plainFormData = JSON.parse(JSON.stringify(formData));
     
     const {logNotes, ...templateData} = plainFormData;

     const logData = {
        careLogGroupId: selectedGroup.id,
        caregiverId: user.email,
        caregiverName: user.displayName || user.email || 'Unknown Caregiver',
        logNotes: logNotes || "",
        templateData: template ? templateData : null,
        logImages: scannedImage ? [scannedImage] : [],
        shiftDateTime: startIso ? Timestamp.fromDate(new Date(startIso)) : Timestamp.now(),
        shiftEndDateTime: endIso ? Timestamp.fromDate(new Date(endIso)) : null,
        createdAt: Timestamp.now(),
        lastUpdatedAt: Timestamp.now(),
      };
      
      const validation = careLogSchema.safeParse(logData);

      if (!validation.success) {
          toast({
              title: "Validation Error",
              description: validation.error.errors.map(e => e.message).join(', '),
              variant: "destructive"
          });
          return;
      }
      
      const colRef = collection(firestore, "carelogs");
      
      addDoc(colRef, validation.data).then(() => {
          toast({ title: "Success", description: "Your care log has been submitted."});
          handleGroupSelect(selectedGroup.id);
      }).catch(serverError => {
          const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: "create",
            requestResourceData: validation.data,
          });
          errorEmitter.emit("permission-error", permissionError);
      });
  }
  
  const clearSignature = () => {
    if (sigPadRef.current) {
        sigPadRef.current.clear();
        setValue('signature.caregiverSignature', '');
    }
  }

  const isLoading = isUserLoading || groupsLoading || clientsLoading || templateLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Care Log Dashboard</CardTitle>
          <CardDescription>Select a client to post a new care log or view existing logs.</CardDescription>
        </CardHeader>
        <CardContent>
            {careLogGroups && careLogGroups.length > 0 ? (
                <Select onValueChange={handleGroupSelect} value={selectedGroup?.id || ""}>
                    <SelectTrigger className="w-full max-w-md">
                        <SelectValue placeholder="Select a client group..." />
                    </SelectTrigger>
                    <SelectContent>
                        {careLogGroups.map(group => (
                            <SelectItem key={group.id} value={group.id}>
                                {clientsMap.get(group.clientId)?.["Client Name"] || group.clientName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : (
                 <Alert>
                    <Users className="h-4 w-4" />
                    <AlertTitle>No Assigned Clients</AlertTitle>
                    <AlertDescription>
                        You are not currently assigned to any active client care groups. Please contact your administrator.
                    </AlertDescription>
                </Alert>
            )}
        </CardContent>
      </Card>
      
      {selectedGroup && (
        <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
              <CardHeader>
                   <CardTitle>Post Care Log for {selectedGroup.clientName}</CardTitle>
                   <CardDescription>Add notes and scan any written documents for your shift.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                  
                  {showCamera ? (
                      <div className="space-y-4">
                          <video ref={videoRef} className="w-full aspect-video rounded-md bg-black" autoPlay playsInline muted />
                           <canvas ref={canvasRef} className="hidden" />
                          {hasCameraPermission === false && (
                              <Alert variant="destructive">
                                  <AlertTitle>Camera Access Required</AlertTitle>
                                  <AlertDescription>
                                  Please allow camera access in your browser settings to use this feature.
                                  </AlertDescription>
                              </Alert>
                          )}
                          <div className="flex justify-center gap-4">
                              <Button type="button" onClick={handleCapture} disabled={hasCameraPermission === false}><Camera className="mr-2" /> Capture Image</Button>
                              <Button type="button" variant="outline" onClick={() => setShowCamera(false)}>Cancel</Button>
                          </div>
                      </div>
                  ) : (
                       <div className="space-y-4">
                            {!scannedImage && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="shift-date">Shift Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button id="shift-date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !shiftDate && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {shiftDate ? format(shiftDate, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={shiftDate} onSelect={setShiftDate} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="start-time">Start Time</Label>
                                        <Input id="start-time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="end-time">End Time</Label>
                                        <Input id="end-time" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                                    </div>
                                </div>
                            )}
                          <Textarea 
                              placeholder="Enter your shift notes here, or scan a document to have the AI fill this in."
                              {...register('logNotes')}
                              rows={8}
                          />

                          {isExtracting && (
                              <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="animate-spin mr-2"/> AI is reading the document...</div>
                          )}

                          {extractedShiftDateTime && (
                            <Alert>
                                <Clock className="h-4 w-4" />
                                <AlertTitle>Extracted Shift Time</AlertTitle>
                                <AlertDescription>
                                    {format(new Date(extractedShiftDateTime), 'PPPPpp')}
                                </AlertDescription>
                            </Alert>
                          )}

                          {scannedImage && (
                              <div className="relative w-full max-w-sm">
                                  <Image src={scannedImage} alt="Scanned document" width={400} height={300} className="rounded-md border" />
                                  <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => { setScannedImage(null); reset({ ...getValues(), logNotes: '' }); setExtractedShiftDateTime(null);}}>
                                      <Trash2 className="h-4 w-4" />
                                  </Button>
                              </div>
                          )}
                           
                           <div className="flex flex-wrap gap-4 items-center">
                              <Button type="button" onClick={handleScanClick} variant="outline" disabled={isExtracting}>
                                  <Camera className="mr-2" /> Scan Written Log
                              </Button>
                               <Alert variant="default" className="flex-1 min-w-[280px]">
                                <Info className="h-4 w-4"/>
                                <AlertTitle className="text-xs">How it works</AlertTitle>
                                <AlertDescription className="text-xs">
                                  If you don&apos;t scan a log, the AI will try to find a date and time from your typed notes upon submission.
                                </AlertDescription>
                              </Alert>
                           </div>

                      </div>
                  )}
                
                  {template && (
                     <Accordion type="multiple" className="w-full space-y-4">
                        {template.subsections.includes('personal_care') && (
                            <AccordionItem value="personal_care">
                                <AccordionTrigger>Personal Care</AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="py-2">Activity</TableHead><TableHead className="py-2">Status</TableHead><TableHead className="py-2">Notes</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                        {initialTemplateData.personal_care.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="py-2 flex items-center gap-2"><item.icon className="h-4 w-4 text-muted-foreground" /> {item.activity}</TableCell>
                                                <TableCell className="py-2">
                                                    <FormField
                                                        control={control}
                                                        name={`personal_care.${index}.status`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormControl>
                                                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-2">
                                                                        {['Completed', 'Partial', 'Declined'].map(val => (
                                                                            <FormItem key={val} className="flex items-center space-x-2 space-y-0">
                                                                                <FormControl><RadioGroupItem value={val} id={`${field.name}-${val}`} /></FormControl>
                                                                                <Label htmlFor={`${field.name}-${val}`} className="font-normal">{val}</Label>
                                                                            </FormItem>
                                                                        ))}
                                                                    </RadioGroup>
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell className="py-2"><Input {...register(`personal_care.${index}.notes`)}/></TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        )}
                         {template.subsections.includes('meals_hydration') && (
                            <AccordionItem value="meals_hydration">
                                <AccordionTrigger>Meals & Hydration</AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="py-2">Meal</TableHead><TableHead className="py-2">Prepared</TableHead><TableHead className="py-2">Eaten</TableHead><TableHead className="py-2">Notes</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                        {initialTemplateData.meals_hydration.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="py-2 flex items-center gap-2"><item.icon className="h-4 w-4 text-muted-foreground" />{item.meal}</TableCell>
                                                <TableCell className="py-2">
                                                     <FormField control={control} name={`meals_hydration.${index}.prepared`} render={({field}) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes" id={`${field.name}-yes`} /></FormControl><Label htmlFor={`${field.name}-yes`} className="font-normal">Yes</Label></FormItem>
                                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No" id={`${field.name}-no`} /></FormControl><Label htmlFor={`${field.name}-no`} className="font-normal">No</Label></FormItem>
                                                                </RadioGroup>
                                                            </FormControl>
                                                        </FormItem>
                                                    )}/>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                     <FormField control={control} name={`meals_hydration.${index}.eaten`} render={({field}) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="All" id={`${field.name}-all`}/></FormControl><Label htmlFor={`${field.name}-all`} className="font-normal">All</Label></FormItem>
                                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Half" id={`${field.name}-half`}/></FormControl><Label htmlFor={`${field.name}-half`} className="font-normal">Half</Label></FormItem>
                                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="None" id={`${field.name}-none`}/></FormControl><Label htmlFor={`${field.name}-none`} className="font-normal">None</Label></FormItem>
                                                                </RadioGroup>
                                                            </FormControl>
                                                        </FormItem>
                                                    )}/>
                                                </TableCell>
                                                <TableCell className="py-2"><Input {...register(`meals_hydration.${index}.notes`)}/></TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        )}
                        {template.subsections.includes('medication_support') && (
                             <AccordionItem value="medication_support">
                                <AccordionTrigger>Medication Support</AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="py-2">Time</TableHead><TableHead className="py-2">Medication</TableHead><TableHead className="py-2">Assisted</TableHead><TableHead className="py-2">Notes</TableHead><TableHead className="py-2"></TableHead></TableRow></TableHeader>
                                        <TableBody>
                                        {medFields.map((item, index) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="py-2"><Input type="time" {...register(`medication_support.${index}.time`)}/></TableCell>
                                                <TableCell className="py-2"><Input {...register(`medication_support.${index}.medication`)}/></TableCell>
                                                <TableCell className="py-2">
                                                    <FormField control={control} name={`medication_support.${index}.assisted`} render={({field}) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes" id={`${field.name}-yes`}/></FormControl><Label htmlFor={`${field.name}-yes`} className="font-normal">Yes</Label></FormItem>
                                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No" id={`${field.name}-no`} /></FormControl><Label htmlFor={`${field.name}-no`} className="font-normal">No</Label></FormItem>
                                                                </RadioGroup>
                                                            </FormControl>
                                                        </FormItem>
                                                    )}/>
                                                </TableCell>
                                                <TableCell className="py-2"><Input {...register(`medication_support.${index}.notes`)}/></TableCell>
                                                <TableCell className="py-2"><Button type="button" variant="ghost" size="icon" onClick={() => removeMed(index)}><MinusCircle className="text-destructive"/></Button></TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                    <Button type="button" size="sm" variant="outline" onClick={() => appendMed({ time: '', medication: '', assisted: '', notes: '' })} className="mt-2"><PlusCircle className="mr-2"/>Add Row</Button>
                                </AccordionContent>
                            </AccordionItem>
                        )}
                        {template.subsections.includes('companionship') && (
                            <AccordionItem value="companionship">
                                <AccordionTrigger>Companionship & Mental Engagement</AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="py-2">Activity</TableHead><TableHead className="py-2">Duration</TableHead><TableHead className="py-2">Client Response</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                        {initialTemplateData.companionship.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="py-2 flex items-center gap-2"><item.icon className="h-4 w-4 text-muted-foreground" />{item.activity}</TableCell>
                                                <TableCell className="py-2"><Input {...register(`companionship.${index}.duration`)}/></TableCell>
                                                <TableCell className="py-2"><Input {...register(`companionship.${index}.response`)}/></TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        )}
                         {template.subsections.includes('household_tasks') && (
                             <AccordionItem value="household_tasks">
                                <AccordionTrigger>Household Tasks</AccordionTrigger>
                                <AccordionContent>
                                     <Table>
                                        <TableHeader><TableRow><TableHead className="py-2">Task</TableHead><TableHead className="py-2">Completed</TableHead><TableHead className="py-2">Notes</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                        {initialTemplateData.household_tasks.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="py-2 flex items-center gap-2"><item.icon className="h-4 w-4 text-muted-foreground" />{item.task}</TableCell>
                                                <TableCell className="py-2">
                                                    <FormField control={control} name={`household_tasks.${index}.completed`} render={({field}) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes" id={`${field.name}-yes`}/></FormControl><Label htmlFor={`${field.name}-yes`} className="font-normal">Yes</Label></FormItem>
                                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No" id={`${field.name}-no`}/></FormControl><Label htmlFor={`${field.name}-no`} className="font-normal">No</Label></FormItem>
                                                                </RadioGroup>
                                                            </FormControl>
                                                        </FormItem>
                                                    )}/>
                                                </TableCell>
                                                <TableCell className="py-2"><Input {...register(`household_tasks.${index}.notes`)}/></TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        )}
                        {template.subsections.includes('client_condition') && (
                            <AccordionItem value="client_condition">
                                <AccordionTrigger>Client Condition & Observations</AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="py-2">Category</TableHead><TableHead className="py-2">Observation / Notes</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                        {initialTemplateData.client_condition.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="py-2 flex items-center gap-2"><item.icon className="h-4 w-4 text-muted-foreground" />{item.category}</TableCell>
                                                <TableCell className="py-2"><Textarea {...register(`client_condition.${index}.observation`)}/></TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        )}
                        {template.subsections.includes('communication') && (
                            <AccordionItem value="communication">
                                <AccordionTrigger>Communication & Follow-Up</AccordionTrigger>
                                <AccordionContent className="space-y-4">
                                     <FormField control={control} name="communication.familyNotified" render={({field}) => (
                                        <FormItem><FormLabel>Family Notified</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                                <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes" id={`${field.name}-yes`}/></FormControl><Label htmlFor={`${field.name}-yes`} className="font-normal">Yes</Label></FormItem>
                                                <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No" id={`${field.name}-no`}/></FormControl><Label htmlFor={`${field.name}-no`} className="font-normal">No</Label></FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        </FormItem>
                                    )}/>
                                    <Input placeholder="Reason if No..." {...register("communication.familyReason")}/>
                                    <FormField control={control} name="communication.officeUpdate" render={({field}) => (
                                        <FormItem><FormLabel>Office / Nurse Update</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                                <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes" id={`${field.name}-office-yes`}/></FormControl><Label htmlFor={`${field.name}-office-yes`} className="font-normal">Yes</Label></FormItem>
                                                <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No" id={`${field.name}-office-no`}/></FormControl><Label htmlFor={`${field.name}-office-no`} className="font-normal">No</Label></FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        </FormItem>
                                    )}/>
                                    <FormField control={control} name="communication.incidentReport" render={({field}) => (
                                        <FormItem><FormLabel>Incident Report Filed</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                                <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes" id={`${field.name}-incident-yes`}/></FormControl><Label htmlFor={`${field.name}-incident-yes`} className="font-normal">Yes</Label></FormItem>
                                                <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No" id={`${field.name}-incident-no`}/></FormControl><Label htmlFor={`${field.name}-incident-no`} className="font-normal">No</Label></FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        </FormItem>
                                    )}/>
                                    <Textarea placeholder="Description of incident..." {...register("communication.incidentDescription")}/>
                                    <Textarea placeholder="Supplies needed..." {...register("communication.suppliesNeeded")}/>
                                </AccordionContent>
                            </AccordionItem>
                        )}
                        {template.subsections.includes('signature') && (
                             <AccordionItem value="signature">
                                <AccordionTrigger>Caregiver Signature</AccordionTrigger>
                                <AccordionContent>
                                    <div className="relative w-full h-40 rounded-md border">
                                        <SignatureCanvas
                                            ref={sigPadRef}
                                            penColor='black'
                                            canvasProps={{className: 'w-full h-full'}}
                                            onEnd={() => {
                                                if (sigPadRef.current) {
                                                    setValue('signature.caregiverSignature', sigPadRef.current.toDataURL());
                                                }
                                            }}
                                        />
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="mt-2">
                                        <RefreshCw className="mr-2" />
                                        Clear Signature
                                    </Button>
                                </AccordionContent>
                            </AccordionItem>
                        )}
                     </Accordion>
                  )}

                  <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={isSubmitting || isExtracting}>
                          {isSubmitting || isExtracting ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                              <Upload className="mr-2 h-4 w-4" />
                          )}
                          Submit Care Log
                      </Button>
                  </div>
              </CardContent>
          </Card>
          
          <Card>
              <CardHeader>
                  <CardTitle>Recent Logs for {selectedGroup.clientName}</CardTitle>
                  <CardDescription>A running log of submitted care notes, sorted by the most recent shift.</CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                   <div className="flex items-center justify-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin text-accent" />
                   </div>
                ) : careLogs && careLogs.length > 0 ? (
                    <div className="space-y-6">
                        {careLogs.map(log => (
                          <Card key={log.id} className="bg-background/50">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                  <FileText className="text-accent" />
                                  Shift: {log.shiftDateTime ? format((log.shiftDateTime as any).toDate(), 'PPpp') : 'N/A'}
                                </CardTitle>
                                <CardDescription>
                                  Posted by {log.caregiverName} on {log.createdAt ? format((log.createdAt as any).toDate(), 'PPp') : 'N/A'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {log.logNotes && <p className="whitespace-pre-wrap text-sm">{log.logNotes}</p>}
                              
                              {log.templateData && <FormattedTemplateData data={log.templateData} />}

                              {log.logImages && log.logImages.length > 0 && (
                                <div className="flex gap-4 pt-2">
                                  {log.logImages.map((img, index) => (
                                      <Image key={index} src={img} alt={`Log image ${index+1}`} width={200} height={150} className="rounded-md border object-cover" />
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                ) : (
                  <div className="text-center py-10 border-dashed border-2 rounded-lg">
                      <h3 className="text-lg font-medium text-gray-900">No Logs Found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">There are no care logs for this client yet.</p>
                  </div>
                )}
              </CardContent>
          </Card>
        </form>
        </Form>
      )}
    </div>
  );
}
