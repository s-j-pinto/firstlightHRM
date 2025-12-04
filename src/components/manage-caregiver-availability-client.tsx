
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

const DAY_COLUMNS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Extract "Available" or "Scheduled Availability" ranges from a cell.
 */
function extractAvailability(cell: string | null | undefined): string {
  if (!cell || typeof cell !== "string") return "";

  const text = cell.replace(/\r/g, "");

  const availableRegex =
    /Available\s*\n?\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)\s*To\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)/gi;

  const scheduledRegex =
    /Scheduled Availability\s*\n?\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)\s*To\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)/gi;

  let matches = [];
  let m;

  while ((m = availableRegex.exec(text)) !== null) {
    matches.push(`Available\n${m[1]} To ${m[2]}`);
  }

  if (matches.length > 0) return matches.join("\n\n");

  while ((m = scheduledRegex.exec(text)) !== null) {
    matches.push(`Scheduled Availability\n${m[1]} To ${m[2]}`);
  }

  return matches.join("\n\n");
}


/**
 * Determine if the row is a caregiver name row.
 * Name rows look like: "Aguirre, Ana",,,,,,
 */
function isCaregiverNameRow(rowObj: Record<string, string>): boolean {
  const keys = Object.keys(rowObj);
  if (keys.length === 0) return false;

  const name = rowObj[keys[0]];
  if (!name || !name.trim()) return false;

  // Check if columns 2–8 (indices 1-7) are empty or undefined
  for (let i = 1; i <= 7; i++) {
    const col = keys[i];
    if (!col) continue;

    const val = rowObj[col];
    if (val && val.trim()) return false;
  }

  return true;
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
        skipEmptyLines: false,
        complete: async (results) => {
          const rows: Record<string, string>[] = results.data as Record<string, string>[];
          const headerColumns = results.meta.fields;

          if (!headerColumns || rows.length < 1) {
            toast({ title: "Invalid CSV", description: "The CSV file is empty or improperly formatted.", variant: "destructive" });
            return;
          }
          
          const caregivers: { name: string; schedule: Record<string, string> }[] = [];
          let currentCaregiver: { name: string; schedule: Record<string, string> } | null = null;

          for (const row of rows) {
              if (isCaregiverNameRow(row)) {
                  if (currentCaregiver) {
                      caregivers.push(currentCaregiver);
                  }
                  
                  const name = row[headerColumns[0]].trim();
                  currentCaregiver = {
                      name: name,
                      schedule: {},
                  };
                  DAY_COLUMNS.forEach(day => {
                      if (currentCaregiver) currentCaregiver.schedule[day] = "";
                  });
                  continue;
              }

              if (currentCaregiver) {
                  DAY_COLUMNS.forEach((day, i) => {
                      const colName = headerColumns[i + 1]; // col 0 is name, 1-7 are days
                      if (!colName) return;

                      const cell = row[colName];
                      if (cell && cell.trim()) {
                          const cleaned = extractAvailability(cell);
                          if (cleaned) {
                              if (currentCaregiver.schedule[day]) {
                                  currentCaregiver.schedule[day] += "\n\n" + cleaned;
                              } else {
                                  currentCaregiver.schedule[day] = cleaned;
                              }
                          }
                      }
                  });
              }
          }
          
          if (currentCaregiver) {
              caregivers.push(currentCaregiver);
          }
          
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
              if (fileInput) fileInput.value = '';
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
