
"use client";

import { useState, useMemo, useTransition, useRef } from "react";
import { useUser } from "@/firebase";
import { firestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { CareLogGroup, Client } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { saveCareLog } from "@/lib/carelog.actions";
import { Loader2, Users, AlertCircle, Camera, CheckCircle, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";

export default function CareLogClient() {
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isSubmitting, startSubmitTransition] = useTransition();

  const [selectedGroup, setSelectedGroup] = useState<CareLogGroup | null>(null);
  const [logNotes, setLogNotes] = useState("");
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch CareLog groups where the current user is a member
  const careLogGroupsRef = useMemoFirebase(
    () => user ? query(collection(firestore, 'carelog_groups'), where('caregiverIds', 'array-contains', user.uid)) : null,
    [user]
  );
  const { data: careLogGroups, isLoading: groupsLoading } = useCollection<CareLogGroup>(careLogGroupsRef);

  const clientsRef = useMemoFirebase(() => collection(firestore, 'Clients'), []);
  const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsRef);

  const clientsMap = useMemo(() => {
    if (!clients) return new Map();
    return new Map(clients.map(c => [c.id, c]));
  }, [clients]);

  const handleGroupSelect = (groupId: string) => {
    const group = careLogGroups?.find(g => g.id === groupId) || null;
    setSelectedGroup(group);
    // Reset form state when group changes
    setLogNotes("");
    setScannedImage(null);
    setShowCamera(false);
  };

  const handleScanClick = () => {
    setShowCamera(true);
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
  };

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
        }
        setShowCamera(false);
        // Stop the camera stream
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleSubmitLog = () => {
    if (!selectedGroup || !user) {
        toast({ title: "Error", description: "Please select a client group first.", variant: "destructive"});
        return;
    }
    if (!logNotes && !scannedImage) {
        toast({ title: "Error", description: "Please enter notes or scan a document.", variant: "destructive"});
        return;
    }

    startSubmitTransition(async () => {
        const payload = {
            careLogGroupId: selectedGroup.id,
            caregiverId: user.uid,
            caregiverName: user.displayName || user.email || 'Unknown Caregiver',
            logNotes: logNotes,
            logImages: scannedImage ? [scannedImage] : [],
        };

        const result = await saveCareLog(payload);

        if (result.error) {
            toast({ title: "Submission Failed", description: result.message, variant: "destructive"});
        } else {
            toast({ title: "Success", description: "Your care log has been submitted."});
            // Reset form
            setSelectedGroup(null);
            setLogNotes("");
            setScannedImage(null);
        }
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
          <CardDescription>Select a client to post a new care log.</CardDescription>
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
                            placeholder="Enter your shift notes here..."
                            value={logNotes}
                            onChange={(e) => setLogNotes(e.target.value)}
                            rows={8}
                        />

                        {scannedImage && (
                            <div className="relative w-full max-w-sm">
                                <Image src={scannedImage} alt="Scanned document" width={400} height={300} className="rounded-md border" />
                                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => setScannedImage(null)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        
                        <Button onClick={handleScanClick} variant="outline">
                            <Camera className="mr-2" /> Scan Written Log
                        </Button>
                    </div>
                )}


                <div className="flex justify-end pt-4">
                    <Button onClick={handleSubmitLog} disabled={isSubmitting}>
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
      )}
    </div>
  );
}
