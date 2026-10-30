import { useLocation, useNavigate } from "react-router";
import Notice from "@/components/common/Notice";
import UserLogin from "@/components/login/UserLogin";
import type { LoginLocationState } from "@/components/session/IdleSessionManager";
import { HOME_PATH, IDLE_TIMEOUT_MS } from "@/auth/config";
import type { SignInOptions } from "@/auth/AuthContext";
import type { Session } from "@/auth/types";
import { useAuth } from "@/auth/useAuth";

const IDLE_MINUTES = IDLE_TIMEOUT_MS / 60_000;

/** Route-level page for `/login`. Explains why the user was sent here, if they were. */
export default function LoginView() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { reason, from } = (state as LoginLocationState | null) ?? {};

  const handleLoggedIn = (session: Session, options: SignInOptions) => {
    signIn(session, options);
    // Return to the members-only page that sent them here, or go home.
    // replace: going "back" from the app shouldn't return to the login form.
    navigate(from ?? HOME_PATH, { replace: true });
  };

  const notice =
    reason === "idle" ? (
      <Notice title="You've been logged out">
        For your security, we logged you out after {IDLE_MINUTES} minutes of inactivity. Please log in again to
        continue.
      </Notice>
    ) : reason === "signed-out" ? (
      <Notice>You have been logged out.</Notice>
    ) : reason === "password-reset" ? (
      <Notice variant="success" title="Password reset">
        Your password has been changed. Log in with your new password.
      </Notice>
    ) : reason === "auth-required" ? (
      <Notice>Please log in to continue. Don't have an account yet? Sign up below.</Notice>
    ) : null;

  return (
    <>
      <title>Log In | LittleRoots</title>
      <UserLogin notice={notice} onLoggedIn={handleLoggedIn} />
    </>
  );
}
