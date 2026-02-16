import type { Component } from 'solid-js';
import { useParams } from '@solidjs/router';

const GroupInvitePage: Component = () => {
  const params = useParams();
  return (
    <div class="max-w-lg mx-auto px-4 pt-8 pb-24 text-center">
      <div class="text-5xl mb-4">🤝</div>
      <h1 class="text-xl font-bold text-on-surface mb-2">Group Invite</h1>
      <p class="text-on-surface-muted text-sm mb-6">Invite code: {params.code}</p>
      <a href="/buddies" class="inline-block bg-primary text-surface px-6 py-3 rounded-xl font-semibold active:scale-95 transition-transform">
        Join on PickleScore
      </a>
    </div>
  );
};

export default GroupInvitePage;
