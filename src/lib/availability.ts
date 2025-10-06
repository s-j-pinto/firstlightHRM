import { addDays, getDay, set, isBefore, isEqual } from 'date-fns';
import type { Appointment } from './types';

// Rules:
// Mon, Tue, Wed: 8:30, 9:30, 10:30 (1-hour slots)
// Thu, Fri: 13:30, 14:30, 15:30 (1-hour slots)
const interviewSlotsByDay: { [key: number]: number[] } = {
  1: [8.5, 9.5, 10.5], // Monday
  2: [8.5, 9.5, 10.5], // Tuesday
  3: [8.5, 9.5, 10.5], // Wednesday
  4: [13.5, 14.5, 15.5], // Thursday
  5: [13.5, 14.5, 15.5], // Friday
};

export const generateAvailableSlots = (
  bookedAppointments: Appointment[],
  weeksToCheck: number = 3
): { date: Date, slots: Date[] }[] => {
  const availableSlots: { date: Date, slots: Date[] }[] = [];
  const today = new Date();
  const bookedTimes = new Set(bookedAppointments.map(a => a.startTime.getTime()));

  for (let i = 0; i < weeksToCheck * 7; i++) {
    const currentDate = addDays(today, i);
    const dayOfWeek = getDay(currentDate);

    if (interviewSlotsByDay[dayOfWeek]) {
      const daySlots: Date[] = [];
      interviewSlotsByDay[dayOfWeek].forEach(startHour => {
        const hour = Math.floor(startHour);
        const minute = (startHour % 1) * 60;
        const slotTime = set(currentDate, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });

        if (isBefore(new Date(), slotTime) && !bookedTimes.has(slotTime.getTime())) {
          daySlots.push(slotTime);
        }
      });
      
      if (daySlots.length > 0) {
        availableSlots.push({
          date: set(currentDate, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }),
          slots: daySlots,
        });
      }
    }
  }

  return availableSlots;
};
