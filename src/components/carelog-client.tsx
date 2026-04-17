
"use client";

import React, { useState, useMemo, useTransition, useRef, useEffect } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, query, where, addDoc, Timestamp } from "firebase/firestore";
import { CareLogGroup, Client, CareLog, CareLogTemplate, allstarVisitSchema, careLogFormSchema, careLogSchema } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { extractCareLogData } from "@/ai/flows/extract-carelog-flow";
import { Loader2, Users, Camera, Trash2, FileText, Clock, Upload, Info, Calendar as CalendarIcon, Edit2, RefreshCw, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";
import { format, set, parse, isValid } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc } from 'firebase/firestore';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import SignatureCanvas from 'react-signature-canvas';
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DateInput } from '@/components/ui/date-input';

const SignaturePadModal = ({
    isOpen,
    onClose,
    onSave,
    signatureData,
    title
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
    signatureData: string | undefined | null;
    title: string;
}) => {
    const sigPadRef = React.useRef<SignatureCanvas>(null);

    React.useEffect(() => {
        if (isOpen && sigPadRef.current) {
            sigPadRef.current.clear();
            if (signatureData) {
                sigPadRef.current.fromDataURL(signatureData);
            }
        }
    }, [isOpen, signatureData]);
    
    const handleClear = () => sigPadRef.current?.clear();
    
    const handleDone = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            onSave(sigPadRef.current.toDataURL('image/png'));
        } else {
             onSave(""); 
        }
        onClose();
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] h-[400px] flex flex-col p-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="flex-grow p-2">
                    <SignatureCanvas
                        ref={sigPadRef}
                        penColor='black'
                        canvasProps={{ className: 'w-full h-full bg-white rounded-md' }}
                    />
                </div>
                <div className="flex justify-between p-4 border-t">
                    <Button type="button" variant="ghost" onClick={handleClear}><RefreshCw className="mr-2"/>Clear</Button>
                    <Button type="button" onClick={handleDone}>Done</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const FormattedTemplateData = ({ data }: { data: any }) => {
    if (!data) return null;
    
    // Check if it's Allstar data by looking for a unique field
    if (data.allstar_route_sheet) {
        const visit = data.allstar_route_sheet;
        return (
            <div className="pt-4 mt-4 border-t">
                <h4 className="font-semibold text-md">Allstar Health Providers Visit</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm">
                    <p><strong>Patient:</strong> {visit.patientName}</p>
                    <p><strong>Service Date:</strong> {visit.serviceDate}</p>
                    <p><strong>Time In:</strong> {visit.timeIn}</p>
                    <p><strong>Time Out:</strong> {visit.timeOut}</p>
                    <p><strong>Visit Type:</strong> {visit.typeOfVisit}</p>
                </div>
                {visit.patientSignature && (
                    <div className="mt-4">
                        <h5 className="font-semibold">Patient Signature</h5>
                        <div className="p-2 border rounded-md bg-muted/50 inline-block">
                             <Image src={visit.patientSignature} alt="Patient Signature" width={150} height={75} className="object-contain" />
                        </div>
                    </div>
                )}
            </div>
        );
    }
    // Handle other templates...
    return <p className="text-sm text-muted-foreground mt-2">Structured data viewing for this template is not implemented yet.</p>;
};


