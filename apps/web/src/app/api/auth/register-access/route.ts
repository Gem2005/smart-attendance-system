import { NextRequest, NextResponse } from "next/server";
import {
  assertTeacherSignupKeyConfigured,
  createTeacherSignupAccessToken,
  getTeacherSignupCookieOptions,
  TEACHER_SIGNUP_ACCESS_COOKIE,
  verifyTeacherSignupKey,
} from "@/lib/auth/register-access";

export async function POST(request: NextRequest) {
  let accessKey: string | undefined;

  try {
    const body = await request.json();
    accessKey = typeof body?.accessKey === "string" ? body.accessKey : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!accessKey) {
    return NextResponse.json({ error: "accessKey is required" }, { status: 400 });
  }

  try {
    assertTeacherSignupKeyConfigured();
  } catch {
    return NextResponse.json(
      {
        error:
          "Server misconfiguration: TEACHER_SIGNUP_ACCESS_KEY must be a 64-character hex key",
      },
      { status: 500 }
    );
  }

  if (!verifyTeacherSignupKey(accessKey)) {
    return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  }

  const response = NextResponse.json({ message: "Access granted" });
  response.cookies.set(
    TEACHER_SIGNUP_ACCESS_COOKIE,
    createTeacherSignupAccessToken(),
    getTeacherSignupCookieOptions()
  );

  return response;
}