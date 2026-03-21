import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import RegisterForm from "./register-form";
import {
  isTeacherSignupAccessTokenValid,
  TEACHER_SIGNUP_ACCESS_COOKIE,
} from "@/lib/auth/register-access";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TEACHER_SIGNUP_ACCESS_COOKIE)?.value;

  if (!isTeacherSignupAccessTokenValid(token)) {
    redirect("/register/unlock");
  }

  return <RegisterForm />;
}
