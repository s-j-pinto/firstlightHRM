
"use client";

import { useState, useTransition, ChangeEvent, ReactNode } from 'react';
import Papa from 'papaparse';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';

// Function to extract time from "Scheduled Availability\n5:00:00 AM To 8:00:00 PM"
function extractTimes(text: string): { startTime: string; endTime: string } | null {
  if (!text || !text.includes("Scheduled Availability")) return null;
  
  const lines = text.split('\n').map(l => l.trim());
  const timeLine = lines.find(l => l.includes("To"));
  if (!timeLine) return null;

  const timeParts = timeLine.split("To").map(t => t.trim());
  if (timeParts.length !== 2) return null;

  return { startTime: timeParts[0], endTime: timeParts[1] };
}


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

                if (!headers || rows.length === 0) {
                    toast({ title: 'Parsing Error', description: 'Could not read headers or rows from the CSV.', variant: 'destructive' });
                    return;
                }

                const parsedData: any[] = [];
                const debugExtraction: { caregiver: string, availabilityCellContent: string }[] = [];
                const caregiverNameHeader = headers[0]; 

                for (let i = 1; i < headers.length; i++) {
                    const currentDayHeader = headers[i];
                    if (!currentDayHeader || !currentDayHeader.includes('\n')) continue; 

                    const [day, date] = currentDayHeader.split('\n');
                    let lastCaregiverName: string | null = null;

                    rows.forEach(row => {
                        const nameCell = row[caregiverNameHeader]?.trim();
                        const availabilityCell = row[currentDayHeader]?.trim();

                        if (nameCell && nameCell !== "Total H's") {
                            lastCaregiverName = nameCell;
                        }
                        
                        if (lastCaregiverName && availabilityCell) {
                             if (debugExtraction.length < 5) {
                                debugExtraction.push({ caregiver: lastCaregiverName, availabilityCellContent: availabilityCell });
                            }
                            if (availabilityCell.includes("Scheduled Availability")) {
                                const times = extractTimes(availabilityCell);
                                if (times) {
                                    parsedData.push({
                                        day: day.trim(),
                                        date: date.trim(),
                                        caregiver: lastCaregiverName,
                                        availabilityType: "Scheduled Availability",
                                        startTime: times.startTime,
                                        endTime: times.endTime
                                    });
                                }
                            }
                        }
                    });
                }
                
                if (parsedData.length === 0) {
                    const debugDescription = (
                        <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 max-h-60 overflow-y-auto">
                            <code className="text-white">{JSON.stringify(debugExtraction, null, 2)}</code>
                        </pre>
                    );
                     toast({
                        title: 'Parsing Complete: No "Scheduled Availability" Data Found',
                        description: debugDescription,
                        variant: 'destructive',
                        duration: 20000
                    });
                } else {
                    const previewDescription = (
                        <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 max-h-60 overflow-y-auto">
                            <code className="text-white">{JSON.stringify(parsedData.slice(0, 10), null, 2)}</code>
                        </pre>
                    );
                    toast({
                        title: `Successfully Parsed ${parsedData.length} Records`,
                        description: previewDescription,
                        duration: 20000
                    });
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
