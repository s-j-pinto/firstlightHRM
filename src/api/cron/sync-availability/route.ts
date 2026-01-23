
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import Papa from 'papaparse';
import { serverApp } from '@/firebase/server-init';
import { processActiveCaregiverAvailabilityUpload } from '@/lib/active-caregivers.actions';

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

    const result = await processActiveCaregiverAvailabilityUpload(rows);

    if (result.error) {
        throw new Error(result.message);
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error('[CRON-ERROR] /api/cron/sync-availability:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
