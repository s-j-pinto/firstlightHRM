
"use client";

import { useState, useTransition, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { processClientUpload } from '@/lib/clients.actions';
import { useCollection, useMemoFirebase, firestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Client } from '@/lib/types';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function ManageClientsClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const { toast } = useToast();

  const clientsRef = useMemoFirebase(() => collection(firestore, 'Clients'), [firestore]);
  const { data: clientsData, isLoading: clientsLoading } = useCollection<Client>(clientsRef);

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

    startUploadTransition(async () => {
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
            const fileInput = document.getElementById('client-file-upload') as HTMLInputElement;
            if(fileInput) fileInput.value = '';
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
            Upload a CSV file to add or update client records. This process will sync the database with your file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="client-file-upload">Client CSV File</Label>
                <Input id="client-file-upload" type="file" accept=".csv" onChange={handleFileChange} />
            </div>
            <Button onClick={handleUpload} disabled={isUploading || !file}>
              {isUploading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
              Upload File
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <h2 className="text-2xl font-bold tracking-tight font-headline mb-4">Current Clients</h2>
        {clientsLoading ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="ml-4 text-muted-foreground">Loading clients...</p>
            </div>
        ) : clientsData && clientsData.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {clientsData.filter(c => c.status === 'Active').map((client) => (
                    <Card key={client.id}>
                        <CardHeader>
                            <CardTitle>{client['Client Name']}</CardTitle>
                            <CardDescription>{client.Mobile || 'No mobile'}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <p><strong>Email:</strong> {client.Email || 'N/A'}</p>
                            <p><strong>DOB:</strong> {client.DOB || 'N/A'}</p>
                            <p><strong>Address:</strong> {`${client.Address || ''} ${client.aptUnit || ''}`.trim()}</p>
                            <p><strong>Location:</strong> {`${client.City || ''}, ${client.Zip || ''}`.trim()}</p>
                            <p><strong>Contact:</strong> {client.ContactName || 'N/A'}</p>
                            <p><strong>Contact Mobile:</strong> {client.ContactMobile || 'N/A'}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        ) : (
            <div className="text-center py-16 border-dashed border-2 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900">No Active Clients Found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Upload a CSV file to add clients.</p>
            </div>
        )}
      </div>
    </div>
  );
}
