import { Fragment } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import "./PageTopbar.css";

interface PageTopbarProps {
  /** Label and path of the current page, shown after Home in the breadcrumb. */
  current: { to: string; label: string };
  /** Pages between Home and the current one. */
  trail?: { to: string; label: string }[];
  /** Controls on the right, such as the demo mode toggle. */
  children?: ReactNode;
}

/** Breadcrumb row at the top of member pages. */
export default function PageTopbar({ current, trail = [], children }: PageTopbarProps) {
  return (
    <div className="page-topbar">
      <nav className="page-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        {trail.map((step) => (
          <Fragment key={step.to}>
            <span aria-hidden="true">/</span>
            <Link to={step.to}>{step.label}</Link>
          </Fragment>
        ))}
        <span aria-hidden="true">/</span>
        <Link to={current.to} className="page-breadcrumb-current" aria-current="page">
          {current.label}
        </Link>
      </nav>
      {children}
    </div>
  );
}
