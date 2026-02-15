import type { Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';

const TournamentDashboardPage: Component = () => {
  const params = useParams();
  return (
    <PageLayout title="Tournament">
      <div class="p-4">
        <p class="text-on-surface-muted">Tournament {params.id} dashboard coming soon.</p>
      </div>
    </PageLayout>
  );
};

export default TournamentDashboardPage;
