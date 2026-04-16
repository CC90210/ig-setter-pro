import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion Instructions — PULSE by OASIS",
  description:
    "How to request deletion of your data from PULSE by OASIS, including email and self-serve methods.",
};

const pageStyle: React.CSSProperties = {
  background: "#050505",
  color: "#fafafa",
  minHeight: "100vh",
  padding: "48px 24px 96px",
  fontFamily:
    "var(--font-dm-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  lineHeight: 1.65,
};

const containerStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-block",
  color: "#00FFAB",
  textDecoration: "none",
  fontSize: 13,
  fontFamily: "var(--font-space-mono), monospace",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  marginBottom: 40,
};

const h1Style: React.CSSProperties = {
  fontFamily: "var(--font-syne), sans-serif",
  fontSize: 42,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  marginBottom: 8,
  color: "#fafafa",
};

const leadStyle: React.CSSProperties = {
  color: "#888888",
  fontSize: 14,
  fontFamily: "var(--font-space-mono), monospace",
  letterSpacing: "0.05em",
  marginBottom: 40,
};

const h2Style: React.CSSProperties = {
  fontFamily: "var(--font-syne), sans-serif",
  fontSize: 22,
  fontWeight: 700,
  color: "#00FFAB",
  marginTop: 40,
  marginBottom: 12,
  letterSpacing: "-0.01em",
};

const h3Style: React.CSSProperties = {
  fontFamily: "var(--font-syne), sans-serif",
  fontSize: 16,
  fontWeight: 700,
  color: "#fafafa",
  marginTop: 24,
  marginBottom: 8,
};

const pStyle: React.CSSProperties = {
  color: "#cccccc",
  fontSize: 15,
  marginBottom: 14,
};

const ulStyle: React.CSSProperties = {
  color: "#cccccc",
  fontSize: 15,
  paddingLeft: 20,
  marginBottom: 14,
};

const liStyle: React.CSSProperties = {
  marginBottom: 6,
};

const cardStyle: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #1a1a1a",
  borderRadius: 8,
  padding: "20px 24px",
  marginBottom: 16,
};

const codeStyle: React.CSSProperties = {
  fontFamily: "var(--font-space-mono), monospace",
  background: "#111",
  color: "#00FFAB",
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 13,
};

const footerStyle: React.CSSProperties = {
  marginTop: 64,
  paddingTop: 24,
  borderTop: "1px solid #1a1a1a",
  color: "#555555",
  fontSize: 12,
  fontFamily: "var(--font-space-mono), monospace",
};

const linkStyle: React.CSSProperties = {
  color: "#00FFAB",
  textDecoration: "none",
};

const confirmationBannerStyle: React.CSSProperties = {
  background: "rgba(0, 255, 171, 0.08)",
  border: "1px solid rgba(0, 255, 171, 0.3)",
  borderRadius: 8,
  padding: "16px 20px",
  marginBottom: 32,
  color: "#00FFAB",
  fontFamily: "var(--font-space-mono), monospace",
  fontSize: 13,
};

