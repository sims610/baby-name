import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import IdleWarningDialog from "@/components/session/IdleWarningDialog";
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS, LOGIN_PATH } from "@/auth/config";
import { useAuth } from "@/auth/useAuth";
import { useIdleTimeout } from "@/auth/useIdleTimeout";

/** Why the user arrived at the login page; read by LoginView to explain it. */
export type LogoutReason = "idle" | "signed-out" | "auth-required" | "password-reset";

export interface LoginLocationState {
  reason?: LogoutReason;
  /** Page to return to after logging in (set by RequireAuth). */
  from?: string;
}

/**
 * Warns signed-in users before an idle logout, then logs them out and sends them
 * to the login page. Lives inside the router (in RootLayout) so it can navigate.
 */
export default function IdleSessionManager() {
  const { isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();

  const goToLogin = useCallback(
    (reason: LogoutReason) => {
      const state: LoginLocationState = { reason };
      navigate(LOGIN_PATH, { replace: true, state });
    },
    [navigate],
  );

  const handleIdle = useCallback(() => {
    void signOut();
    goToLogin("idle");
  }, [signOut, goToLogin]);

  const handleLogOut = useCallback(() => {
    void signOut();
    goToLogin("signed-out");
  }, [signOut, goToLogin]);

  const { isWarning, deadline, stayActive } = useIdleTimeout({
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    enabled: isAuthenticated,
    onIdle: handleIdle,
  });

  // If another tab hits the timeout first, this tab loses its session through the
  // storage sync while still showing the warning. Treat that as an idle logout too.
  useEffect(() => {
    if (!isAuthenticated && isWarning) {
      goToLogin("idle");
    }
  }, [isAuthenticated, isWarning, goToLogin]);

  return (
    <IdleWarningDialog
      open={isAuthenticated && isWarning}
      deadline={deadline}
      onStaySignedIn={stayActive}
      onLogOut={handleLogOut}
    />
  );
}
