import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — PULSE by OASIS",
  description:
    "Privacy Policy for PULSE by OASIS, an AI-powered Instagram DM automation platform operated by OASIS AI Solutions.",
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

export default function PrivacyPolicyPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <a href="/" style={backLinkStyle}>
          ← Back to PULSE
        </a>

        <h1 style={h1Style}>Privacy Policy</h1>
        <p style={leadStyle}>Last updated: April 16, 2026</p>

        <section>
          <h2 style={h2Style}>1. Who We Are</h2>
          <p style={pStyle}>
            PULSE by OASIS (&ldquo;PULSE,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is an
            AI-powered Instagram DM automation platform operated by{" "}
            <strong>OASIS AI Solutions</strong>, based in Collingwood, Ontario,
            Canada.
          </p>
          <p style={pStyle}>
            For any privacy-related questions, requests, or concerns, contact
            us at{" "}
            <a href="mailto:Konamak@icloud.com" style={linkStyle}>
              Konamak@icloud.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 style={h2Style}>2. What Data We Collect</h2>
          <p style={pStyle}>
            PULSE is operated by the Instagram account owner who has installed
            and authorized the service on their own business account. In the
            course of operating the service, we process the following data:
          </p>

          <h3 style={h3Style}>Instagram profile data (from Meta Graph API)</h3>
          <ul style={ulStyle}>
            <li style={liStyle}>Instagram user IDs (IGSID)</li>
            <li style={liStyle}>Instagram usernames</li>
            <li style={liStyle}>Public display names</li>
            <li style={liStyle}>Public profile picture URLs</li>
          </ul>

          <h3 style={h3Style}>Conversation data</h3>
          <ul style={ulStyle}>
            <li style={liStyle}>Inbound direct message (DM) content</li>
            <li style={liStyle}>AI-generated reply drafts</li>
            <li style={liStyle}>Outbound replies (sent by the account owner or auto-sent)</li>
            <li style={liStyle}>Public comment content on posts the account owner has configured as triggers</li>
            <li style={liStyle}>Full conversation history (message threads between the account and the user)</li>
            <li style={liStyle}>Interaction timestamps (when messages were sent, received, or read)</li>
          </ul>

          <p style={pStyle}>
            We do <strong>not</strong> collect payment data, precise location
            data, biometric data, sensitive personal information, or any data
            outside of the Instagram Messenger and Graph API scope.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>3. Why We Collect It</h2>
          <ul style={ulStyle}>
            <li style={liStyle}>
              <strong>To operate the service:</strong> receive, store, and
              display DMs and comments for the account owner.
            </li>
            <li style={liStyle}>
              <strong>To generate AI-drafted replies:</strong> message content
              is processed by our AI provider (Anthropic) to produce
              context-aware reply suggestions.
            </li>
            <li style={liStyle}>
              <strong>To track conversion funnels:</strong> aggregated metrics
              (e.g., reply rates, conversion to booked calls) for the account
              owner&rsquo;s dashboard.
            </li>
            <li style={liStyle}>
              <strong>To operate automations:</strong> execute comment-to-DM
              triggers, welcome messages, broadcasts, and sequences the account
              owner has configured.
            </li>
          </ul>
          <p style={pStyle}>
            We do not use this data for advertising, profiling outside the
            service, or sale to third parties.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>4. How We Store It</h2>
          <p style={pStyle}>
            Data is stored in <strong>Turso</strong>, a managed SQLite edge
            database, encrypted at rest. Access to the database is restricted
            to the account owner via API key authentication. API endpoints
            that modify data require a secret bearer token; webhook endpoints
            verify Meta-signed payloads before processing.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>5. Third-Party Processors</h2>
          <p style={pStyle}>
            We use the following sub-processors to operate the service. We do
            not sell, rent, or share your data beyond these processors, and
            each is contractually or by-service-terms obligated to protect it.
          </p>
          <ul style={ulStyle}>
            <li style={liStyle}>
              <strong>Anthropic</strong> — AI reply generation. Message content
              is sent to Anthropic&rsquo;s API to produce draft replies.
            </li>
            <li style={liStyle}>
              <strong>n8n</strong> — workflow execution for automations and
              sequences.
            </li>
            <li style={liStyle}>
              <strong>Vercel</strong> — application hosting and edge delivery.
            </li>
            <li style={liStyle}>
              <strong>Turso</strong> — encrypted SQLite database.
            </li>
            <li style={liStyle}>
              <strong>Meta Platforms, Inc.</strong> — the Instagram Graph and
              Messenger APIs (the source of the data).
            </li>
          </ul>
        </section>

        <section>
          <h2 style={h2Style}>6. Your Rights (GDPR / CCPA / PIPEDA)</h2>
          <p style={pStyle}>You have the right to:</p>
          <ul style={ulStyle}>
            <li style={liStyle}>
              <strong>Access</strong> — request a copy of the data we hold
              about you.
            </li>
            <li style={liStyle}>
              <strong>Correct</strong> — request that we correct inaccurate
              data.
            </li>
            <li style={liStyle}>
              <strong>Delete</strong> — request deletion of your data. See our{" "}
              <a href="/data-deletion" style={linkStyle}>
                Data Deletion page
              </a>{" "}
              for instructions.
            </li>
            <li style={liStyle}>
              <strong>Object / restrict</strong> — request that we stop
              processing your data.
            </li>
            <li style={liStyle}>
              <strong>Portability</strong> — request your data in a structured,
              machine-readable format.
            </li>
          </ul>
          <p style={pStyle}>
            To exercise any of these rights, email{" "}
            <a href="mailto:Konamak@icloud.com" style={linkStyle}>
              Konamak@icloud.com
            </a>
            . We will respond within 30 days.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>7. Data Retention</h2>
          <ul style={ulStyle}>
            <li style={liStyle}>
              <strong>Messages, comments, and conversation history:</strong>{" "}
              retained for up to 90 days, then automatically purged unless the
              account owner has chosen longer retention.
            </li>
            <li style={liStyle}>
              <strong>Subscriber records (IG user ID, username, display name):</strong>{" "}
              retained while the account owner&rsquo;s account is active, or
              until a deletion request is submitted.
            </li>
            <li style={liStyle}>
              <strong>Aggregated analytics</strong> (counts, rates, totals with
              no personal identifiers) may be retained longer for historical
              reporting.
            </li>
          </ul>
        </section>

        <section>
          <h2 style={h2Style}>8. Security</h2>
          <ul style={ulStyle}>
            <li style={liStyle}>All database queries use parameterized SQL to prevent injection.</li>
            <li style={liStyle}>Webhook endpoints authenticate using a shared webhook secret and/or Meta signed-request verification.</li>
            <li style={liStyle}>API mutations require a bearer token; credentials are never exposed to the client.</li>
            <li style={liStyle}>Data is encrypted in transit (TLS) and at rest (Turso).</li>
            <li style={liStyle}>Access tokens and secrets are stored in environment variables, never in the codebase.</li>
          </ul>
        </section>

        <section>
          <h2 style={h2Style}>9. Children&rsquo;s Privacy</h2>
          <p style={pStyle}>
            PULSE is a business product intended for use by account owners who
            are 18 years of age or older. We do not knowingly collect personal
            data from children under 18. If you believe a minor&rsquo;s data is
            in our system, email us and we will delete it.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>10. Cookies</h2>
          <p style={pStyle}>
            The PULSE dashboard uses essential cookies only (for session
            management and authentication). We do not use tracking cookies,
            third-party advertising cookies, or analytics cookies that profile
            individuals.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>11. International Transfers</h2>
          <p style={pStyle}>
            Data may be processed in Canada, the United States, and other
            countries where our sub-processors (Anthropic, Vercel, Turso,
            n8n, Meta) operate infrastructure. By using PULSE, you consent to
            such transfers under standard contractual safeguards.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>12. Changes to This Policy</h2>
          <p style={pStyle}>
            We may update this Privacy Policy from time to time. The
            &ldquo;Last updated&rdquo; date at the top will reflect the most
            recent revision. Material changes will be communicated to account
            owners via email.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>13. Contact</h2>
          <p style={pStyle}>
            OASIS AI Solutions
            <br />
            Collingwood, Ontario, Canada
            <br />
            Email:{" "}
            <a href="mailto:Konamak@icloud.com" style={linkStyle}>
              Konamak@icloud.com
            </a>
          </p>
        </section>

        <div style={footerStyle}>
          PULSE by OASIS · Operated by OASIS AI Solutions ·{" "}
          <a href="/terms" style={linkStyle}>
            Terms
          </a>{" "}
          ·{" "}
          <a href="/data-deletion" style={linkStyle}>
            Data Deletion
          </a>
        </div>
      </div>
    </main>
  );
}
