import { Show, For, createSignal, createEffect, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import {
  filteredNotifications,
  notificationsReady,
  unreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../store/notificationStore';
import NotificationRow from './NotificationRow';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  bellRef?: HTMLButtonElement;
  uid: string;
}

const NotificationPanel: Component<NotificationPanelProps> = (props) => {
  let panelRef: HTMLDivElement | undefined;
  const [markingAll, setMarkingAll] = createSignal(false);

  // Focus panel when it opens
  createEffect(() => {
    if (props.open && panelRef) {
      queueMicrotask(() => {
        panelRef?.focus();
      });
    }
  });

  // Escape key handler
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose();
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(props.uid);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleRead = (notifId: string) => {
    markNotificationRead(props.uid, notifId);
  };

  // Return focus to bellRef on cleanup when panel was open
  onCleanup(() => {
    if (props.bellRef) {
      props.bellRef.focus();
    }
  });

  return (
    <Show when={props.open}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-panel-title"
        tabIndex={-1}
        class="w-[calc(100vw-24px)] max-w-[340px] max-h-[55vh] overflow-y-auto bg-surface-light rounded-xl shadow-lg border border-surface-lighter"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-surface-lighter">
          <h2
            id="notif-panel-title"
            class="text-sm font-semibold text-on-surface"
          >
            Notifications
          </h2>
          <Show when={unreadCount() > 0}>
            <button
              class="text-xs text-accent hover:underline disabled:opacity-50"
              disabled={markingAll()}
              onClick={handleMarkAllRead}
            >
              Mark all read
            </button>
          </Show>
        </div>

        {/* Content */}
        <Show
          when={notificationsReady()}
          fallback={
            <div data-testid="notification-skeleton" class="px-4 py-3 space-y-3">
              <div class="animate-pulse flex items-center gap-3">
                <div class="w-2 h-2 rounded-full bg-surface-lighter" />
                <div class="flex-1 space-y-1.5">
                  <div class="h-3 bg-surface-lighter rounded w-3/4" />
                  <div class="h-2 bg-surface-lighter rounded w-1/4" />
                </div>
              </div>
              <div class="animate-pulse flex items-center gap-3">
                <div class="w-2 h-2 rounded-full bg-surface-lighter" />
                <div class="flex-1 space-y-1.5">
                  <div class="h-3 bg-surface-lighter rounded w-5/6" />
                  <div class="h-2 bg-surface-lighter rounded w-1/3" />
                </div>
              </div>
              <div class="animate-pulse flex items-center gap-3">
                <div class="w-2 h-2 rounded-full bg-surface-lighter" />
                <div class="flex-1 space-y-1.5">
                  <div class="h-3 bg-surface-lighter rounded w-2/3" />
                  <div class="h-2 bg-surface-lighter rounded w-1/5" />
                </div>
              </div>
            </div>
          }
        >
          <Show
            when={filteredNotifications().length > 0}
            fallback={
              <p class="text-center text-on-surface-muted py-8 text-sm">
                No notifications yet
              </p>
            }
          >
            <ul role="list">
              <For each={filteredNotifications()}>
                {(notif) => (
                  <NotificationRow notification={notif} onRead={handleRead} />
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </div>
    </Show>
  );
};

export default NotificationPanel;
