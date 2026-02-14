import type { Component } from 'solid-js';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

const Logo: Component<LogoProps> = (props) => {
  const sizeClass = () => {
    switch (props.size ?? 'md') {
      case 'sm': return 'text-lg';
      case 'md': return 'text-xl';
      case 'lg': return 'text-3xl';
    }
  };

  return (
    <span class={`font-bold ${sizeClass()}`} style={{ "font-family": "var(--font-score)" }}>
      <span class="text-primary">Pickle</span>
      <span class="text-score">Score</span>
    </span>
  );
};

export default Logo;
