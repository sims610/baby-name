import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { LOGIN_PATH } from "@/auth/config";
import type { LoginLocationState } from "@/components/session/IdleSessionManager";
import ResetPasswordForm from "@/components/password/ResetPasswordForm";

/** Route-level page for `/reset-password?token=…`, the link in the reset email. */
export default function ResetPasswordView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Read the token once and keep it in state...
  const [token] = useState(() => searchParams.get("token"));

  // ...then remove it from the address bar, so it doesn't linger in the browser
  // history or get shared by accident.
  useEffect(() => {
    if (searchParams.has("token")) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleReset = () => {
    const state: LoginLocationState = { reason: "password-reset" };
    navigate(LOGIN_PATH, { replace: true, state });
  };

  return (
    <>
      <title>Reset Password | LittleRoots</title>
      <ResetPasswordForm token={token} onReset={handleReset} />
    </>
  );
}
