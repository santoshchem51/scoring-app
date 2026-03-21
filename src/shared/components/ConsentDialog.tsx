import type { Component } from 'solid-js';

interface Props {
  onAccept: () => void;
  onDecline: () => void;
}

export const ConsentDialog: Component<Props> = (props) => {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h2 class="text-lg font-semibold text-white mb-3">Help Improve PickleScore</h2>
        <p class="text-gray-300 text-sm mb-6">
          Share de-identified usage data and crash reports to help us improve the app.
          This data is linked to a random identifier, not your name or email.
          You can change this anytime in Settings.
        </p>
        <div class="flex gap-3">
          <button
            type="button"
            class="flex-1 px-4 py-2.5 rounded-lg bg-gray-700 text-gray-200 font-medium text-sm"
            onClick={() => props.onDecline()}
          >
            Decline
          </button>
          <button
            type="button"
            class="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm"
            onClick={() => props.onAccept()}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};
