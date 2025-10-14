"use server";

import { addDays, getDay, set, isBefore, parse, formatISO } from 'date-fns';
import { serverDb } from "@/firebase/server-init";
import type { Appointment } from './types';

const dayNameToIndex: { [key: string]: number } = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

async function getInterviewSlots(): Promise<{ [key: number]: Date[] }> {
  const slotsByDay: { [key: number]: Date[] } = {};

  try {
    const docRef = serverDb.collection("settings").doc("availability");
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      if (data) {
          for (const dayName in data) {
              if (Object.prototype.hasOwnProperty.call(data, dayName) && dayName.endsWith("_slots")) {
                  const dayIndex = dayNameToIndex[dayName.replace("_slots", "")];
                  if (dayIndex === undefined) continue;
                  const timeSlots = data[dayName].split(",").map((s: string) => s.trim()).filter(Boolean);
                  
                  slotsByDay[dayIndex] = timeSlots.map((timeStr: string) => {
                      return parse(timeStr, 'HH:mm', new Date());
                  });
              }
          }
      }
    } else {
      throw new Error("Availability document not found"); 
    }
  } catch (error) {
    console.error("Error fetching from Firestore, using default values:", error);
    const defaultAvailability = {
        sunday_slots: "11:00,12:00,13:00,14:00,15:00,16:00,17:00",
        monday_slots: "11:00,12:00,13:00,14:00,15:00,16:00,17:00",
        tuesday_slots: "11:00,12:00,13:00,14:00,15:00,16:00,17:00",
        wednesday_slots: "11:00,12:00,13:00,14:00,15:00,16:00,17:00",
        thursday_slots: "",
        friday_slots: "",
        saturday_slots: "",
    };
    for (const dayName in defaultAvailability) {
        if (Object.prototype.hasOwnProperty.call(defaultAvailability, dayName)) {
            const dayIndex = dayNameToIndex[dayName.replace("_slots", "")];
            if (dayIndex === undefined) continue;
            const timeSlots = (defaultAvailability as any)[dayName].split(',').map((s: string) => s.trim()).filter(Boolean);
            slotsByDay[dayIndex] = timeSlots.map((timeStr: string) => {
                return parse(timeStr, 'HH:mm', new Date());
            });
        }
    }
  }
  
  return slotsByDay;
}


async function generateAvailableSlots(
  bookedAppointments: Appointment[],
  weeksToCheck: number = 3
): Promise<{ date: string, slots: string[] }[]> {
  const availableSlots: { date: string, slots: string[] }[] = [];
  const today = new Date();
  const bookedTimes = new Set(bookedAppointments.map(a => a.startTime.getTime()));
  const interviewSlotsByDay = await getInterviewSlots();

  for (let i = 0; i < weeksToCheck * 7; i++) {
    const currentDate = addDays(today, i);
    const dayOfWeek = getDay(currentDate);

    if (interviewSlotsByDay[dayOfWeek]) {
      const daySlots: string[] = [];
      interviewSlotsByDay[dayOfWeek].forEach(slotTime => {
        const combinedDateTime = set(currentDate, { 
            hours: slotTime.getHours(), 
            minutes: slotTime.getMinutes(), 
            seconds: 0, 
            milliseconds: 0 
        });

        if (isBefore(new Date(), combinedDateTime) && !bookedTimes.has(combinedDateTime.getTime())) {
          daySlots.push(formatISO(combinedDateTime).slice(0, 19));
        }
      });
      
      if (daySlots.length > 0) {
        availableSlots.push({
          date: formatISO(currentDate).slice(0, 10),
          slots: daySlots,
        });
      }
    }
  }

  return availableSlots;
}

type BookedAppointmentSerializable = Omit<Appointment, 'startTime' | 'endTime'> & {
    startTime: string;
    endTime: string;
};

export async function getAvailableSlotsAction(
    bookedAppointmentsSerializable: BookedAppointmentSerializable[]
) {
    const bookedAppointments: Appointment[] = bookedAppointmentsSerializable.map(
        (appt) => ({
            ...appt,
            startTime: new Date(appt.startTime),
            endTime: new Date(appt.endTime),
        })
    );

    const availableSlots = await generateAvailableSlots(bookedAppointments, 3);
    return availableSlots;
}
