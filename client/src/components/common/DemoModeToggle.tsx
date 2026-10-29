import "./DemoModeToggle.css";

interface DemoModeToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
  /** Short line under the label saying what demo mode shows on this page. */
  hint: string;
}

/** Switch between the user's real data and sample data. */
export default function DemoModeToggle({ on, onChange, hint }: DemoModeToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={on} className="demo-toggle" onClick={() => onChange(!on)}>
      <span className="demo-toggle-track" aria-hidden="true">
        <span className="demo-toggle-thumb" />
      </span>
      <span className="demo-toggle-label">
        Demo mode
        <span className="demo-toggle-hint">{hint}</span>
      </span>
    </button>
  );
}
