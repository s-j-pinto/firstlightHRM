
"use client";

import { useState, useTransition, ChangeEvent, ReactNode } from 'react';
import Papa from 'papaparse';
import { processActiveCaregiverUpload } from '@/lib/active-caregivers.actions';

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
            header: false, // We will handle headers manually
            skipEmptyLines: true,
            complete: async (results) => {
                const rows: string[][] = results.data as string[][];
                if (rows.length < 2) {
                    toast({ title: "Invalid CSV", description: "Not enough rows to process.", variant: "destructive" });
                    return;
                }

                const headers = rows[0];
                const parsedData: Record<string, any>[] = [];
                let lastCaregiverName: string | null = null;
                
                // Start from row 1, as row 0 is headers
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const firstCell = row[0]?.trim();

                    // Check if the current row is a caregiver name row
                    if (firstCell && firstCell !== "Total H's") {
                        lastCaregiverName = firstCell;
                        
                        // The availability is in the *next* row
                        if (i + 1 < rows.length) {
                            const availabilityRow = rows[i + 1];
                            
                            // Iterate through columns of the availability row
                            for (let j = 1; j < headers.length; j++) {
                                const availabilityCell = availabilityRow[j]?.trim();
                                if (availabilityCell && availabilityCell.includes("Scheduled Availability")) {
                                    parsedData.push({
                                        caregiverName: lastCaregiverName,
                                        header: headers[j],
                                        availability: availabilityCell,
                                    });
                                }
                            }
                        }
                        // We processed the name and availability rows, so we can skip the next row in the main loop
                        i++; 
                    }
                }
                
                if (parsedData.length === 0) {
                     toast({
                        title: "Parsing Issue",
                        description: "Could not find any 'Scheduled Availability' data linked to a caregiver name. Please check the CSV format.",
                        variant: "destructive",
                        duration: 8000,
                    });
                    return;
                }

                const uploadResult = await processActiveCaregiverUpload(parsedData);

                toast({
                    title: uploadResult.error ? 'Upload Failed' : 'Upload Successful',
                    description: uploadResult.message,
                    variant: uploadResult.error ? 'destructive' : 'default',
                });
                
                if (!uploadResult.error) {
                    setFile(null);
                    const fileInput = document.getElementById('availability-file-upload') as HTMLInputElement;
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
          <CardTitle>Upload Caregiver Availability</CardTitle>
          <CardDescription>
            Upload a weekly availability schedule as a CSV file. The system will parse the file and update the availability records in the database.
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
              Upload Availability
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
