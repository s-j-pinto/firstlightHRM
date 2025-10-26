
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
    
    // Revoke previous session cookie to ensure claims are updated
    const sessionCookieValue = cookies().get("__session")?.value;
    if (sessionCookieValue) {
        const decodedToken = await serverAuth.verifySessionCookie(sessionCookieValue).catch(() => null);
        if (decodedToken) {
            await serverAuth.revokeRefreshTokens(decodedToken.sub);
        }
    }

    // Create a new token with the updated claims
    const decodedIdToken = await serverAuth.verifyIdToken(idToken);
    const newCustomToken = await serverAuth.createCustomToken(decodedIdToken.uid, { clientId });
    const newUserCredential = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        {
            method: 'POST',
            body: JSON.stringify({ token: newCustomToken, returnSecureToken: true }),
            headers: { 'Content-Type': 'application/json' },
        }
    );
    const { idToken: newIdToken } = await newUserCredential.json();
    

    // Set session expiration to 5 days.
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await serverAuth.createSessionCookie(newIdToken, { expiresIn });

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
