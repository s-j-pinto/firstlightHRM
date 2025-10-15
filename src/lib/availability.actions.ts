
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


async function generateConfiguredSlots(weeksToCheck: number = 3): Promise<{ date: string, slots: string[] }[]> {
  const availableSlots: { date: string, slots: string[] }[] = [];
  const today = new Date();
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

        if (isBefore(new Date(), combinedDateTime)) {
          // Format as a simple string that can be reconstructed on the client
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

export async function getAvailableSlotsAction() {
    const configuredSlots = await generateConfiguredSlots(3);
    return configuredSlots;
}
