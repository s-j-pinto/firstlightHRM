"use client";

import { useState, useTransition, ChangeEvent, ReactNode } from 'react';
import Papa from 'papaparse';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function ManageCaregiverAvailabilityClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, startParsingTransition] = useTransition();
  const { toast } = useToast();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadAndParse = () => {
    if (!file) {
      toast({ title: 'No file selected', description: 'Please select a CSV file to upload.', variant: 'destructive' });
      return;
    }

    startParsingTransition(() => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data as Record<string, string>[];
                const headers = results.meta.fields;

                if (!headers || rows.length < 2) {
                    toast({ title: 'Parsing Info', description: 'CSV must have headers and at least two data rows.', variant: 'default' });
                    return;
                }

                const debugExtraction: { caregiver: string, header: string, availabilityCellContent: string }[] = [];
                const caregiverNameHeader = headers[0];
                
                // Use a for loop to inspect current and next row
                for (let i = 0; i < rows.length - 1; i++) {
                    const currentRow = rows[i];
                    const nextRow = rows[i+1];
                    
                    const caregiverName = currentRow[caregiverNameHeader]?.trim();

                    // Check if the current row looks like a caregiver name row
                    if (caregiverName && caregiverName !== "Total H's" && !caregiverName.includes("Scheduled Availability")) {
                        
                        // Now, look for availability in the *next* row
                        for (const header of headers) {
                            if (header === caregiverNameHeader) continue; // Skip the name column

                            const availabilityCellContent = nextRow[header]?.trim();
                            if (availabilityCellContent && availabilityCellContent.includes("Scheduled Availability")) {
                                if (debugExtraction.length < 10) { // Increased limit for better debugging
                                     debugExtraction.push({
                                        caregiver: caregiverName,
                                        header: header.replace(/\n/g, ' '), // Show header for context
                                        availabilityCellContent: availabilityCellContent.replace(/\n/g, ' '),
                                    });
                                }
                            }
                        }
                    }
                }
                
                let toastDescription: ReactNode = 'No valid availability data could be extracted. The debug array is empty.';

                if (debugExtraction.length > 0) {
                     toastDescription = (
                        <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 max-h-60 overflow-y-auto">
                            <code className="text-white">{JSON.stringify(debugExtraction, null, 2)}</code>
                        </pre>
                    );
                }

                toast({
                    title: 'Debug Info: Extracted Availability Cells',
                    description: toastDescription,
                    variant: 'default',
                    duration: 20000
                });
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
          <CardTitle>Upload Caregiver Availability</CardTitle>
          <CardDescription>
            Upload a weekly availability schedule as a CSV file. This tool will now parse the file in your browser and show you what it found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="availability-file-upload">Availability CSV File</Label>
                <Input id="availability-file-upload" type="file" accept=".csv" onChange={handleFileChange} />
            </div>
            <Button onClick={handleUploadAndParse} disabled={isParsing || !file}>
              {isParsing ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
              Test Parse Availability
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
