import ForgotPasswordForm from "@/components/password/ForgotPasswordForm";

/** Route-level page for `/forgot-password` (linked from the login page). */
export default function ForgotPasswordView() {
  return (
    <>
      <title>Forgot Password | LittleRoots</title>
      <ForgotPasswordForm />
    </>
  );
}
