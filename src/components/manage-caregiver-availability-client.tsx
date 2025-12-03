
"use client";

import { useState, useTransition, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { processActiveCaregiverUpload } from '@/lib/active-caregivers.actions';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';

/**
 * Detect if a row is a caregiver name row by checking if all columns after the first are empty.
 */
function isCaregiverNameRow(row: Record<string, string>, headerColumns: string[]) {
  for (let i = 1; i < headerColumns.length; i++) {
    const col = headerColumns[i];
    if (!col) continue;
    const val = row[col];
    if (val && String(val).trim() !== "") return false;
  }
  return true;
}

/**
 * Extract all occurrences of "Available {start} To {end}" in a cell
 * and merge into a single string, separated by commas.
 */
function extractAndMergeAvailable(cell: string): string {
  if (!cell || typeof cell !== "string") return "";

  const matches = [...cell.matchAll(/Available\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)\s*To\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)/gi)];

  if (matches.length === 0) return "";

  // Merge all available times into single line, separated by a comma and space for readability
  return matches.map(m => `Available ${m[1]} To ${m[2]}`).join(", ");
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
            complete: async (results) => {
                const rows: Record<string, string>[] = results.data as Record<string, string>[];
                let headerColumns = results.meta.fields;

                if (!headerColumns || rows.length < 1) {
                    toast({ title: "Invalid CSV", description: "The CSV file is empty or improperly formatted.", variant: "destructive" });
                    return;
                }

                const caregivers: { name: string; schedule: Record<string, any>[] }[] = [];
                let currentCaregiver: { name: string; schedule: Record<string, any>[] } | null = null;

                for (const row of rows) {
                    // Check if it's a caregiver name row
                    if (isCaregiverNameRow(row, headerColumns)) {
                        const name = row[headerColumns[0]];
                        if (name && name.trim() !== "") {
                            currentCaregiver = { name: name.trim(), schedule: [] };
                            caregivers.push(currentCaregiver);
                        }
                        continue; // Move to the next row after finding a name
                    }

                    if (!currentCaregiver) continue;
                    
                    const scheduleRow: Record<string, any> = {};
                    
                    // Normalize all schedule cells (all columns)
                    headerColumns.forEach((col) => {
                        if (row[col]) {
                            // Corrected logic: apply extraction to every column and only keep the result.
                            scheduleRow[col] = extractAndMergeAvailable(row[col]);
                        } else {
                            scheduleRow[col] = ""; // Ensure empty cells are preserved as empty strings
                        }
                    });

                    currentCaregiver.schedule.push(scheduleRow);
                }
                
                // DEBUGGING TOAST
                toast({
                    title: "Generated JSON for Server",
                    description: `Found ${caregivers.length} caregivers. Check the browser console for the full JSON object.`,
                    duration: 15000, // Keep toast open for 15 seconds
                });
                console.log("Generated JSON to be sent to server:", JSON.stringify(caregivers, null, 2));


                if (caregivers.length === 0) {
                     toast({
                        title: "Parsing Failed",
                        description: "Could not find any valid caregiver schedules in the provided format.",
                        variant: "destructive",
                        duration: 8000,
                    });
                    return;
                }

                const uploadResult = await processActiveCaregiverUpload(caregivers);

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
            error: (error: any) => {
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
