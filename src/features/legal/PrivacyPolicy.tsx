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
            <strong class="text-on-surface">Google Analytics</strong> — Anonymous usage statistics
            to help us understand how the app is used. See{' '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary underline"
            >
              Google Privacy Policy
            </a>.
          </li>
        </ul>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-3">Data Retention & Deletion</h2>
        <p class="mb-2 text-on-surface-muted">
          Your match data is stored as long as you maintain an active account. You may
          request deletion of your data at any time by contacting us at the email below.
          Upon request, we will delete all personal data associated with your account
          within 30 days.
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
