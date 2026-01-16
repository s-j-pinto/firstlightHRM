
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import Papa from 'papaparse';
import { processActiveCaregiverAvailabilityUpload } from '@/lib/active-caregivers.actions';
import { serverApp } from '@/firebase/server-init';

// --- Parsing logic adapted from the client component ---
const DAY_COLUMNS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

function extractAvailability(cell: string | null | undefined): string {
  if (!cell || typeof cell !== "string") return "";
  const text = cell.replace(/\r/g, "");
  const availableRegex = /Available\s*\n?\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)\s*To\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)/gi;
  const scheduledRegex = /Scheduled Availability\s*\n?\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)\s*To\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)/gi;
  let matches = [];
  let m;
  while ((m = availableRegex.exec(text)) !== null) {
    matches.push(`Available\n${m[1]} To ${m[2]}`);
  }
  if (matches.length > 0) {
    return matches.join("\n\n");
  }
  while ((m = scheduledRegex.exec(text)) !== null) {
    matches.push(`Scheduled Availability\n${m[1]} To ${m[2]}`);
  }
  return matches.join("\n\n");
}

function isCaregiverNameRow(rowObj: Record<string, string>, headerColumns: string[]): boolean {
  if (!headerColumns || headerColumns.length === 0) return false;
  const firstColValue = rowObj[headerColumns[0]];
  if (!firstColValue || !firstColValue.trim() || DAY_COLUMNS.includes(firstColValue.trim())) {
      return false;
  }
  for (let i = 1; i <= 7; i++) {
    const colName = headerColumns[i];
    if (colName && rowObj[colName] && rowObj[colName].trim()) {
      return false;
    }
  }
  return true;
}

// --- Main API Route ---
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bucket = getStorage().bucket('gs://firstlighthomecare-hrm.firebasestorage.app');
    const file = bucket.file('caregiver-scheduling/Active Caregiver Availability.csv');
    const [contents] = await file.download();
    const csvData = contents.toString();

    const parseResult = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: false,
    });
    
    if (parseResult.errors.length > 0) {
        throw new Error('Failed to parse caregiver availability CSV.');
    }
    
    const rows: Record<string, string>[] = parseResult.data as Record<string, string>[];
    const headerColumns = parseResult.meta.fields;
    if (!headerColumns) {
        throw new Error('CSV headers are missing.');
    }

    const caregivers: { name: string; schedule: Record<string, string> }[] = [];
    let currentCaregiver: { name: string; schedule: Record<string, string> } | null = null;
    
    for (const row of rows) {
      if (isCaregiverNameRow(row, headerColumns)) {
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
              const colName = headerColumns[i]; 
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
        throw new Error("Could not find any valid caregiver schedules in the provided format.");
    }

    const result = await processActiveCaregiverAvailabilityUpload(caregivers);

    if (result.error) {
        throw new Error(result.message);
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error('[CRON-ERROR] /api/cron/sync-availability:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
