import { createMemo, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { ScoreEvent } from '../../../data/types';
import {
  calculateMomentum,
  detectStreaks,
  getPointDistribution,
} from '../engine/matchAnalytics';

interface MatchAnalyticsProps {
  events: ScoreEvent[];
  team1Name: string;
  team2Name: string;
}

const TEAM1_COLOR = '#2563EB';
const TEAM2_COLOR = '#D97706';

const MatchAnalytics: Component<MatchAnalyticsProps> = (props) => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const momentumTransition = prefersReducedMotion ? 'none' : 'flex-basis 300ms';

  const momentum = createMemo(() => calculateMomentum(props.events));
  const streak = createMemo(() => detectStreaks(props.events));
  const distribution = createMemo(() => getPointDistribution(props.events));

  const runOfPlay = createMemo(() => {
    const points = props.events.filter((e) => e.type === 'POINT_SCORED');
    return points.slice(-15);
  });

  const maxDistribution = createMemo(() => {
    const d = distribution();
    return Math.max(d.team1, d.team2, 1);
  });

  return (
    <section aria-label="Match analytics">
      {/* Momentum Bar */}
      <div class="mb-4">
        <div class="flex h-8 rounded overflow-hidden">
          <div
            style={{
              "flex-basis": `${momentum().team1Pct}%`,
              "background-color": TEAM1_COLOR,
              transition: momentumTransition,
            }}
            class="flex items-center justify-center text-sm font-bold text-white"
          >
            {momentum().team1Pct}%
          </div>
          <div
            style={{
              "flex-basis": `${momentum().team2Pct}%`,
              "background-color": TEAM2_COLOR,
              transition: momentumTransition,
            }}
            class="flex items-center justify-center text-sm font-bold text-white"
          >
            {momentum().team2Pct}%
          </div>
        </div>
      </div>

      {/* Run of Play */}
      <div
        aria-label="Run of play"
        class="flex gap-1.5 items-center mb-3 flex-wrap"
      >
        <For each={runOfPlay()}>
          {(event) => (
            <span
              style={{
                color: event.team === 1 ? TEAM1_COLOR : TEAM2_COLOR,
              }}
              class="text-sm min-w-3.5 min-h-3.5 leading-3.5 text-center"
              aria-label={event.team === 1 ? props.team1Name : props.team2Name}
            >
              {event.team === 1 ? '●' : '■'}
            </span>
          )}
        </For>
      </div>

      {/* Streak Highlight */}
      <Show when={streak()}>
        {(s) => (
          <div
            style={{
              "background-color": s().team === 1 ? '#DBEAFE' : '#FEF3C7',
              color: s().team === 1 ? TEAM1_COLOR : TEAM2_COLOR,
            }}
            class="px-3 py-2 rounded font-bold mb-3"
          >
            {s().team === 1 ? props.team1Name : props.team2Name} on a {s().length}-0 run
          </div>
        )}
      </Show>

      {/* Point Distribution Chart */}
      <div class="mb-3">
        <svg
          aria-hidden="true"
          width="100%"
          height="120"
          viewBox="0 0 200 60"
          class="block"
        >
          <rect
            x="0"
            y="5"
            width={`${(distribution().team1 / maxDistribution()) * 180}`}
            height="20"
            fill={TEAM1_COLOR}
            rx="2"
          />
          <text x="185" y="20" font-size="12" text-anchor="end" fill={TEAM1_COLOR}>
            {distribution().team1}
          </text>
          <rect
            x="0"
            y="35"
            width={`${(distribution().team2 / maxDistribution()) * 180}`}
            height="20"
            fill={TEAM2_COLOR}
            rx="2"
          />
          <text x="185" y="50" font-size="12" text-anchor="end" fill={TEAM2_COLOR}>
            {distribution().team2}
          </text>
        </svg>

        {/* Screen reader accessible table */}
        <table class="sr-only">
          <caption>Point distribution</caption>
          <thead>
            <tr>
              <th>Team</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{props.team1Name}</td>
              <td>{distribution().team1}</td>
            </tr>
            <tr>
              <td>{props.team2Name}</td>
              <td>{distribution().team2}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default MatchAnalytics;
