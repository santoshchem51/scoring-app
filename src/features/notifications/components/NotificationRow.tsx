import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { AppNotification } from '../../../data/types';
import { trackEvent } from '../../../shared/observability/analytics';

interface NotificationRowProps {
  notification: AppNotification;
  onRead: (id: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const NotificationRow: Component<NotificationRowProps> = (props) => {
  const handleClick = () => {
    trackEvent('notification_opened', { type: props.notification.type });
    props.onRead(props.notification.id);
  };

  return (
    <li
      role="listitem"
      aria-label={`${props.notification.message}, ${props.notification.read ? 'read' : 'unread'}`}
      class={`min-h-[52px] flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
        props.notification.read ? 'bg-surface-light' : 'bg-surface-lighter'
      }`}
      onClick={handleClick}
    >
      <Show when={!props.notification.read}>
        <span class="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
      </Show>

      <div class="flex-1 min-w-0">
        <p
          class={`text-sm leading-snug line-clamp-2 ${
            props.notification.read
              ? 'text-on-surface-muted'
              : 'font-medium text-on-surface'
          }`}
        >
          {props.notification.message}
        </p>
        <time
          dateTime={new Date(props.notification.createdAt).toISOString()}
          class="text-xs text-on-surface-muted mt-0.5 block"
        >
          {formatRelativeTime(props.notification.createdAt)}
        </time>
      </div>
    </li>
  );
};

export default NotificationRow;
