
"use client";

import { startOfWeek, addDays, format } from 'date-fns';
import { cn } from '@/lib/utils';

export function WeeklyScheduleHeader() {
  const weekStartsOn = 1; // Monday
  const today = new Date();
  const startOfThisWeek = startOfWeek(today, { weekStartsOn });

  const days = Array.from({ length: 7 }).map((_, i) => {
    const date = addDays(startOfThisWeek, i);
    return {
      dayName: format(date, 'EEEE'),
      dateStr: format(date, 'M/d/yyyy'),
    };
  });

  return (
    <div className="grid grid-cols-7 w-full rounded-lg border bg-muted shadow-sm">
      {days.map((day, index) => (
        <div
          key={day.dayName}
          className={cn(
            'p-3 text-center',
            index < days.length - 1 && 'border-r'
          )}
        >
          <p className="font-semibold text-foreground">{day.dayName}</p>
          <p className="text-sm text-muted-foreground">{day.dateStr}</p>
        </div>
      ))}
    </div>
  );
}
