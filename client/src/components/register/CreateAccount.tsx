import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { register } from "@/api/auth";
import { ApiError } from "@/api/client";
import type { Session } from "@/auth/types";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import PasswordField from "@/components/form/PasswordField";
import TextField from "@/components/form/TextField";
import {
  NETWORK_ERROR_MESSAGE,
  PASSWORD_HINT,
  validateConfirmPassword,
  validateEmail,
  validateNewPassword,
} from "@/components/form/validation";
import styles from "@/scss/components/AuthForm.module.scss";

interface CreateAccountProps {
  /** Called with the new session after the server creates the account. */
  onRegistered?: (session: Session) => void;
  /** Hero image for the left panel. A styled placeholder is shown when omitted. */
  imageSrc?: string;
  imageAlt?: string;
}

interface FormValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type FieldName = keyof FormValues;
type FormErrors = Partial<Record<FieldName, string>>;

const INITIAL_VALUES: FormValues = { name: "", email: "", password: "", confirmPassword: "" };

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Please enter your full name.";
  }

  const emailError = validateEmail(values.email);
  if (emailError) {
    errors.email = emailError;
  }

  const passwordError = validateNewPassword(values.password);
  if (passwordError) {
    errors.password = passwordError;
  }

  const confirmError = validateConfirmPassword(values.confirmPassword, values.password);
  if (confirmError) {
    errors.confirmPassword = confirmError;
  }

  return errors;
}

export default function CreateAccount({ onRegistered, imageSrc, imageAlt = "" }: CreateAccountProps) {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client-side errors are derived from the current values; only fields the user
  // has visited show them, so the form doesn't open covered in red.
  const clientErrors = validate(values);
  const visibleError = (field: FieldName) =>
    serverErrors[field] ?? (touched[field] ? clientErrors[field] : undefined);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as FieldName;
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setServerErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError(null);
  };

  const handleBlur = (field: FieldName) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ name: true, email: true, password: true, confirmPassword: true });

    if (Object.keys(clientErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const session = await register({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      setValues(INITIAL_VALUES);
      setTouched({});
      onRegistered?.(session);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setServerErrors({ email: "An account with this email already exists." });
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout
      title="Account Signup"
      subtitle="Become a member and enjoy baby name generator"
      imageSrc={imageSrc}
      imageAlt={imageAlt}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <TextField
          label="Full Name"
          name="name"
          autoComplete="name"
          value={values.name}
          error={visibleError("name")}
          onChange={handleChange}
          onBlur={() => handleBlur("name")}
        />
        <TextField
          label="Email Address"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={visibleError("email")}
          onChange={handleChange}
          onBlur={() => handleBlur("email")}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          value={values.password}
          hint={PASSWORD_HINT}
          error={visibleError("password")}
          onChange={handleChange}
          onBlur={() => handleBlur("password")}
        />
        <PasswordField
          label="Confirm Password"
          name="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          error={visibleError("confirmPassword")}
          onChange={handleChange}
          onBlur={() => handleBlur("confirmPassword")}
        />

        <button className={styles.submit} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Registering…" : "Register"}
        </button>
      </form>
    </AuthSplitLayout>
  );
}
