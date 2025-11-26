
"use client";

import { useState, useTransition, ChangeEvent } from 'react';
import { processCaregiverAvailabilityUpload } from '@/lib/active-caregivers.actions';
import Papa from 'papaparse';
import { format, parse as dateParse } from 'date-fns';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function ManageCaregiverAvailabilityClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const { toast } = useToast();

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
        const reader = new FileReader();

        reader.onload = async (event) => {
            if (event.target && typeof event.target.result === 'string') {
                const csvText = event.target.result;
                Papa.parse(csvText, {
                    header: false,
                    complete: async (results) => {
                        const data = results.data as string[][];

                        if (data.length < 4) {
                            toast({ title: 'Invalid CSV', description: "CSV must have at least 4 rows.", variant: 'destructive' });
                            return;
                        }

                        const dayHeader = data[0];
                        let lastCaregiver: string | null = null;

                        try {
                            for (let colIndex = 0; colIndex < dayHeader.length; colIndex++) {
                                const day = dayHeader[colIndex]?.trim();
                                if (!day) continue;

                                for (let rowIndex = 2; rowIndex < data.length; rowIndex++) {
                                    const row = data[rowIndex];
                                    const cellValue = row?.[colIndex]?.trim();
                                    
                                    if (!cellValue || cellValue === "Total H's") continue;

                                    if (!cellValue.includes("Scheduled Availability")) {
                                        lastCaregiver = cellValue;
                                    } else {
                                        if (!lastCaregiver) continue;

                                        const timeMatch = cellValue.match(/(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))\s*To\s*(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))/i);
                                        if (timeMatch) {
                                            const startTimeStr = timeMatch[1];
                                            const endTimeStr = timeMatch[2];
                                            
                                            const startTime = dateParse(startTimeStr, 'hh:mm:ss a', new Date());
                                            if (isNaN(startTime.getTime())) {
                                                throw new Error(`Invalid start time format. Offending Cell: Column ${colIndex + 1}, Row ${rowIndex + 1}. Value: "${startTimeStr}"`);
                                            }

                                            const endTime = dateParse(endTimeStr, 'hh:mm:ss a', new Date());
                                            if (isNaN(endTime.getTime())) {
                                                 throw new Error(`Invalid end time format. Offending Cell: Column ${colIndex + 1}, Row ${rowIndex + 1}. Value: "${endTimeStr}"`);
                                            }
                                        }
                                    }
                                }
                            }
                            
                            toast({
                                title: "CSV Parsed Successfully",
                                description: "No time format errors found. Ready to process on the server.",
                            });

                            // Now proceed with the actual server-side upload
                            const uploadResult = await processCaregiverAvailabilityUpload(csvText);
                            if (uploadResult.error) {
                                toast({ title: 'Upload Failed', description: uploadResult.message, variant: 'destructive' });
                            } else {
                                toast({ title: 'Upload Successful', description: uploadResult.message });
                            }

                        } catch (error: any) {
                            toast({
                                title: "Parsing Error",
                                description: error.message,
                                variant: "destructive",
                                duration: 10000,
                            });
                        }
                    },
                    error: (error: any) => {
                        toast({ title: 'File Read Error', description: error.message, variant: 'destructive' });
                    }
                });
            }
        };

        reader.onerror = () => {
             toast({ title: 'File Read Error', description: 'Could not read the selected file.', variant: 'destructive' });
        };

        reader.readAsText(file);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Caregiver Availability</CardTitle>
          <CardDescription>
            Upload a weekly availability schedule as a CSV file. The file should have two header rows (Day, then Date), followed by pairs of rows for each caregiver (Name, then Availability).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="availability-file-upload">Availability CSV File</Label>
                <Input id="availability-file-upload" type="file" accept=".csv" onChange={handleFileChange} />
            </div>
            <Button onClick={handleUpload} disabled={isUploading || !file}>
              {isUploading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
              Upload Availability
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