export default function CareLogClient() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isExtracting, startExtractTransition] = useTransition();

  const [selectedGroup, setSelectedGroup] = useState<CareLogGroup | null>(null);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  
  const [extractedShiftDateTime, setExtractedShiftDateTime] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const [employeeDetails, setEmployeeDetails] = useState<{
      employeeName: string;
      title: 'Caregiver' | 'HCA' | undefined;
      employeeSignature: string;
  }>({
      employeeName: user?.displayName || '',
      title: undefined,
      employeeSignature: '',
  });
  const [isEmployeeDetailsSet, setIsEmployeeDetailsSet] = useState(false);
  const [activeSignature, setActiveSignature] = useState<string | null>(null);


  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const clientsRef = useMemoFirebase(() => firestore ? collection(firestore, 'Clients') : null, [firestore]);
  const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsRef);

  const clientsMap = useMemo(() => {
    if (!clients) return new Map();
    return new Map(clients.map(c => [c.id, c]));
  }, [clients]);

  const careLogGroupsQueryRef = useMemoFirebase(
    () => user?.email && firestore ? query(collection(firestore, 'carelog_groups'), where('caregiverEmails', 'array-contains', user.email)) : null,
    [user, firestore]
  );
  const { data: allCareLogGroups, isLoading: groupsLoading } = useCollection<CareLogGroup>(careLogGroupsQueryRef);

  const templateRef = useMemoFirebase(() => selectedGroup?.careLogTemplateId && firestore ? doc(firestore, 'carelog_templates', selectedGroup.careLogTemplateId) : null, [selectedGroup, firestore]);
  const { data: template, isLoading: templateLoading } = useDoc<CareLogTemplate>(templateRef);
  
  const isAllstarTemplate = useMemo(() => template?.subsections.includes('allstar_health_providers') || false, [template]);

  const form = useForm({
    resolver: zodResolver(isAllstarTemplate ? allstarVisitSchema : careLogFormSchema),
  });
  const { control, register, handleSubmit, reset, getValues, setValue } = form;


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
    () => selectedGroup && firestore ? query(collection(firestore, 'carelogs'), where('careLogGroupId', '==', selectedGroup.id)) : null,
    [selectedGroup, firestore]
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

  useEffect(() => {
    if (selectedGroup) {
      const isAllstar = template?.subsections.includes('allstar_health_providers') || false;
      
      const defaultValues = isAllstar ? {
        serviceDate: '',
        timeIn: '',
        timeOut: '',
        patientName: selectedGroup.clientName || '',
        patientSignature: '',
        typeOfVisit: undefined, 
      } : {
        logNotes: '',
      };
      
      reset(defaultValues as any);
      setScannedImage(null);
      setShowCamera(false);
      setExtractedShiftDateTime(null);
      setIsEmployeeDetailsSet(false);
      setEmployeeDetails({
        employeeName: user?.displayName || '',
        title: undefined,
        employeeSignature: '',
      });
    }
  }, [selectedGroup, template, reset, user?.displayName]);

  const handleGroupSelect = (groupId: string) => {
    const group = careLogGroups?.find(g => g.id === groupId) || null;
    setSelectedGroup(group);
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
                    setValue('logNotes', result.extractedText);
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
    
    if (isAllstarTemplate && !isEmployeeDetailsSet) {
        toast({ title: "Employee Details Required", description: "Please confirm your title and signature before submitting a visit.", variant: "destructive" });
        return;
    }

    startSubmitTransition(async () => {
        let finalShiftDateTime: Date | null = null;
        
        if (isAllstarTemplate && data.serviceDate && data.timeIn) {
            const date = parse(data.serviceDate, 'MM/dd/yyyy', new Date());
            const [hours, minutes] = data.timeIn.split(':').map(Number);
            if (isValid(date)) {
                finalShiftDateTime = set(date, { hours, minutes });
            }
        }
        
        submitLog(finalShiftDateTime, data);
    });
  };
  
  const submitLog = (shiftDateTime: Date | null, visitData: any) => {
     if (!selectedGroup || !user || !user.email) return;

     let templateDataPayload;
     if (isAllstarTemplate) {
        templateDataPayload = { allstar_route_sheet: { ...visitData, ...employeeDetails } };
     } else {
        templateDataPayload = template ? { ...visitData } : null;
     }

     const logData = {
        careLogGroupId: selectedGroup.id,
        caregiverId: user.email,
        caregiverName: user.displayName || user.email || 'Unknown Caregiver',
        logNotes: isAllstarTemplate ? "" : visitData.logNotes || "",
        templateData: templateDataPayload,
        logImages: scannedImage ? [scannedImage] : [],
        shiftDateTime: shiftDateTime ? Timestamp.fromDate(shiftDateTime) : Timestamp.now(),
        shiftEndDateTime: null, // No longer tracking end time for single visits
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
      
      const dataToSave = validation.data;

      if (isAllstarTemplate && dataToSave.templateData?.allstar_route_sheet?.typeOfVisit === undefined) {
        dataToSave.templateData.allstar_route_sheet.typeOfVisit = null;
      }
      
      const colRef = collection(firestore, "carelogs");
      
      addDoc(colRef, dataToSave).then(() => {
          toast({ title: "Success", description: "Your care log has been submitted."});
          // For Allstar, only reset visit-specific fields
          if (isAllstarTemplate) {
              reset({ 
                serviceDate: '', 
                timeIn: '', 
                timeOut: '', 
                patientName: selectedGroup?.clientName || '',
                patientSignature: '', 
                typeOfVisit: undefined 
              });
          } else {
              reset({ logNotes: '' });
              setScannedImage(null);
              setShowCamera(false);
              setExtractedShiftDateTime(null);
          }
      }).catch(serverError => {
          const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: "create",
            requestResourceData: dataToSave,
          });
          errorEmitter.emit("permission-error", permissionError);
      });
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
        <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
              <CardHeader>
                   <CardTitle>Post Care Log for {selectedGroup.clientName}</CardTitle>
                   <CardDescription>
                     {isAllstarTemplate ? "Confirm your details once, then add each visit." : "Add notes and scan any written documents for your shift."}
                   </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isAllstarTemplate ? (
                  <>
                    <Card>
                        <CardHeader><CardTitle>Employee Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <div className="space-y-2">
                                    <Label>Employee Name</Label>
                                    <Input value={employeeDetails.employeeName} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>Title</Label>
                                    <Select 
                                        onValueChange={(value) => setEmployeeDetails(prev => ({...prev, title: value as "Caregiver" | "HCA"}))} 
                                        value={employeeDetails.title}
                                        disabled={isEmployeeDetailsSet}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select a title" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Caregiver">Caregiver</SelectItem>
                                            <SelectItem value="HCA">HCA</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Employee Signature</Label>
                                <div className="relative rounded-md border bg-muted/30 h-24 flex items-center justify-center">
                                    {employeeDetails.employeeSignature ? (
                                        <Image src={employeeDetails.employeeSignature} alt="Signature" layout="fill" objectFit="contain" />
                                    ) : <span className="text-muted-foreground">Not Signed</span>}
                                    {!isEmployeeDetailsSet && (
                                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => setActiveSignature('employee')}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                             {!isEmployeeDetailsSet ? (
                                <Button type="button" onClick={() => {
                                    if(employeeDetails.title && employeeDetails.employeeSignature) {
                                        setIsEmployeeDetailsSet(true);
                                        toast({ title: "Details Confirmed", description: "You can now add visits." });
                                    } else {
                                        toast({ title: "Incomplete Details", description: "Please provide both title and signature.", variant: "destructive" });
                                    }
                                }}>Confirm Details</Button>
                            ) : (
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="h-5 w-5"/>
                                    <p>Your details are confirmed for this session.</p>
                                    <Button variant="link" size="sm" onClick={() => setIsEmployeeDetailsSet(false)}>(Edit)</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {isEmployeeDetailsSet && (
                         <div className="space-y-6 pt-4 border-t">
                            <h3 className="text-lg font-semibold">Add a Visit</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField control={control} name="serviceDate" render={({ field }) => ( <FormItem><FormLabel>Service Date</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={control} name="timeIn" render={({ field }) => ( <FormItem><FormLabel>Time In</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={control} name="timeOut" render={({ field }) => ( <FormItem><FormLabel>Time Out</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <FormField control={control} name="patientName" render={({ field }) => ( <FormItem><FormLabel>Patient Name</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={control} name="typeOfVisit" render={({ field }) => ( <FormItem><FormLabel>Type of Visit</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select visit type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Follow-up">Follow-up</SelectItem><SelectItem value="SOC">SOC</SelectItem><SelectItem value="ROC">ROC</SelectItem><SelectItem value="Recert">Recert</SelectItem><SelectItem value="Discharge">Discharge</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                <div className="space-y-2">
                                    <Label>Patient/PCG Signature</Label>
                                    <div className="relative rounded-md border bg-muted/30 h-24 flex items-center justify-center">
                                        {form.watch('patientSignature') ? ( <Image src={form.watch('patientSignature')!} alt="Signature" layout="fill" objectFit="contain" /> ) : <span className="text-muted-foreground">Not Signed</span>}
                                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => setActiveSignature('patient')}><Edit2 className="h-4 w-4" /></Button>
                                    </div>
                                    <FormMessage>{form.formState.errors.patientSignature?.message}</FormMessage>
                                </div>
                            </div>
                        </div>
                    )}
                  </>
                ) : (
                    <>
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
                                 <Textarea 
                                    placeholder="Enter your shift notes here, or scan a document to have the AI fill this in."
                                    {...register('logNotes')}
                                    rows={8}
                                />
                                {isExtracting && (
                                    <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="animate-spin mr-2"/> AI is reading the document...</div>
                                )}
                                {scannedImage && (
                                    <div className="relative w-full max-w-sm">
                                        <Image src={scannedImage} alt="Scanned document" width={400} height={300} className="rounded-md border" />
                                        <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => { setScannedImage(null); setValue('logNotes', ''); setExtractedShiftDateTime(null);}}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-4 items-center">
                                    <Button type="button" onClick={handleScanClick} variant="outline" disabled={isExtracting}>
                                        <Camera className="mr-2" /> Scan Written Log
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
                
                  <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={isSubmitting || isExtracting || (isAllstarTemplate && !isEmployeeDetailsSet)}>
                          {isSubmitting || isExtracting ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                              <Upload className="mr-2 h-4 w-4" />
                          )}
                          Submit Log
                      </Button>
                  </div>
              </CardContent>
          </Card>
        </form>
        </FormProvider>
      )}
      
      <Dialog open={!!activeSignature} onOpenChange={() => setActiveSignature(null)}>
        <SignaturePadModal
            isOpen={!!activeSignature}
            onClose={() => setActiveSignature(null)}
            onSave={(dataUrl) => {
                if (activeSignature === 'employee') {
                    setEmployeeDetails(prev => ({...prev, employeeSignature: dataUrl}));
                } else if (activeSignature === 'patient') {
                    setValue('patientSignature', dataUrl, { shouldValidate: true, shouldDirty: true });
                }
            }}
            signatureData={activeSignature === 'employee' ? employeeDetails.employeeSignature : form.getValues('patientSignature')}
            title={activeSignature === 'employee' ? 'Employee Signature' : 'Patient/PCG Signature'}
        />
       </Dialog>

      {selectedGroup && (
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
                                    <a key={index} href={img} target="_blank" rel="noopener noreferrer">
                                        <Image src={img} alt={`Log image ${index + 1}`} width={200} height={150} className="rounded-md border object-cover hover:opacity-80 transition-opacity" />
                                    </a>
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
      )}
    </div>
  );
}
