import { Show } from 'solid-js';
import type { ParentComponent } from 'solid-js';
import { useAuth } from '../hooks/useAuth';

const RequireAuth: ParentComponent = (props) => {
  const { user, loading, signIn } = useAuth();

  return (
    <Show when={!loading()} fallback={
      <div class="flex items-center justify-center h-screen bg-surface">
        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <Show when={user()} fallback={
        <div class="flex flex-col items-center justify-center h-screen bg-surface p-6 text-center">
          <h2 class="text-xl font-bold text-on-surface mb-2">Sign in required</h2>
          <p class="text-on-surface-muted mb-6">You need to sign in to access tournaments.</p>
          <button
            type="button"
            onClick={() => signIn()}
            class="bg-primary text-surface font-semibold px-6 py-3 rounded-xl active:scale-95 transition-transform"
          >
            Sign in with Google
          </button>
        </div>
      }>
        {props.children}
      </Show>
    </Show>
  );
};

export default RequireAuth;
