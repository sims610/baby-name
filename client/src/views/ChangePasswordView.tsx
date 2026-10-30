import ChangePasswordForm from "@/components/password/ChangePasswordForm";
import styles from "@/scss/views/ChangePasswordView.module.scss";

/** Route-level page for `/account/password`, opened from the menu under the user's name. */
export default function ChangePasswordView() {
  return (
    <>
      <title>Change Password | LittleRoots</title>
      <div className={styles.page}>
        <section className={styles.card} aria-labelledby="change-password-title">
          <header className={styles.header}>
            <h1 id="change-password-title" className={styles.title}>
              Change Password
            </h1>
            <p className={styles.subtitle}>
              Enter your current password, then choose a new one. You'll stay signed in on this device.
            </p>
          </header>
          <ChangePasswordForm />
        </section>
      </div>
    </>
  );
}
