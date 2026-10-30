import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router";
import { resetPassword } from "@/api/auth";
import { ApiError } from "@/api/client";
import { FORGOT_PASSWORD_PATH } from "@/auth/config";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import Notice from "@/components/common/Notice";
import PasswordField from "@/components/form/PasswordField";
import {
  NETWORK_ERROR_MESSAGE,
  PASSWORD_HINT,
  validateConfirmPassword,
  validateNewPassword,
} from "@/components/form/validation";
import styles from "@/scss/components/AuthForm.module.scss";

interface ResetPasswordFormProps {
  /** Token from the emailed link, or null if the link was incomplete. */
  token: string | null;
  /** Called once the new password is saved. */
  onReset: () => void;
}

interface FormValues {
  password: string;
  confirmPassword: string;
}

type FieldName = keyof FormValues;

/** Step 2 of resetting a forgotten password: choose the new one. */
export default function ResetPasswordForm({ token, onReset }: ResetPasswordFormProps) {
  const [values, setValues] = useState<FormValues>({ password: "", confirmPassword: "" });
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(token === null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errors: Partial<Record<FieldName, string>> = {
    password: validateNewPassword(values.password, "Please choose a new password."),
    confirmPassword: validateConfirmPassword(values.confirmPassword, values.password),
  };
  const visibleError = (field: FieldName) => (touched[field] ? errors[field] : undefined);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as FieldName;
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ password: true, confirmPassword: true });
    if (!token || errors.password || errors.confirmPassword) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await resetPassword(token, values.password);
      onReset();
    } catch (error) {
      if (error instanceof ApiError && error.code === "invalid_reset_link") {
        setLinkInvalid(true);
      } else {
        setFormError(error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (linkInvalid) {
    return (
      <AuthSplitLayout title="Reset Password" subtitle="This link can't be used to reset your password.">
        <div className={styles.form}>
          <Notice variant="error" title="Link invalid or expired">
            Reset links work once and expire after 60 minutes. Request a new one and use the most recent email.
          </Notice>
          <Link to={FORGOT_PASSWORD_PATH} className={styles.submitLink}>
            Request a new link
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout title="Reset Password" subtitle="Choose a new password for your LittleRoots account.">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          value={values.password}
          hint={PASSWORD_HINT}
          error={visibleError("password")}
          onChange={handleChange}
          onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
        />
        <PasswordField
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          error={visibleError("confirmPassword")}
          onChange={handleChange}
          onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
        />

        <button className={styles.submit} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Saving…" : "Reset password"}
        </button>
      </form>
    </AuthSplitLayout>
  );
}
