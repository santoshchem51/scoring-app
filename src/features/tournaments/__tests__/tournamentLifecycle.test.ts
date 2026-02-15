import { describe, it, expect } from 'vitest';
import { generatePools } from '../engine/poolGenerator';
import { generateRoundRobinSchedule } from '../engine/roundRobin';
import { calculateStandings } from '../engine/standings';
import { seedBracketFromPools } from '../engine/bracketSeeding';
import { generateBracket } from '../engine/bracketGenerator';
import { createTeamsFromRegistrations } from '../engine/teamFormation';
import type { TournamentRegistration, Match } from '../../../data/types';

const makeReg = (userId: string, overrides?: Partial<TournamentRegistration>): TournamentRegistration => ({
  id: `reg-${userId}`,
  tournamentId: 't1',
  userId,
  teamId: null,
  paymentStatus: 'unpaid',
  paymentNote: '',
  lateEntry: false,
  skillRating: null,
  partnerId: null,
  partnerName: null,
  profileComplete: false,
  registeredAt: Date.now(),
  ...overrides,
});

describe('tournament lifecycle integration', () => {
  describe('singles round-robin: registration → pool-play → completed', () => {
    it('creates teams from registrations, generates pools, calculates standings', () => {
      // 1. Create registrations
      const regs = [makeReg('p1'), makeReg('p2'), makeReg('p3'), makeReg('p4')];

      // 2. Create teams (singles mode)
      const { teams } = createTeamsFromRegistrations(regs, 't1', 'singles');
      expect(teams).toHaveLength(4);

      // 3. Generate pools (1 pool for round-robin)
      const teamIds = teams.map((t) => t.id);
      const poolAssignments = generatePools(teamIds, 1);
      expect(poolAssignments).toHaveLength(1);
      expect(poolAssignments[0]).toHaveLength(4);

      // 4. Generate schedule
      const schedule = generateRoundRobinSchedule(poolAssignments[0]);
      expect(schedule.length).toBe(6); // 4 teams = 6 matches

      // 5. Calculate standings (no matches yet)
      const standings = calculateStandings(
        poolAssignments[0],
        [],
        () => ({ team1: '', team2: '' }),
      );
      expect(standings).toHaveLength(4);
      expect(standings.every((s) => s.wins === 0 && s.losses === 0)).toBe(true);
    });
  });

  describe('doubles auto-pair elimination: registration → bracket → completed', () => {
    it('auto-pairs players, generates bracket, validates seeding', () => {
      // 1. Create registrations with ratings
      const regs = [
        makeReg('p1', { skillRating: 5.0 }),
        makeReg('p2', { skillRating: 5.0 }),
        makeReg('p3', { skillRating: 4.0 }),
        makeReg('p4', { skillRating: 4.0 }),
        makeReg('p5', { skillRating: 3.0 }),
        makeReg('p6', { skillRating: 3.0 }),
        makeReg('p7', { skillRating: 3.5 }),
        makeReg('p8', { skillRating: 3.5 }),
      ];

      // 2. Create teams (auto-pair)
      const { teams, unmatched } = createTeamsFromRegistrations(regs, 't1', 'auto-pair');
      expect(teams).toHaveLength(4);
      expect(unmatched).toHaveLength(0);

      // 3. Generate bracket
      const teamIds = teams.map((t) => t.id);
      const slots = generateBracket('t1', teamIds);

      // 4 teams = 3 slots (2 semifinals + 1 final)
      expect(slots).toHaveLength(3);

      // First round should have 2 matches
      const firstRound = slots.filter((s) => s.round === 1);
      expect(firstRound).toHaveLength(2);

      // Final should have no teams yet
      const final = slots.filter((s) => s.round === 2);
      expect(final).toHaveLength(1);
      expect(final[0].team1Id).toBeNull();
      expect(final[0].team2Id).toBeNull();
    });
  });

  describe('pool-bracket format: full lifecycle', () => {
    it('creates pools, seeds bracket from pool standings', () => {
      // 1. Create 8 teams (pre-formed)
      const teamIds = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'];

      // 2. Generate 2 pools
      const poolAssignments = generatePools(teamIds, 2);
      expect(poolAssignments).toHaveLength(2);
      expect(poolAssignments[0]).toHaveLength(4);
      expect(poolAssignments[1]).toHaveLength(4);

      // 3. Simulate pool standings
      const poolAStandings = [
        { teamId: poolAssignments[0][0], wins: 3, losses: 0, pointsFor: 33, pointsAgainst: 15, pointDiff: 18 },
        { teamId: poolAssignments[0][1], wins: 2, losses: 1, pointsFor: 28, pointsAgainst: 20, pointDiff: 8 },
        { teamId: poolAssignments[0][2], wins: 1, losses: 2, pointsFor: 20, pointsAgainst: 28, pointDiff: -8 },
        { teamId: poolAssignments[0][3], wins: 0, losses: 3, pointsFor: 15, pointsAgainst: 33, pointDiff: -18 },
      ];
      const poolBStandings = [
        { teamId: poolAssignments[1][0], wins: 3, losses: 0, pointsFor: 30, pointsAgainst: 12, pointDiff: 18 },
        { teamId: poolAssignments[1][1], wins: 2, losses: 1, pointsFor: 25, pointsAgainst: 18, pointDiff: 7 },
        { teamId: poolAssignments[1][2], wins: 1, losses: 2, pointsFor: 18, pointsAgainst: 25, pointDiff: -7 },
        { teamId: poolAssignments[1][3], wins: 0, losses: 3, pointsFor: 12, pointsAgainst: 30, pointDiff: -18 },
      ];

      // 4. Seed bracket from pools (top 2 advance)
      const seeded = seedBracketFromPools([poolAStandings, poolBStandings], 2);
      expect(seeded).toHaveLength(4);

      // 5. Generate bracket
      const slots = generateBracket('t1', seeded);
      expect(slots).toHaveLength(3);

      // First round should have 2 matches
      const firstRound = slots.filter((s) => s.round === 1);
      expect(firstRound).toHaveLength(2);
    });
  });

  describe('BYOP team formation', () => {
    it('matches mutual partner requests', () => {
      const regs = [
        makeReg('p1', { partnerName: 'Bob' }),
        makeReg('p2', { partnerName: 'Alice' }),
        makeReg('p3'),
        makeReg('p4'),
      ];
      const userNames: Record<string, string> = { p1: 'Alice', p2: 'Bob', p3: 'Charlie', p4: 'Diana' };

      const { teams, unmatched } = createTeamsFromRegistrations(regs, 't1', 'byop', userNames);

      expect(teams).toHaveLength(1);
      expect(teams[0].playerIds.sort()).toEqual(['p1', 'p2']);
      expect(unmatched).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('handles minimum viable tournament (2 players singles)', () => {
      const regs = [makeReg('p1'), makeReg('p2')];
      const { teams } = createTeamsFromRegistrations(regs, 't1', 'singles');
      expect(teams).toHaveLength(2);

      const slots = generateBracket('t1', teams.map((t) => t.id));
      expect(slots).toHaveLength(1); // single final match
    });

    it('handles auto-pair with all same rating', () => {
      const regs = [
        makeReg('p1', { skillRating: 3.5 }),
        makeReg('p2', { skillRating: 3.5 }),
        makeReg('p3', { skillRating: 3.5 }),
        makeReg('p4', { skillRating: 3.5 }),
      ];
      const { teams } = createTeamsFromRegistrations(regs, 't1', 'auto-pair');
      expect(teams).toHaveLength(2);
    });

    it('handles large tournament (16 teams, 4 pools)', () => {
      const teamIds = Array.from({ length: 16 }, (_, i) => `team-${i + 1}`);
      const poolAssignments = generatePools(teamIds, 4);

      expect(poolAssignments).toHaveLength(4);
      expect(poolAssignments.every((p) => p.length === 4)).toBe(true);

      // Each pool should have 6 matches (4 teams round-robin)
      for (const pool of poolAssignments) {
        const schedule = generateRoundRobinSchedule(pool);
        expect(schedule).toHaveLength(6);
      }
    });
  });
});
