
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import Papa from 'papaparse';
import { processActiveCaregiverAvailabilityUpload } from '@/lib/active-caregivers.actions';
import { serverApp } from '@/firebase/server-init';

const DAY_COLUMNS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

/**
 * Safely checks if a row from the CSV represents a caregiver's name.
 * It ensures that the first column has a string value and the subsequent
 * day columns are empty.
 */
function isCaregiverNameRow(rowObj: Record<string, any>, headerColumns: string[]): boolean {
  if (!headerColumns || headerColumns.length === 0) return false;
  
  const firstColKey = headerColumns[0];
  const firstColValue = rowObj[firstColKey];

  // If first column is empty, not a string, or is a day of the week, it's not a name row.
  if (typeof firstColValue !== 'string' || !firstColValue.trim() || DAY_COLUMNS.includes(firstColValue.trim())) {
      return false;
  }
  
  // A name row should have empty values for all the actual day columns.
  for (const day of DAY_COLUMNS) {
    if (rowObj[day] && typeof rowObj[day] === 'string' && rowObj[day].trim()) {
      return false; // This row has data in a day column, so it's not a name row.
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
      skipEmptyLines: false, // Keep this false to handle multi-line cells correctly
    });
    
    if (parseResult.errors.length > 0) {
        throw new Error('Failed to parse caregiver availability CSV.');
    }
    
    const rows: Record<string, any>[] = parseResult.data as Record<string, any>[];
    const headerColumns = parseResult.meta.fields;
    if (!headerColumns) {
        throw new Error('CSV headers are missing.');
    }

    const caregivers: { name: string; schedule: Record<string, string> }[] = [];
    let currentCaregiver: { name: string; schedule: Record<string, string> } | null = null;
    
    for (const row of rows) {
      // Safely skip any rows that are not valid objects (e.g., empty trailing rows)
      if (!row || typeof row !== 'object' || Object.keys(row).length === 0) {
        continue;
      }

      if (isCaregiverNameRow(row, headerColumns)) {
        if (currentCaregiver) {
            caregivers.push(currentCaregiver);
        }
        // isCaregiverNameRow has already validated that the first column exists and is a string
        const name = row[headerColumns[0]].trim();
        currentCaregiver = {
            name: name,
            schedule: {},
        };
        // Initialize schedule for all days for the new caregiver
        DAY_COLUMNS.forEach(day => {
            if (currentCaregiver) currentCaregiver.schedule[day] = "";
        });
        continue;
      }

      if (currentCaregiver) {
          // Iterate over the known day names and use them as keys to access row data
          DAY_COLUMNS.forEach(dayName => {
              const cellValue = row[dayName];
              
              if (typeof cellValue === 'string' && cellValue.trim()) {
                  if (currentCaregiver.schedule[dayName]) {
                      // Append with a newline for multi-line cells from CSV
                      currentCaregiver.schedule[dayName] += "\n" + cellValue;
                  } else {
                      currentCaregiver.schedule[dayName] = cellValue;
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
    return NextResponse.json({ success: false, error: `An error occurred during the upload: ${error.message}` }, { status: 500 });
  }
}
