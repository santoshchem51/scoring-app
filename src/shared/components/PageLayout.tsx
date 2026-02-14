import type { Component, JSX } from 'solid-js';

interface Props {
  title: string;
  children: JSX.Element;
}

const PageLayout: Component<Props> = (props) => {
  return (
    <div class="flex flex-col min-h-screen bg-surface">
      <header class="bg-surface-light border-b border-surface-lighter px-4 py-3">
        <h1 class="text-lg font-bold text-on-surface">{props.title}</h1>
      </header>
      <main class="flex-1 overflow-y-auto pb-20">
        {props.children}
      </main>
    </div>
  );
};

export default PageLayout;
