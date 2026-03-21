import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ResetPasswordForm from "./reset-password-form";
import {
  isTeacherSignupAccessTokenValid,
  TEACHER_SIGNUP_ACCESS_COOKIE,
} from "@/lib/auth/register-access";

export default async function ForgotPasswordPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TEACHER_SIGNUP_ACCESS_COOKIE)?.value;

  if (!isTeacherSignupAccessTokenValid(token)) {
    redirect("/forgot-password/unlock");
  }

  return <ResetPasswordForm />;
}
