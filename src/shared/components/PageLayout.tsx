import type { Component, JSX } from 'solid-js';

interface Props {
  title: string;
  children: JSX.Element;
}

const PageLayout: Component<Props> = (props) => {
  return (
    <div class="flex flex-col min-h-screen bg-surface">
      <header class="bg-surface-light border-b border-surface-lighter px-4 py-3">
        <div class="max-w-lg mx-auto">
          <h1 class="text-lg font-bold text-on-surface">{props.title}</h1>
        </div>
      </header>
      <main class="flex-1 overflow-y-auto pb-20">
        <div class="max-w-lg mx-auto">
          {props.children}
        </div>
      </main>
    </div>
  );
};

export default PageLayout;
