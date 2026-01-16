
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import Papa from 'papaparse';
import { processActiveCaregiverPreferencesUpload } from '@/lib/active-caregivers.actions';
import { serverApp } from '@/firebase/server-init';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bucket = getStorage().bucket('gs://firstlighthomecare-hrm.firebasestorage.app');
    const file = bucket.file('caregiver-scheduling/caregiver-preferences.csv');
    const [contents] = await file.download();
    const csvData = contents.toString();

    const parseResult = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
    });
    
    if (parseResult.errors.length > 0) {
        console.error('CSV Parsing errors:', parseResult.errors);
        throw new Error('Failed to parse caregiver preferences CSV.');
    }

    const result = await processActiveCaregiverPreferencesUpload(parseResult.data as any[]);

    if (result.error) {
        throw new Error(result.message);
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error('[CRON-ERROR] /api/cron/sync-preferences:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
