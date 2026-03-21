export default function PrivacyPolicy() {
  return (
    <div class="min-h-screen bg-surface text-on-surface px-4 py-8 max-w-3xl mx-auto">
      <h1 class="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p class="text-on-surface-muted mb-8">Last updated: March 21, 2026</p>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-3">What We Collect</h2>
        <p class="mb-2">
          PickleScore collects only the data necessary to provide the scoring experience:
        </p>
        <ul class="list-disc list-inside space-y-1 text-on-surface-muted">
          <li>Account information (email address, display name) when you sign in with Google</li>
          <li>Match scores, player names, and game history that you create</li>
          <li>App preferences and settings stored locally on your device</li>
        </ul>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-3">Why We Collect It</h2>
        <p class="text-on-surface-muted">
          We use your data solely to provide and improve the PickleScore app experience —
          storing your match history, syncing data across devices, and enabling tournament
          and group features. We do not sell your data to third parties.
        </p>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-3">Third-Party Services</h2>
        <p class="mb-2 text-on-surface-muted">
          PickleScore uses the following third-party services:
        </p>
        <ul class="list-disc list-inside space-y-1 text-on-surface-muted">
          <li>
            <strong class="text-on-surface">Google Firebase</strong> — Authentication, Cloud Firestore
            database, and hosting. See{' '}
            <a
              href="https://firebase.google.com/support/privacy"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary underline"
            >
              Firebase Privacy Policy
            </a>.
          </li>
          <li>
            <strong class="text-on-surface">Google Cloud Platform</strong> — Firebase may collect
            basic crash and performance data as part of its standard operation. See{' '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary underline"
            >
              Google Privacy Policy
            </a>.
          </li>
          <li>
            <strong class="text-on-surface">Sentry</strong> — Error tracking and crash reporting.
            When you consent to analytics, de-identified error reports are sent to Sentry to help
            us identify and fix bugs. No personally identifiable information is included in error
            reports. See{' '}
            <a
              href="https://sentry.io/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary underline"
            >
              Sentry Privacy Policy
            </a>.
          </li>
          <li>
            <strong class="text-on-surface">Firebase Analytics</strong> — De-identified usage data
            (e.g., which features are used, session counts). No user IDs, names, scores, or
            match details are included. Analytics data is retained for 2 months. Collection
            requires your explicit consent and can be disabled at any time in Settings.
          </li>
        </ul>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-3">Cookies & Local Storage</h2>
        <p class="mb-2 text-on-surface-muted">
          PickleScore uses browser local storage (not cookies) to store:
        </p>
        <ul class="list-disc list-inside space-y-1 text-on-surface-muted">
          <li>Your app preferences and settings</li>
          <li>Your analytics consent choice</li>
          <li>Offline match data (via IndexedDB)</li>
        </ul>
        <p class="mt-2 text-on-surface-muted">
          No third-party tracking cookies are used. Firebase and Sentry may use
          their own storage mechanisms as described in their respective privacy policies.
        </p>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-3">Operational Logs</h2>
        <p class="text-on-surface-muted">
          Our server-side systems (Cloud Functions) generate operational logs that may
          contain your internal account identifier (not your name or email) for debugging purposes. These logs are automatically
          deleted within 30 days and are not shared with third parties.
        </p>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-3">Data Retention & Deletion</h2>
        <p class="mb-2 text-on-surface-muted">
          Your match data is stored as long as you maintain an active account. You can
          delete your account and all associated data at any time from the Settings page
          in the app. This permanently removes your profile, match history, statistics,
          achievements, and leaderboard entries. You may also contact us by email for
          data deletion requests.
        </p>
        <p class="text-on-surface-muted">
          Local data stored on your device (via IndexedDB) can be cleared at any time
          through your browser settings or by uninstalling the app.
        </p>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-3">Children's Privacy</h2>
        <p class="text-on-surface-muted">
          PickleScore is not directed at children under 13. We do not knowingly collect
          personal information from children under 13. If you believe a child under 13
          has provided us with personal data, please contact us so we can remove it.
        </p>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-3">Your Rights</h2>
        <p class="mb-2 text-on-surface-muted">
          Depending on your location, you may have certain rights regarding your personal data,
          including:
        </p>
        <ul class="list-disc list-inside space-y-1 text-on-surface-muted">
          <li>The right to access the personal data we hold about you</li>
          <li>The right to request correction of inaccurate data</li>
          <li>The right to request deletion of your data</li>
          <li>The right to data portability</li>
          <li>The right to object to or restrict processing of your data</li>
        </ul>
        <p class="mt-2 text-on-surface-muted">
          To exercise any of these rights, please contact us at the email address below.
          We will respond to your request within 30 days.
        </p>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-3">Changes to This Policy</h2>
        <p class="text-on-surface-muted">
          We may update this privacy policy from time to time. We will notify you of any
          changes by posting the new privacy policy on this page and updating the
          "Last updated" date. You are advised to review this page periodically.
        </p>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-3">Contact</h2>
        <p class="text-on-surface-muted">
          If you have questions about this privacy policy or wish to request data deletion,
          contact us at{' '}
          <a href="mailto:privacy@picklescore.co" class="text-primary underline">
            privacy@picklescore.co
          </a>.
        </p>
      </section>

      <div class="pt-4 border-t border-surface-alt">
        <a href="/" class="text-primary underline text-sm">
          &larr; Back to Home
        </a>
      </div>
    </div>
  );
}
