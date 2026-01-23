
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
  
  const firstColValue = rowObj[headerColumns[0]];

  // If first column is empty, not a string, or is a day of the week, it's not a name row.
  if (typeof firstColValue !== 'string' || !firstColValue.trim() || DAY_COLUMNS.includes(firstColValue.trim())) {
      return false;
  }
  
  // A name row should have empty values for the day columns.
  for (let i = 1; i <= 7; i++) {
    const colName = headerColumns[i];
    // If a day column has a non-empty string value, it's not a name row.
    if (colName && rowObj[colName] && typeof rowObj[colName] === 'string' && rowObj[colName].trim()) {
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
        // isCaregiverNameRow has already validated that this is a string
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
          DAY_COLUMNS.forEach((day, i) => {
              const colName = headerColumns[i]; 
              if (!colName) return;
              
              const cell = row[colName];
              
              // **CRITICAL FIX**: Check if the cell content is a string before processing.
              if (typeof cell === 'string' && cell.trim()) {
                  if (currentCaregiver.schedule[day]) {
                      // Append with a newline for multi-line cells
                      currentCaregiver.schedule[day] += "\n" + cell;
                  } else {
                      currentCaregiver.schedule[day] = cell;
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
