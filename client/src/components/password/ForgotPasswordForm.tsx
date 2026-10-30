import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router";
import { requestPasswordReset } from "@/api/auth";
import { ApiError } from "@/api/client";
import { LOGIN_PATH, RESET_EMAIL_SENDER, RESET_EMAIL_SUBJECT } from "@/auth/config";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import Notice from "@/components/common/Notice";
import TextField from "@/components/form/TextField";
import { NETWORK_ERROR_MESSAGE, validateEmail } from "@/components/form/validation";
import styles from "@/scss/components/AuthForm.module.scss";

/** Step 1 of resetting a forgotten password: ask for the email and send the link. */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The address the link was sent to; switches the page to "check your email".
  const [sentTo, setSentTo] = useState<string | null>(null);

  const emailError = validateEmail(email);

  const sendLink = async (address: string) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      await requestPasswordReset(address);
      setSentTo(address);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!emailError) {
      void sendLink(email.trim());
    }
  };

  if (sentTo) {
    return (
      <AuthSplitLayout title="Check Your Email" subtitle="Follow the link in the email to choose a new password.">
        <div className={styles.form}>
          <Notice variant="success" title="Reset link sent">
            If an account exists for <strong>{sentTo}</strong>, we've sent it a link to reset your password. The link
            expires in 60 minutes.
          </Notice>
          <Notice variant="warning" title="Not in your inbox?">
            <ul className={styles.tipList}>
              <li>
                Check your <strong>junk or spam folder</strong>. Reset emails sometimes land there.
              </li>
              <li>
                Look for an email from <strong>{RESET_EMAIL_SENDER}</strong> with the subject "{RESET_EMAIL_SUBJECT}".
                If it's in spam, mark it as "Not spam" so future emails reach your inbox.
              </li>
              <li>It can take a few minutes to arrive. Make sure you used the email you signed up with.</li>
            </ul>
          </Notice>
          <button
            className={styles.submit}
            type="button"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            onClick={() => void sendLink(sentTo)}
          >
            {isSubmitting ? "Sending…" : "Send another link"}
          </button>
          {formError && (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          )}
          <p className={styles.footnote}>
            Remembered it? <Link to={LOGIN_PATH}>Back to log in</Link>
          </p>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout
      title="Forgot Password"
      subtitle="Enter the email address for your account and we'll send you a link to reset your password."
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          error={touched ? emailError : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setEmail(event.target.value);
            setFormError(null);
          }}
          onBlur={() => setTouched(true)}
        />

        <button className={styles.submit} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </button>

        <p className={styles.footnote}>
          Remembered it? <Link to={LOGIN_PATH}>Back to log in</Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}
