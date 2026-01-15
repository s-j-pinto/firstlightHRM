'use server';

export async function getDistance(origin: string, destination: string): Promise<{ distanceText: string; distanceValue: number } | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Google Maps API key is not set.");
        return null;
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
            const element = data.rows[0].elements[0];
            return {
                distanceText: element.distance.text,
                distanceValue: element.distance.value, // in meters
            };
        } else {
            console.warn("Distance Matrix API call did not return OK:", data.status, data.error_message);
            return null;
        }
    } catch (error: any) {
        console.error("Error fetching distance from Google Maps API:", error.message);
        return null;
    }
}
