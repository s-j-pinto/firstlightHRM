
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import Papa from 'papaparse';
import { processActiveCaregiverAvailabilityUpload } from '@/lib/active-caregivers.actions';
import { serverApp } from '@/firebase/server-init';

const OTHER_DAY_COLUMNS = ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Checks if a row from the CSV represents a new caregiver's name.
 * A name row is defined as a row where:
 * 1. The 'Monday' column has text that does not look like a schedule time.
 * 2. All other day columns ('Tuesday' through 'Sunday') are empty.
 */
function isCaregiverNameRow(row: Record<string, any>): boolean {
  const mondayValue = row['Monday'];
  if (!mondayValue || typeof mondayValue !== 'string' || !mondayValue.trim()) {
    return false;
  }

  // Heuristic to check if the value is a name and not schedule data.
  // It checks if the string does NOT start with a time-like pattern or availability keywords.
  const isLikelyName = !/^\d{1,2}:\d{2}:\d{2}/.test(mondayValue.trim()) && !/(available|scheduled)/i.test(mondayValue.trim());
  if (!isLikelyName) {
    return false;
  }
  
  // A name row should have empty values for all other day columns.
  for (const day of OTHER_DAY_COLUMNS) {
    if (row[day] && typeof row[day] === 'string' && row[day].trim()) {
      return false; // If any other day has data, it's not a name row.
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
    
    const rows: Record<string, any>[] = parseResult.data as Record<string, any>[];
    const headerColumns = parseResult.meta.fields;
    if (!headerColumns) {
        throw new Error('CSV headers are missing.');
    }

    const caregivers: { name: string; schedule: Record<string, string> }[] = [];
    let currentCaregiver: { name: string; schedule: Record<string, string> } | null = null;
    
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Object.keys(row).length === 0) {
        continue;
      }

      if (isCaregiverNameRow(row)) {
        if (currentCaregiver) {
            caregivers.push(currentCaregiver);
        }
        const name = row['Monday'].trim();
        currentCaregiver = {
            name: name,
            schedule: {
                "Monday": "", "Tuesday": "", "Wednesday": "", "Thursday": "", 
                "Friday": "", "Saturday": "", "Sunday": ""
            },
        };
        // The name row itself contains the name, so we don't process it as schedule data.
        continue;
      }

      if (currentCaregiver) {
          // Iterate over the known day names and use them as keys to access row data
          ["Monday", ...OTHER_DAY_COLUMNS].forEach(dayName => {
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
    
    // DEBUG: Log the exact data being sent for processing.
    console.log('[DEBUG] Data being sent to processActiveCaregiverAvailabilityUpload:', JSON.stringify(caregivers, null, 2));

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
