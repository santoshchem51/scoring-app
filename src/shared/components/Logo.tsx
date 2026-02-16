import { Show } from 'solid-js';
import type { Component } from 'solid-js';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showIcon?: boolean;
}

const LogoIcon: Component<{ class?: string }> = (props) => (
  <svg class={props.class} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="16" cy="14" r="9" stroke="currentColor" stroke-width="2" class="text-primary" />
    <circle cx="13" cy="11" r="1.3" fill="currentColor" class="text-primary" />
    <circle cx="19" cy="11" r="1.3" fill="currentColor" class="text-primary" />
    <circle cx="16" cy="15" r="1.3" fill="currentColor" class="text-primary" />
    <circle cx="12" cy="17" r="1.3" fill="currentColor" class="text-primary" />
    <circle cx="20" cy="17" r="1.3" fill="currentColor" class="text-primary" />
    <rect x="8" y="26" width="16" height="2.5" rx="1.25" fill="currentColor" class="text-score" />
  </svg>
);

const Logo: Component<LogoProps> = (props) => {
  const sizeClass = () => {
    switch (props.size ?? 'md') {
      case 'sm': return 'text-lg';
      case 'md': return 'text-xl';
      case 'lg': return 'text-3xl';
      case 'xl': return 'text-5xl';
    }
  };

  const iconSize = () => {
    switch (props.size ?? 'md') {
      case 'sm': return 'w-5 h-5';
      case 'md': return 'w-6 h-6';
      case 'lg': return 'w-9 h-9';
      case 'xl': return 'w-12 h-12';
    }
  };

  return (
    <span class={`inline-flex items-center gap-1.5 font-bold ${sizeClass()}`} style={{ "font-family": "var(--font-score)" }}>
      <Show when={props.showIcon}>
        <LogoIcon class={iconSize()} />
      </Show>
      <span>
        <span class="text-primary">Pickle</span>
        <span class="text-score">Score</span>
      </span>
    </span>
  );
};

export { LogoIcon };
export default Logo;
