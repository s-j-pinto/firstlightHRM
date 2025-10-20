
"use client";

import { useState, useTransition, ChangeEvent, useMemo } from 'react';
import Papa from 'papaparse';
import { useForm } from 'react-hook-form';
import { collection, query, where } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { processClientUpload } from '@/lib/clients.actions';
import { Client } from '@/lib/types';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, User, Phone, Home, Mailbox, MapPin } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function ManageClientsClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const { toast } = useToast();
  const db = firestore;

  const clientsRef = useMemoFirebase(() => {
    if (!db) return null;
    // DIAGNOSTIC STEP: Removed where("status", "==", "ACTIVE") to test security rule interaction.
    const clientsQuery = query(collection(db, "clients"));
    return clientsQuery;
  }, [db]);

  const { data: allClients, isLoading: clientsLoading } = useCollection<Client>(clientsRef);

  const clients = useMemo(() => {
    if (!allClients) return [];
    return allClients.filter(client => client.status === 'ACTIVE');
  }, [allClients]);


  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) {
      toast({ title: 'No file selected', description: 'Please select a CSV file to upload.', variant: 'destructive' });
      return;
    }

    startUploadTransition(() => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const requiredFields = ["Client Name", "Mobile"];
          const headers = results.meta.fields;
          if (!headers || !requiredFields.every(field => headers.includes(field))) {
            toast({
              title: 'Invalid CSV Format',
              description: `The CSV must contain at least the following columns: ${requiredFields.join(', ')}`,
              variant: 'destructive',
            });
            return;
          }

          const uploadResult = await processClientUpload(results.data as any[]);
          
          if (uploadResult.error) {
            toast({ title: 'Upload Failed', description: uploadResult.message, variant: 'destructive' });
          } else {
            toast({ title: 'Upload Successful', description: uploadResult.message });
            setFile(null);
          }
        },
        error: (error) => {
          toast({ title: 'Parsing Error', description: `Error parsing CSV file: ${error.message}`, variant: 'destructive' });
        }
      });
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Client Data</CardTitle>
          <CardDescription>
            Upload a CSV file with client information. Required columns are "Client Name" and "Mobile".
            Existing clients will be updated, new clients will be added, and clients not in the file will be marked as INACTIVE.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="client-file-upload">Client CSV File</Label>
                <Input id="client-file-upload" type="file" accept=".csv" onChange={handleFileChange} />
            </div>
            <Button onClick={handleUpload} disabled={isUploading || !file}>
              {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}
              <span className="ml-2">Upload</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Active Clients</CardTitle>
          <CardDescription>List of all currently active clients in the system.</CardDescription>
        </CardHeader>
        <CardContent>
            {clientsLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <p className="ml-4 text-muted-foreground">Loading clients...</p>
                </div>
            ) : clients && clients.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clients.map(client => (
                        <Card key={client.id} className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center text-xl">
                                    <User className="mr-2 h-5 w-5 text-accent"/> {client['Client Name']}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {client.DOB && <p><span className="font-semibold">DOB:</span> {client.DOB}</p>}
                                <p className="flex items-start"><Home className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground"/> {client.Address}{client['Apt/Unit'] ? `, ${client['Apt/Unit']}` : ''}</p>
                                <p className="flex items-start"><MapPin className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground"/> {client.City}, {client.Zip}</p>
                                <p className="flex items-start"><Phone className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground"/> {client.Mobile}</p>
                                {client.ContactName && (
                                    <>
                                        <p className="flex items-start pt-2"><User className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground"/> Contact: {client.ContactName}</p>
                                        {client.ContactMobile && <p className="flex items-start"><Phone className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground"/> Contact Mobile: {client.ContactMobile}</p>}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <p className="text-center text-muted-foreground py-8">No active clients found.</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
