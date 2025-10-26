
import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/firebase/server-init";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json(
        { error: "idToken is required" },
        { status: 400 }
      );
    }
    
    // To ensure the claim is in the session, we revoke the old session and create a new one.
    const sessionCookieValue = cookies().get("__session")?.value;
    if (sessionCookieValue) {
        const decodedToken = await serverAuth.verifySessionCookie(sessionCookieValue).catch(() => null);
        if (decodedToken) {
            await serverAuth.revokeRefreshTokens(decodedToken.sub);
        }
    }
    
    // Create a new session cookie with the updated claims from the new idToken.
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
