
import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/firebase/server-init";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { idToken, clientId } = await request.json();

    if (!idToken || !clientId) {
      return NextResponse.json(
        { error: "idToken and clientId are required" },
        { status: 400 }
      );
    }
    
    // Get the UID from the idToken
    const decodedIdToken = await serverAuth.verifyIdToken(idToken);
    const uid = decodedIdToken.uid;
    
    // Set the custom claim on the user
    await serverAuth.setCustomUserClaims(uid, { clientId: clientId });

    // The client SDK needs to be force-refreshed to see the claim.
    // We can't do that from the server, but the next time the client gets a token, it will be there.
    // For the session cookie, we can re-create it.

    // To ensure the claim is in the session, we revoke the old session and create a new one.
    const sessionCookieValue = cookies().get("__session")?.value;
    if (sessionCookieValue) {
        const decodedToken = await serverAuth.verifySessionCookie(sessionCookieValue).catch(() => null);
        if (decodedToken) {
            await serverAuth.revokeRefreshTokens(decodedToken.sub);
        }
    }
    
    // Create a new session cookie with the updated claims.
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await serverAuth.createSessionCookie(idToken, { expiresIn });

    cookies().set("__session", sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ status: "success" });
  } catch (error: any) {
    console.error("Session cookie update failed:", error);
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
