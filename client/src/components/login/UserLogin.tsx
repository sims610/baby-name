import { useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Link } from "react-router";
import { login } from "@/api/auth";
import { ApiError } from "@/api/client";
import type { Session } from "@/auth/types";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import Checkbox from "@/components/form/Checkbox";
import TextField from "@/components/form/TextField";
import { NETWORK_ERROR_MESSAGE, validateEmail } from "@/components/form/validation";
import styles from "@/scss/components/AuthForm.module.scss";

interface UserLoginProps {
  /** Called with the new session after the server accepts the credentials. */
  onLoggedIn?: (session: Session, options: { remember: boolean }) => void;
  /** Message shown above the form, e.g. why the user was logged out. */
  notice?: ReactNode;
  /** Hero image for the left panel. A styled placeholder is shown when omitted. */
  imageSrc?: string;
  imageAlt?: string;
}

interface FormValues {
  email: string;
  password: string;
}

type FieldName = keyof FormValues;
type FormErrors = Partial<Record<FieldName, string>>;

const INITIAL_VALUES: FormValues = { email: "", password: "" };

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const emailError = validateEmail(values.email);
  if (emailError) {
    errors.email = emailError;
  }
  if (!values.password) {
    errors.password = "Please enter your password.";
  }
  return errors;
}

export default function UserLogin({ onLoggedIn, notice, imageSrc, imageAlt }: UserLoginProps) {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [remember, setRemember] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Errors are derived from the current values and only shown for visited fields.
  const errors = validate(values);
  const visibleError = (field: FieldName) => (touched[field] ? errors[field] : undefined);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as FieldName;
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setFormError(null);
  };

  const handleBlur = (field: FieldName) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ email: true, password: true });

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const session = await login({ email: values.email.trim(), password: values.password });
      setValues(INITIAL_VALUES);
      setTouched({});
      onLoggedIn?.(session, { remember });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Deliberately vague: don't reveal whether the email has an account.
        setFormError("Incorrect email or password.");
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError(NETWORK_ERROR_MESSAGE);
      }
      // Clear the password so a mistyped one isn't resubmitted by accident.
      setValues((prev) => ({ ...prev, password: "" }));
      setTouched((prev) => ({ ...prev, password: false }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout
      title="Account Login"
      subtitle="If you are already a member you can login with your email address and password."
      imageSrc={imageSrc}
      imageAlt={imageAlt}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {notice}
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
          value={values.email}
          error={visibleError("email")}
          onChange={handleChange}
          onBlur={() => handleBlur("email")}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          error={visibleError("password")}
          onChange={handleChange}
          onBlur={() => handleBlur("password")}
        />
        <Checkbox
          label="Remember me"
          name="remember"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />

        <button className={styles.submit} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Logging in…" : "Log In"}
        </button>

        <p className={styles.footnote}>
          Don't have an account? <Link to="/register">Sign up here</Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}
