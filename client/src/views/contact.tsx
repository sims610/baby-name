
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import type { ContactMessageInput } from "shared";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import { NETWORK_ERROR_MESSAGE } from "@/components/form/validation";
import "./contact.css";

type SubmitStatus =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "sent" }
  | { state: "error"; message: string };

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  message: "",
};

export default function Contact() {
  const { authRequest } = useAuth();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [status, setStatus] = useState<SubmitStatus>({ state: "idle" });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (status.state !== "sending") {
      setStatus({ state: "idle" });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status.state === "sending") return;

    setStatus({ state: "sending" });

    const body: ContactMessageInput = {
      name: formData.name,
      email: formData.email,
      message: formData.message,
      ...(formData.phone.trim() ? { phone: formData.phone } : {}),
    };

    try {
      // authRequest so a signed-in sender is linked to their account; it works signed out too.
      await authRequest("/contact", { method: "POST", body });
      setFormData(EMPTY_FORM);
      setStatus({ state: "sent" });
    } catch (error) {
      setStatus({
        state: "error",
        message:
          error instanceof ApiError
            ? error.message
            : NETWORK_ERROR_MESSAGE,
      });
    }
  };

  return (
    <main className="contact-page">
      <div className="contact-container">

        {/* Breadcrumb */}
        <nav className="contact-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/about">About</Link>
          <span>/</span>
          <Link
            to="/contact"
            className="contact-breadcrumb-current"
            aria-current="page"
          >
            Contact
          </Link>
        </nav>

        {/* Page Title */}
        <h1 className="contact-title">Contact</h1>

        {/* Contact Information Cards */}
        <section className="contact-info-grid">

          <div className="contact-info-card">
            <div className="contact-info-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.09 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72c.12.96.35 1.91.69 2.81a2 2 0 0 1-.45 2.11L9.09 10.91a16 16 0 0 0 4 4l1.27-1.23a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.69A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <h2>Phone number</h2>
            <a href="tel:1234567868">123-456-7868</a>
          </div>

          <div className="contact-info-card">
            <div className="contact-info-icon">
                <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                >
                <rect x="2" y="4" width="20" height="16" rx="1" />
                <path d="m2 5 10 8 10-8" />
                </svg>
            </div>
            <h2>Email Us</h2>
            <a href="mailto:hello@littleroots.com">
                hello@littleroots.com
            </a>
            </div>

          <div className="contact-info-card">
            <div className="contact-info-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            </div>
            <h2>Address place</h2>
            <p>
              Brigham Young University,
              <br />
              Provo, UT 84602
            </p>
          </div>
        </section>

        {/* Map and Contact Form */}
        <section className="contact-main-section">

          {/* Google Maps */}
          <div className="contact-map">
            <iframe
              title="Brigham Young University Location"
              src="https://maps.google.com/maps?q=Brigham%20Young%20University%2C%20Provo%2C%20UT&t=&z=14&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>

          {/* Contact Form */}
          <div className="contact-form-wrapper">
            <h2>Contact Us</h2>

            <form onSubmit={handleSubmit} className="contact-form">
              <input
                type="text"
                name="name"
                placeholder="Your name"
                aria-label="Your name"
                value={formData.name}
                onChange={handleChange}
                maxLength={100}
                required
              />

              <input
                type="tel"
                name="phone"
                placeholder="Phone number"
                aria-label="Phone number"
                value={formData.phone}
                onChange={handleChange}
                maxLength={30}
              />

              <input
                type="email"
                name="email"
                placeholder="Email address"
                aria-label="Email address"
                value={formData.email}
                onChange={handleChange}
                maxLength={254}
                required
              />

              <textarea
                name="message"
                placeholder="Write your comment here..."
                aria-label="Your message"
                value={formData.message}
                onChange={handleChange}
                rows={4}
                maxLength={5000}
                required
              />

              <button
                type="submit"
                className="contact-submit-button"
                disabled={status.state === "sending"}
              >
                {status.state === "sending" ? "Sending…" : "Send"}
              </button>

              {status.state === "sent" && (
                <p className="contact-form-notice" role="status">
                  Thanks! Your message has been sent.
                </p>
              )}

              {status.state === "error" && (
                <p className="contact-form-notice" role="alert">
                  {status.message}
                </p>
              )}
            </form>
          </div>

        </section>
      </div>
    </main>
  );
}
