
"use server";

import { addDays, getDay, set, isBefore, parse, format } from 'date-fns';
import { serverDb } from "@/firebase/server-init";

const dayNameToIndex: { [key: string]: number } = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

type AvailabilityType = 'interview' | 'assessment';

async function getSlots(type: AvailabilityType): Promise<{ [key: number]: Date[] }> {
  const slotsByDay: { [key: number]: Date[] } = {};
  const docId = type === 'interview' ? 'availability' : 'assessment_availability';
  const prefix = type === 'assessment' ? 'assessment_' : '';

  try {
    const docRef = serverDb.collection("settings").doc(docId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      if (data) {
          for (const dayKey in data) {
              if (Object.prototype.hasOwnProperty.call(data, dayKey) && dayKey.endsWith("_slots")) {
                  const dayName = dayKey.replace(`${prefix}`, "").replace("_slots", "");
                  const dayIndex = dayNameToIndex[dayName];

                  if (dayIndex === undefined) continue;

                  const timeSlots = data[dayKey].split(",").map((s: string) => s.trim()).filter(Boolean);
                  
                  slotsByDay[dayIndex] = timeSlots.map((timeStr: string) => {
                      return parse(timeStr, 'HH:mm', new Date());
                  });
              }
          }
      }
    } else {
        throw new Error(`${docId} document not found`);
    }
  } catch (error) {
    console.error(`Error fetching from Firestore for ${docId}, using default values:`, error);
    // You might want separate defaults for each type
    const defaultAvailability = type === 'interview' ? {
        sunday_slots: "11:00,12:00,13:00,14:00,15:00,16:00,17:00",
        monday_slots: "11:00,12:00,13:00,14:00,15:00,16:00,17:00",
        tuesday_slots: "11:00,12:00,13:00,14:00,15:00,16:00,17:00",
        wednesday_slots: "11:00,12:00,13:00,14:00,15:00,16:00,17:00",
        thursday_slots: "", friday_slots: "", saturday_slots: "",
    } : {
        assessment_sunday_slots: "10:00,11:00,12:00,14:00",
        assessment_monday_slots: "10:00,11:00,12:00,14:00",
        assessment_tuesday_slots: "10:00,11:00,12:00,14:00",
        assessment_wednesday_slots: "10:00,11:00,12:00,14:00",
        assessment_thursday_slots: "10:00,11:00,12:00,14:00",
        assessment_friday_slots: "", assessment_saturday_slots: "",
    };

    for (const dayKey in defaultAvailability) {
        if (Object.prototype.hasOwnProperty.call(defaultAvailability, dayKey)) {
            const dayName = dayKey.replace(`${prefix}`, "").replace("_slots", "");
            const dayIndex = dayNameToIndex[dayName];
            if (dayIndex === undefined) continue;

            const timeSlots = (defaultAvailability as any)[dayKey].split(',').map((s: string) => s.trim()).filter(Boolean);
            slotsByDay[dayIndex] = timeSlots.map((timeStr: string) => {
                return parse(timeStr, 'HH:mm', new Date());
            });
        }
    }
  }
  
  return slotsByDay;
}


async function generateConfiguredSlots(type: AvailabilityType, weeksToCheck: number = 3): Promise<{ date: string, slots: string[] }[]> {
  const availableSlots: { date: string, slots: string[] }[] = [];
  const today = new Date();
  const slotsByDay = await getSlots(type);

  for (let i = 0; i < weeksToCheck * 7; i++) {
    const currentDate = addDays(today, i);
    const dayOfWeek = getDay(currentDate);

    if (slotsByDay[dayOfWeek]) {
      const daySlots: string[] = [];
      slotsByDay[dayOfWeek].forEach(slotTime => {
        const combinedDateTime = set(currentDate, { 
            hours: slotTime.getHours(), 
            minutes: slotTime.getMinutes(), 
            seconds: 0, 
            milliseconds: 0 
        });

        if (isBefore(new Date(), combinedDateTime)) {
          daySlots.push(format(combinedDateTime, "yyyy-MM-dd HH:mm"));
        }
      });
      
      if (daySlots.length > 0) {
        availableSlots.push({
          date: format(currentDate, "yyyy-MM-dd"),
          slots: daySlots,
        });
      }
    }
  }

  return availableSlots;
}

export async function getAvailableSlotsAction(type: AvailabilityType = 'interview') {
    const configuredSlots = await generateConfiguredSlots(type);
    return configuredSlots;
}
