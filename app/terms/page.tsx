import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — PULSE by OASIS",
  description:
    "Terms of Service for PULSE by OASIS, an AI-powered Instagram DM automation platform operated by OASIS AI Solutions.",
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

export default function TermsOfServicePage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <a href="/" style={backLinkStyle}>
          ← Back to PULSE
        </a>

        <h1 style={h1Style}>Terms of Service</h1>
        <p style={leadStyle}>Last updated: April 16, 2026</p>

        <section>
          <h2 style={h2Style}>1. Acceptance of Terms</h2>
          <p style={pStyle}>
            By accessing or using PULSE by OASIS (&ldquo;PULSE,&rdquo; the
            &ldquo;Service&rdquo;), you agree to be bound by these Terms of
            Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the
            Service. PULSE is operated by <strong>OASIS AI Solutions</strong>,
            Collingwood, Ontario, Canada.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>2. Service Description</h2>
          <p style={pStyle}>
            PULSE is an AI-powered Instagram direct message (DM) management
            platform. It provides tools for inbound DM handling, AI-drafted
            replies, comment-to-DM automation, welcome messages, broadcasts,
            subscriber segmentation, and conversion analytics, integrated
            with the Meta Graph and Messenger APIs.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>3. Eligibility</h2>
          <p style={pStyle}>
            You must be at least 18 years of age and capable of forming a
            legally binding contract to use PULSE. The Service is intended
            for business use only.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>4. User Responsibilities</h2>
          <p style={pStyle}>By using PULSE, you agree to:</p>
          <ul style={ulStyle}>
            <li style={liStyle}>
              Only use PULSE with Instagram accounts that you own or have
              explicit, documented authorization to manage.
            </li>
            <li style={liStyle}>
              Comply with the{" "}
              <a
                href="https://developers.facebook.com/terms/"
                style={linkStyle}
                target="_blank"
                rel="noopener noreferrer"
              >
                Meta Platform Terms
              </a>
              , the{" "}
              <a
                href="https://help.instagram.com/581066165581870/"
                style={linkStyle}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram Community Guidelines
              </a>
              , and all applicable Meta developer policies.
            </li>
            <li style={liStyle}>
              Not use PULSE to send spam, unsolicited bulk messages,
              harassment, threats, hate speech, or misleading content.
            </li>
            <li style={liStyle}>
              Not use PULSE to impersonate any person, brand, or entity.
            </li>
            <li style={liStyle}>
              Not use PULSE to distribute malware, phishing links, illegal
              content, adult content, or any content prohibited by Meta or
              applicable law.
            </li>
            <li style={liStyle}>
              Honor the Instagram 24-hour messaging window and respect user
              opt-outs (e.g., &ldquo;stop,&rdquo; &ldquo;unsubscribe&rdquo;).
            </li>
            <li style={liStyle}>
              Keep your API keys and credentials confidential. You are
              responsible for all activity under your account.
            </li>
            <li style={liStyle}>
              Comply with all applicable privacy laws (GDPR, CCPA, PIPEDA)
              regarding the data you process through PULSE.
            </li>
          </ul>
        </section>

        <section>
          <h2 style={h2Style}>5. Prohibited Uses</h2>
          <p style={pStyle}>
            You may not use PULSE to scrape data, reverse-engineer the Service,
            circumvent rate limits, resell the Service without written
            permission, or engage in any activity that would cause Meta to
            restrict or revoke our platform access.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>6. No Warranty</h2>
          <p style={pStyle}>
            PULSE is provided <strong>&ldquo;as is&rdquo;</strong> and{" "}
            <strong>&ldquo;as available&rdquo;</strong> without warranties of
            any kind, express or implied, including but not limited to
            warranties of merchantability, fitness for a particular purpose,
            non-infringement, or uninterrupted operation. AI-generated reply
            drafts are suggestions only; you are responsible for reviewing and
            approving content before it is sent (unless you have explicitly
            enabled auto-send).
          </p>
        </section>

        <section>
          <h2 style={h2Style}>7. Limitation of Liability</h2>
          <p style={pStyle}>
            To the maximum extent permitted by law, OASIS AI Solutions shall
            not be liable for any indirect, incidental, consequential,
            special, or punitive damages, including but not limited to lost
            profits, lost revenue, lost data, business interruption, or loss
            of goodwill, arising out of or related to your use of PULSE. Our
            total aggregate liability for any claim shall not exceed the
            greater of (a) fees paid by you to OASIS AI Solutions in the
            twelve (12) months preceding the claim, or (b) one hundred
            Canadian dollars (CAD $100).
          </p>
        </section>

        <section>
          <h2 style={h2Style}>8. Indemnification</h2>
          <p style={pStyle}>
            You agree to indemnify and hold harmless OASIS AI Solutions, its
            officers, directors, and affiliates from any claims, damages,
            liabilities, or expenses (including reasonable legal fees)
            arising out of your use of the Service, your content, or your
            breach of these Terms.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>9. Account Termination</h2>
          <p style={pStyle}>
            Either party may terminate the Service with reasonable notice.
            OASIS AI Solutions reserves the right to suspend or terminate
            accounts that violate these Terms, Meta platform policies, or
            applicable law — effective immediately and without prior notice
            when necessary to protect the Service, other users, or comply
            with law. Upon termination, you may request deletion of your data
            per our{" "}
            <a href="/privacy" style={linkStyle}>
              Privacy Policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 style={h2Style}>10. Changes to the Service and Terms</h2>
          <p style={pStyle}>
            We may modify the Service or these Terms at any time. Material
            changes to the Terms will be communicated to active users. Your
            continued use of the Service after the effective date of changes
            constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>11. Governing Law</h2>
          <p style={pStyle}>
            These Terms are governed by the laws of the Province of Ontario
            and the federal laws of Canada applicable therein, without regard
            to conflict-of-law principles. Any dispute shall be resolved in
            the courts of Ontario, Canada.
          </p>
        </section>

        <section>
          <h2 style={h2Style}>12. Contact</h2>
          <p style={pStyle}>
            For any questions about these Terms, contact:
            <br />
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
          <a href="/privacy" style={linkStyle}>
            Privacy
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
