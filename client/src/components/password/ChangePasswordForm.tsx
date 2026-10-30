import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { CHANGE_PASSWORD_PATH } from "@/api/auth";
import type { ChangePasswordInput } from "@/api/auth";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import Notice from "@/components/common/Notice";
import PasswordField from "@/components/form/PasswordField";
import {
  NETWORK_ERROR_MESSAGE,
  PASSWORD_HINT,
  validateConfirmPassword,
  validateNewPassword,
} from "@/components/form/validation";
import styles from "@/scss/components/AuthForm.module.scss";

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

type FieldName = keyof FormValues;
type FormErrors = Partial<Record<FieldName, string>>;

const INITIAL_VALUES: FormValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.currentPassword) {
    errors.currentPassword = "Please enter your current password.";
  }
  const newError = validateNewPassword(values.newPassword, "Please choose a new password.");
  if (newError) {
    errors.newPassword = newError;
  } else if (values.newPassword === values.currentPassword) {
    errors.newPassword = "Choose a password different from your current one.";
  }
  const confirmError = validateConfirmPassword(values.confirmPassword, values.newPassword);
  if (confirmError) {
    errors.confirmPassword = confirmError;
  }
  return errors;
}

/** Lets a signed-in user change their password. */
export default function ChangePasswordForm() {
  const { authRequest } = useAuth();
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errors = validate(values);
  const visibleError = (field: FieldName) => serverErrors[field] ?? (touched[field] ? errors[field] : undefined);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as FieldName;
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setServerErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError(null);
    setSucceeded(false);
  };

  const handleBlur = (field: FieldName) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ currentPassword: true, newPassword: true, confirmPassword: true });
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const body: ChangePasswordInput = { currentPassword: values.currentPassword, newPassword: values.newPassword };
      await authRequest(CHANGE_PASSWORD_PATH, { method: "PUT", body });
      setValues(INITIAL_VALUES);
      setTouched({});
      setSucceeded(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setServerErrors({ currentPassword: error.message });
      } else {
        setFormError(error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {succeeded && (
        <Notice variant="success" title="Password changed">
          Your new password is saved. You've been signed out on your other devices, and we've emailed you a
          confirmation.
        </Notice>
      )}
      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}

      <PasswordField
        label="Current password"
        name="currentPassword"
        autoComplete="current-password"
        value={values.currentPassword}
        error={visibleError("currentPassword")}
        onChange={handleChange}
        onBlur={() => handleBlur("currentPassword")}
      />
      <PasswordField
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        value={values.newPassword}
        hint={PASSWORD_HINT}
        error={visibleError("newPassword")}
        onChange={handleChange}
        onBlur={() => handleBlur("newPassword")}
      />
      <PasswordField
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        value={values.confirmPassword}
        error={visibleError("confirmPassword")}
        onChange={handleChange}
        onBlur={() => handleBlur("confirmPassword")}
      />

      <button className={styles.submit} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
