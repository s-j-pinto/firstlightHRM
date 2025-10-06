# **App Name**: Caregiver Connect

## Core Features:

- Multi-Tabbed Caregiver Information Form: Collect detailed caregiver information through a series of structured questions, organized into multiple tabs: General Information, Experience, Certifications, Availability of caregiver for taking shifts, and Transportation. Ensure all required fields are completed before submission.
- Appointment Scheduling: Upon form submission, Persist the caregiver profile into a firestore database. Then present the caregiver preconfigured time slots ( 1 hour duration) for interviews based on admin availability to be set as 8:30 am to 11:30 am on Mon, Tues, Wed and 1:30 pm to 4:30 pm on Thurs and Fri.
- Appointment Time Slot Persistence: Once the caregiver selects an appointment slot, Persist the appointment time slot, (date, start time, end time and reference to caregiver profile id) in firestore database.
- Admin Dashboard: Provide the Admin a view of next 2 weeks of calendar interview appointments/events. When the appointment card is clicked, display the caregivers profile. Also for each appointment/event, provide a send calendar invite button which will create an interview appointment on the administrator's Google Calendar, incorporating caregiver details (name, contact information, and selected time slot) into the calendar invite. The location for the interview appointment shall be "9650 Business Center Drive, Suite 132, Rancho Cucaomonga, CA".
- Automated Confirmation Notifications: Send immediate confirmation notifications (email/text) to the caregiver upon successful scheduling, providing all pertinent appointment details.
- Admin Settings Panel: Equip the administrator with a settings panel to predefine available interview time slots, and securely store Google Calendar credentials for seamless booking management.
- Progress Indicator and Navigation: Enhance user experience with a clear progress indicator on the caregiver form (e.g., 'Step 1 of 5') and intuitive 'Next' and 'Back' buttons on each tab for easy navigation.

## Style Guidelines:

- Primary color: Light teal (#A7DBD8) to represent a calming and supportive environment, avoiding overly corporate or sterile feelings. It has a blend of green (growth, health) and blue (trust, stability).
- Background color: Very light, desaturated teal (#F0F8FF) to keep the focus on the forms and scheduled calendar.
- Accent color: Coral (#E07A5F) provides a friendly, approachable contrast to the teal, for action buttons, links, and alerts.
- Body and headline font: 'PT Sans' (sans-serif) offers a balance of modern clarity and subtle warmth.
- Use clean, easily recognizable icons from a set like Feather or simple material design, using filled versions for clarity.
- Ensure a mobile-first, responsive design, employing a clear, single-column layout on smaller screens, with wider form tabs arranged side-by-side on larger screens.
- Subtle transitions for tab changes and confirmations; avoid intrusive or lengthy animations that might frustrate users.