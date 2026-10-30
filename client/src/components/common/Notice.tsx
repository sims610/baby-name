import type { ReactNode } from "react";
import styles from "@/scss/components/Notice.module.scss";

type NoticeVariant = "info" | "success" | "warning" | "error";

interface NoticeProps {
  variant?: NoticeVariant;
  title?: string;
  children: ReactNode;
}

/** Inline message banner. Errors are announced immediately; others politely. */
export default function Notice({ variant = "info", title, children }: NoticeProps) {
  return (
    <div className={`${styles.notice} ${styles[variant]}`} role={variant === "error" ? "alert" : "status"}>
      {title && <p className={styles.title}>{title}</p>}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
