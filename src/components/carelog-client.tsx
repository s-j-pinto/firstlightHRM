
"use client";

import { useState, useMemo, useTransition, useRef, useEffect } from "react";
import { useUser, firestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, query, where, addDoc, Timestamp } from "firebase/firestore";
import { CareLogGroup, Client, CareLog } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { extractCareLogData } from "@/ai/flows/extract-carelog-flow";
import { Loader2, Users, Camera, Trash2, FileText, Clock, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";
import { format } from "date-fns";
import { careLogSchema } from "@/lib/types";

export default function CareLogClient() {
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isExtracting, startExtractTransition] = useTransition();

  const [selectedGroup, setSelectedGroup] = useState<CareLogGroup | null>(null);
  const [logNotes, setLogNotes] = useState("");
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [shiftDateTime, setShiftDateTime] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const careLogGroupsRef = useMemoFirebase(
    () => user ? query(collection(firestore, 'carelog_groups'), where('caregiverIds', 'array-contains', user.uid)) : null,
    [user]
  );
  const { data: careLogGroups, isLoading: groupsLoading } = useCollection<CareLogGroup>(careLogGroupsRef);

  const careLogsRef = useMemoFirebase(
    () => selectedGroup ? query(collection(firestore, 'carelogs'), where('careLogGroupId', '==', selectedGroup.id)) : null,
    [selectedGroup]
  );
  const { data: careLogs, isLoading: logsLoading } = useCollection<CareLog>(careLogsRef);

  const clientsRef = useMemoFirebase(() => collection(firestore, 'Clients'), []);
  const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsRef);

  const clientsMap = useMemo(() => {
    if (!clients) return new Map();
    return new Map(clients.map(c => [c.id, c]));
  }, [clients]);

  const handleGroupSelect = (groupId: string) => {
    const group = careLogGroups?.find(g => g.id === groupId) || null;
    setSelectedGroup(group);
    setLogNotes("");
    setScannedImage(null);
    setShowCamera(false);
    setShiftDateTime(null);
  };

  const handleScanClick = () => {
    setShowCamera(true);
  };

  useEffect(() => {
    if (showCamera) {
      async function getCameraPermission() {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
              try {
                  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                  if (videoRef.current) {
                      videoRef.current.srcObject = stream;
                  }
              } catch (error) {
                  console.error("Error accessing camera:", error);
                  toast({
                      variant: "destructive",
                      title: "Camera access denied",
                      description: "Please enable camera permissions in your browser settings.",
                  });
                  setShowCamera(false);
              }
          }
      }
      getCameraPermission();
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
                    setLogNotes(result.extractedText);
                    setShiftDateTime(result.shiftDateTime);
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

  const handleSubmitLog = () => {
    if (!selectedGroup || !user) {
      toast({ title: "Error", description: "Please select a client group first.", variant: "destructive" });
      return;
    }
    if (!logNotes && !scannedImage) {
      toast({ title: "Error", description: "Please enter notes or scan a document.", variant: "destructive" });
      return;
    }
    if (scannedImage && !shiftDateTime) {
      toast({ title: "Error", description: "Shift date and time are required when submitting a scan.", variant: "destructive" });
      return;
    }

    startSubmitTransition(async () => {
      const logData = {
        careLogGroupId: selectedGroup.id,
        caregiverId: user.uid,
        caregiverName: user.displayName || user.email || 'Unknown Caregiver',
        logNotes: logNotes,
        logImages: scannedImage ? [scannedImage] : [],
        shiftDateTime: shiftDateTime ? Timestamp.fromDate(new Date(shiftDateTime)) : Timestamp.now(),
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
          // Reset form on success
          handleGroupSelect(selectedGroup.id);
      }).catch(serverError => {
          // This is where we create and emit the contextual error
          const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: "create",
            requestResourceData: validation.data,
          });
          errorEmitter.emit("permission-error", permissionError);
          // We don't need a toast here because the global error boundary will show the error.
      });
    });
  };

  const isLoading = isUserLoading || groupsLoading || clientsLoading;

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
                        You are not currently assigned to any client care groups. Please contact your administrator.
                    </AlertDescription>
                </Alert>
            )}
        </CardContent>
      </Card>
      
      {selectedGroup && (
        <>
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
                          <div className="flex justify-center gap-4">
                              <Button onClick={handleCapture}><Camera className="mr-2" /> Capture Image</Button>
                              <Button variant="outline" onClick={() => setShowCamera(false)}>Cancel</Button>
                          </div>
                      </div>
                  ) : (
                       <div className="space-y-4">
                          <Textarea 
                              placeholder="Enter your shift notes here, or scan a document to have the AI fill this in."
                              value={logNotes}
                              onChange={(e) => setLogNotes(e.target.value)}
                              rows={8}
                          />

                          {isExtracting && (
                              <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="animate-spin mr-2"/> AI is reading the document...</div>
                          )}

                          {shiftDateTime && (
                            <Alert>
                                <Clock className="h-4 w-4" />
                                <AlertTitle>Extracted Shift Time</AlertTitle>
                                <AlertDescription>
                                    {format(new Date(shiftDateTime), 'PPPPpp')}
                                </AlertDescription>
                            </Alert>
                          )}

                          {scannedImage && (
                              <div className="relative w-full max-w-sm">
                                  <Image src={scannedImage} alt="Scanned document" width={400} height={300} className="rounded-md border" />
                                  <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => { setScannedImage(null); setLogNotes(''); setShiftDateTime(null);}}>
                                      <Trash2 className="h-4 w-4" />
                                  </Button>
                              </div>
                          )}
                          
                          <Button onClick={handleScanClick} variant="outline" disabled={isExtracting}>
                              <Camera className="mr-2" /> Scan Written Log
                          </Button>
                      </div>
                  )}

                  <div className="flex justify-end pt-4">
                      <Button onClick={handleSubmitLog} disabled={isSubmitting || isExtracting}>
                          {isSubmitting ? (
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
                              <p className="whitespace-pre-wrap text-sm">{log.logNotes}</p>
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
        </>
      )}
    </div>
  );
}

    