export default function DataDeletionPage({
  searchParams,
}: {
  searchParams?: { confirmation?: string };
}) {
  const confirmation = searchParams?.confirmation;

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <a href="/" style={backLinkStyle}>
          ← Back to PULSE
        </a>

        <h1 style={h1Style}>Data Deletion Instructions</h1>
        <p style={leadStyle}>Last updated: April 16, 2026</p>

        {confirmation && (
          <div style={confirmationBannerStyle}>
            Deletion request received. Confirmation code:{" "}
            <strong>{confirmation}</strong>
            <br />
            Your data will be fully deleted within 30 days. A confirmation
            email will be sent when deletion completes.
          </div>
        )}

        <section>
          <h2 style={h2Style}>Your Right to Deletion</h2>
          <p style={pStyle}>
            You have the right to request deletion of any personal data
            PULSE by OASIS holds about you. We honor all deletion requests
            within <strong>30 days</strong>.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>How to Request Deletion</h2>
          <p style={pStyle}>
            You can request deletion of your data using either of the
            following methods:
          </p>

          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>
              Method 1 — Email Request
            </h3>
            <p style={pStyle}>
              Send an email to{" "}
              <a href="mailto:Konamak@icloud.com?subject=Data%20Deletion%20Request" style={linkStyle}>
                Konamak@icloud.com
              </a>{" "}
              with the subject line:
            </p>
            <p style={pStyle}>
              <span style={codeStyle}>Data Deletion Request</span>
            </p>
            <p style={pStyle}>
              In the body, include your Instagram username (and/or Instagram
              user ID if you know it). We will confirm receipt within 48
              hours and complete deletion within 30 days.
            </p>
          </div>

          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>
              Method 2 — Self-Serve via Instagram DM
            </h3>
            <p style={pStyle}>
              If you have interacted with an Instagram account that uses
              PULSE, you can trigger automated deletion by sending a DM to
              that account (or to{" "}
              <a
                href="https://instagram.com/ccmckennaa"
                style={linkStyle}
                target="_blank"
                rel="noopener noreferrer"
              >
                @ccmckennaa
              </a>
              ) with the exact message:
            </p>
            <p style={pStyle}>
              <span style={codeStyle}>DELETE MY DATA</span>
            </p>
            <p style={pStyle}>
              Our system will detect the request, delete all records tied to
              your Instagram user ID, and reply with a confirmation message.
            </p>
          </div>
        </section>

        <section>
          <h2 style={h2Style}>What Gets Deleted</h2>
          <p style={pStyle}>
            When we process a deletion request, we permanently remove all
            records tied to your Instagram user ID from the following tables:
          </p>
          <ul style={ulStyle}>
            <li style={liStyle}>
              <strong>subscribers</strong> — your IG user ID, username,
              display name, profile picture URL, tags, and interaction
              metadata.
            </li>
            <li style={liStyle}>
              <strong>dm_threads</strong> — any conversation threads between
              you and the account owner.
            </li>
            <li style={liStyle}>
              <strong>dm_messages</strong> — all individual DM messages
              (inbound, outbound, AI drafts) involving you.
            </li>
            <li style={liStyle}>
              <strong>comment_events</strong> — any public comments of yours
              that triggered PULSE automations.
            </li>
          </ul>
          <p style={pStyle}>
            Aggregated analytics (totals and counts with no personal
            identifiers) are not reversed — but your individual records are
            fully removed.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>Timeline</h2>
          <ul style={ulStyle}>
            <li style={liStyle}>
              <strong>Email request:</strong> confirmation within 48 hours.
              Full deletion within 30 days.
            </li>
            <li style={liStyle}>
              <strong>Self-serve DM (&ldquo;DELETE MY DATA&rdquo;):</strong>{" "}
              automated deletion within minutes; email confirmation sent
              within 24 hours if we have an email on file for the account
              owner.
            </li>
            <li style={liStyle}>
              <strong>Meta automated deletion callback:</strong> handled by
              our <code style={codeStyle}>/api/meta-data-deletion</code>{" "}
              endpoint — deletion is performed immediately upon a verified
              signed request from Meta.
            </li>
          </ul>
        </section>

        <section>
          <h2 style={h2Style}>Confirmation</h2>
          <p style={pStyle}>
            Once deletion completes, we send an email confirmation to the
            address associated with your request (if provided). For
            Meta-initiated requests, a confirmation URL and confirmation
            code are returned to Meta per their platform spec.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>Questions</h2>
          <p style={pStyle}>
            If you have questions about a deletion request or haven&rsquo;t
            received confirmation, email{" "}
            <a href="mailto:Konamak@icloud.com" style={linkStyle}>
              Konamak@icloud.com
            </a>
            .
          </p>
        </section>

        <div style={footerStyle}>
          PULSE by OASIS · Operated by OASIS AI Solutions ·{" "}
          <a href="/privacy" style={linkStyle}>
            Privacy
          </a>{" "}
          ·{" "}
          <a href="/terms" style={linkStyle}>
            Terms
          </a>
        </div>
      </div>
    </main>
  );
}
