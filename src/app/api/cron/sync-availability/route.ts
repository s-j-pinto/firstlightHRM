
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import Papa from 'papaparse';
import { processActiveCaregiverAvailabilityUpload } from '@/lib/active-caregivers.actions';
import { serverApp } from '@/firebase/server-init';

// --- Parsing logic helpers ---
const DAY_COLUMNS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

/**
 * Scans a CSV cell and extracts only the relevant schedule patterns.
 * Normalizes availability to "Available [Time] To [Time]" 
 * and keeps shifts as "[Time] - [Time]".
 */
function extractSchedulePatterns(cell: string | null | undefined): string {
  if (!cell || typeof cell !== "string") return "";

  // 1. Stretch the text to handle compressed formats (e.g., "AMAvailable" -> "AM Available")
  const stretched = cell
    .replace(/([0-9])([AP]M)/gi, '$1 $2') // Digit followed by AM/PM
    .replace(/([AP]M)([0-9])/gi, '$1 $2') // AM/PM followed by Digit
    .replace(/([AP]M)([A-Z])/gi, '$1 $2') // AM/PM followed by a Letter
    .replace(/\s+/g, ' '); // Collapse whitespace

  // 2. Define patterns for Availability (To) and Shifts (-)
  // Supports HH:MM:SS or HH:MM
  const timePattern = '(\\d{1,2}:\\d{2}(?::\\d{2})?\\s*[AP]M)';
  const availRegex = new RegExp(`${timePattern}\\s*To\\s*${timePattern}`, 'gi');
  const shiftRegex = new RegExp(`${timePattern}\\s*-\\s*${timePattern}`, 'gi');

  const results: string[] = [];
  let match;

  // 3. Extract Availability blocks
  while ((match = availRegex.exec(stretched)) !== null) {
    results.push(`Available ${match[1]} To ${match[2]}`);
  }

  // 4. Extract Shift blocks
  while ((match = shiftRegex.exec(stretched)) !== null) {
    results.push(`${match[1]} - ${match[2]}`);
  }

  return results.join("\n\n");
}

function isCaregiverNameRow(rowObj: Record<string, string>, headerColumns: string[]): boolean {
  if (!headerColumns || headerColumns.length === 0) return false;
  const firstColValue = rowObj[headerColumns[0]];
  // Name row: column 0 has a value, but columns 1-7 are empty
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
                  const cleanedPatterns = extractSchedulePatterns(cell.trim());
                  if (cleanedPatterns) {
                      if (currentCaregiver!.schedule[day]) {
                          currentCaregiver!.schedule[day] += "\n\n" + cleanedPatterns;
                      } else {
                          currentCaregiver!.schedule[day] = cleanedPatterns;
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
