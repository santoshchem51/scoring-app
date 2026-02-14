import type { Component } from 'solid-js';

interface SkeletonProps {
  class?: string;
}

const Skeleton: Component<SkeletonProps> = (props) => {
  return <div class={`skeleton ${props.class ?? ''}`} />;
};

export const PageSkeleton: Component = () => {
  return (
    <div class="p-4 space-y-4">
      <Skeleton class="h-6 w-32" />
      <Skeleton class="h-24 w-full" />
      <Skeleton class="h-24 w-full" />
      <Skeleton class="h-24 w-full" />
    </div>
  );
};

export const CardSkeleton: Component = () => {
  return (
    <div class="bg-surface-light rounded-xl p-4 space-y-3">
      <div class="flex justify-between">
        <Skeleton class="h-4 w-24" />
        <Skeleton class="h-4 w-16" />
      </div>
      <div class="flex justify-between items-center">
        <Skeleton class="h-6 w-20" />
        <Skeleton class="h-8 w-16" />
        <Skeleton class="h-6 w-20" />
      </div>
      <Skeleton class="h-3 w-40" />
    </div>
  );
};

export default Skeleton;
