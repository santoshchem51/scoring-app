// e2e/helpers/seeders.ts
import { seedFirestoreDocAdmin } from './emulator-auth';
import { PATHS, SPECTATOR_DOC_ID } from './firestore-paths';
import {
  uid, shareCode,
  makeTournament, makeTeam, makePool, makeBracketSlot,
  makePublicMatch, makeSpectatorProjection, makeScoreEvent,
  makeBuddyGroup, makeGameSession,
  makeUserProfile, makeStatsSummary, makeMatchRefSeed,
  makeRsvp, makeNotification, makeAchievement,
} from './factories';

const DEFAULT_TEAM_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];

// -- Types ------------------------------------------------------------------

interface PoolPlayOptions {
  teamCount?: number;
  poolCount?: number;
  teamNames?: string[];
  scoringMode?: 'rally' | 'sideout';
  gameType?: 'singles' | 'doubles';
  format?: 'round-robin' | 'pool-bracket';
  withCompletedMatch?: boolean;
  tournamentOverrides?: Record<string, unknown>;
}

interface PoolPlaySeed {
  tournamentId: string;
  tournament: Record<string, unknown>;
  teams: Record<string, unknown>[];
  pools: Record<string, unknown>[];
  teamNames: string[];
  shareCode: string;
}

interface BracketOptions {
  teamCount?: number;
  teamNames?: string[];
  tournamentOverrides?: Record<string, unknown>;
}

interface BracketSeed {
  tournamentId: string;
  tournament: Record<string, unknown>;
  teams: Record<string, unknown>[];
  slotIds: string[];
  shareCode: string;
}

interface RegistrationOptions {
  teamCount?: number;
  teamNames?: string[];
  accessMode?: 'open' | 'approval';
  tournamentOverrides?: Record<string, unknown>;
}

interface RegistrationSeed {
  tournamentId: string;
  tournament: Record<string, unknown>;
  teams: Record<string, unknown>[];
  shareCode: string;
}

interface ScorekeeperOptions extends PoolPlayOptions {
  role?: string;
}

interface ScorekeeperSeed extends PoolPlaySeed {
  role: string;
}

interface SpectatorMatchOptions {
  tournamentId?: string;
  team1Name?: string;
  team2Name?: string;
  team1Score?: number;
  team2Score?: number;
  withEvents?: boolean;
  matchOverrides?: Record<string, unknown>;
}

interface SpectatorMatchSeed {
  matchId: string;
  tournamentId: string;
  shareCode: string;
}

interface BuddyGroupOptions {
  name?: string;
  description?: string;
  defaultLocation?: string;
  displayName?: string;
}

interface BuddyGroupSeed {
  groupId: string;
  group: Record<string, unknown>;
  shareCode: string;
}

interface GameSessionOptions extends BuddyGroupOptions {
  sessionTitle?: string;
  sessionLocation?: string;
  status?: string;
  visibility?: string;
  spotsTotal?: number;
  rsvpStyle?: string;
  sessionOverrides?: Record<string, unknown>;
}

interface GameSessionSeed extends BuddyGroupSeed {
  sessionId: string;
  session: Record<string, unknown>;
}

export interface BetweenGamesOptions {
  tournamentId?: string;
  team1Name?: string;
  team2Name?: string;
  game1Score?: [number, number];
}
export interface BetweenGamesSeed { matchId: string; tournamentId: string; shareCode: string; }

export interface CompletedMatchOptions {
  tournamentId?: string;
  team1Name?: string;
  team2Name?: string;
  finalScore?: [number, number];
}
export interface CompletedMatchSeed { matchId: string; tournamentId: string; shareCode: string; }

export interface CompletedTournamentOptions { teamCount?: number; }
export interface CompletedTournamentSeed {
  tournamentId: string;
  tournament: ReturnType<typeof makeTournament>;
  teams: ReturnType<typeof makeTeam>[];
  shareCode: string;
  winnerId: string;
}

export interface SessionWithRsvpsOptions {
  rsvpCount?: number;
  sessionOverrides?: Record<string, unknown>;
}
export interface SessionWithRsvpsSeed extends GameSessionSeed {
  rsvps: Array<{ userId: string; status: string }>;
}

export interface ProfileWithHistoryOptions { matchCount?: number; achievementCount?: number; }
export interface ProfileWithHistorySeed {
  profile: ReturnType<typeof makeUserProfile>;
  stats: ReturnType<typeof makeStatsSummary>;
  matchRefs: Array<{ id: string; data: Record<string, unknown> }>;
  achievements: ReturnType<typeof makeAchievement>[];
}

// -- Seeders ----------------------------------------------------------------

/**
 * Seeds a pool-play tournament with teams, pools, schedule, and standings.
 *
 * Use when: testing pool standings, match scheduling, advance-to-bracket, pool scoring.
 * NOT for: bracket-only tests (use seedBracketTournament), spectator match detail (use seedSpectatorMatch).
 */
export async function seedPoolPlayTournament(userUid: string, opts: PoolPlayOptions = {}): Promise<PoolPlaySeed> {
  const teamCount = opts.teamCount ?? 4;
  const poolCount = opts.poolCount ?? 1;
  const names = opts.teamNames ?? DEFAULT_TEAM_NAMES.slice(0, teamCount);
  const code = shareCode();
  const tournamentId = uid('tournament');

  const tournament = makeTournament({
    id: tournamentId,
    organizerId: userUid,
    status: 'pool-play',
    format: opts.format ?? 'round-robin',
    shareCode: code,
    config: {
      gameType: opts.gameType ?? 'singles',
      scoringMode: opts.scoringMode ?? 'rally',
      matchFormat: 'single',
      pointsToWin: 11,
      poolCount,
      teamsPerPoolAdvancing: 2,
    },
    registrationCounts: { confirmed: teamCount, pending: 0 },
    ...opts.tournamentOverrides,
  });
  await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

  // Create teams
  const teams: Record<string, unknown>[] = [];
  const teamsPerPool = Math.ceil(teamCount / poolCount);

  for (let i = 0; i < teamCount; i++) {
    const poolIndex = Math.floor(i / teamsPerPool);
    const poolId = `pool-${poolIndex}`;
    const team = makeTeam({
      tournamentId,
      name: names[i],
      playerIds: [`player-${i}`],
      poolId,
    });
    await seedFirestoreDocAdmin(PATHS.teams(tournamentId), team.id, team);
    teams.push(team);
  }

  // Create pools with schedule and standings
  const pools: Record<string, unknown>[] = [];
  for (let p = 0; p < poolCount; p++) {
    const poolTeams = teams.filter((t: any) => t.poolId === `pool-${p}`);
    const poolTeamIds = poolTeams.map((t: any) => t.id);

    // Build round-robin schedule
    const schedule: Record<string, unknown>[] = [];
    for (let i = 0; i < poolTeamIds.length; i++) {
      for (let j = i + 1; j < poolTeamIds.length; j++) {
        schedule.push({
          team1Id: poolTeamIds[i],
          team2Id: poolTeamIds[j],
          matchId: opts.withCompletedMatch && i === 0 && j === 1 ? uid('match') : null,
          round: schedule.length + 1,
          court: null,
        });
      }
    }

    // Build standings
    const standings = poolTeams.map((t: any) => ({
      teamId: t.id,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    }));

    const pool = makePool({
      id: `pool-${p}`,
      tournamentId,
      name: `Pool ${String.fromCharCode(65 + p)}`,
      teamIds: poolTeamIds,
      schedule,
      standings,
    });
    await seedFirestoreDocAdmin(PATHS.pools(tournamentId), pool.id as string, pool);
    pools.push(pool);
  }

  return { tournamentId, tournament, teams, pools, teamNames: names, shareCode: code };
}

/**
 * Seeds a bracket tournament with teams and bracket slots.
 *
 * Use when: testing bracket display, advance-to-completed, bracket scoring.
 * NOT for: pool-play tests (use seedPoolPlayTournament).
 */
export async function seedBracketTournament(userUid: string, opts: BracketOptions = {}): Promise<BracketSeed> {
  const teamCount = opts.teamCount ?? 4;
  const names = opts.teamNames ?? DEFAULT_TEAM_NAMES.slice(0, teamCount);
  const code = shareCode();
  const tournamentId = uid('tournament');

  const tournament = makeTournament({
    id: tournamentId,
    organizerId: userUid,
    status: 'bracket',
    format: 'single-elimination',
    shareCode: code,
    config: {
      gameType: 'singles',
      scoringMode: 'rally',
      matchFormat: 'single',
      pointsToWin: 11,
      poolCount: 0,
      teamsPerPoolAdvancing: 0,
    },
    registrationCounts: { confirmed: teamCount, pending: 0 },
    ...opts.tournamentOverrides,
  });
  await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

  const teams: Record<string, unknown>[] = [];
  for (let i = 0; i < teamCount; i++) {
    const team = makeTeam({ tournamentId, name: names[i], playerIds: [`player-${i}`] });
    await seedFirestoreDocAdmin(PATHS.teams(tournamentId), team.id, team);
    teams.push(team);
  }

  // Create bracket slots for first round
  const slotIds: string[] = [];
  const slotCount = Math.floor(teamCount / 2);
  for (let i = 0; i < slotCount; i++) {
    const slotId = uid('slot');
    const slot = makeBracketSlot({
      id: slotId,
      tournamentId,
      round: 1,
      position: i + 1,
      team1Id: (teams[i * 2] as any).id,
      team2Id: (teams[i * 2 + 1] as any).id,
    });
    await seedFirestoreDocAdmin(PATHS.bracket(tournamentId), slotId, slot);
    slotIds.push(slotId);
  }

  return { tournamentId, tournament, teams, slotIds, shareCode: code };
}

/**
 * Seeds a tournament in registration phase with optional pre-registered teams.
 *
 * Use when: testing registration flow, join/leave, player caps, approval queue.
 * NOT for: pool-play or bracket display (use the phase-specific seeders).
 */
export async function seedRegistrationTournament(userUid: string, opts: RegistrationOptions = {}): Promise<RegistrationSeed> {
  const teamCount = opts.teamCount ?? 0;
  const names = opts.teamNames ?? DEFAULT_TEAM_NAMES.slice(0, teamCount);
  const code = shareCode();
  const tournamentId = uid('tournament');

  const tournament = makeTournament({
    id: tournamentId,
    organizerId: userUid,
    status: 'registration',
    format: 'round-robin',
    shareCode: code,
    accessMode: opts.accessMode ?? 'open',
    registrationCounts: { confirmed: teamCount, pending: 0 },
    ...opts.tournamentOverrides,
  });
  await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);

  const teams: Record<string, unknown>[] = [];
  for (let i = 0; i < teamCount; i++) {
    const team = makeTeam({ tournamentId, name: names[i], playerIds: [`player-${i}`] });
    await seedFirestoreDocAdmin(PATHS.teams(tournamentId), team.id, team);
    teams.push(team);
  }

  return { tournamentId, tournament, teams, shareCode: code };
}

/**
 * Seeds a pool-play tournament where the given user is a staff member (scorekeeper by default).
 *
 * Use when: testing scorekeeper dashboard, staff permissions, match scoring from tournament.
 * NOT for: organizer tests (organizer = the user who owns the tournament, use seedPoolPlayTournament).
 */
export async function seedScorekeeperTournament(userUid: string, opts: ScorekeeperOptions = {}): Promise<ScorekeeperSeed> {
  const role = opts.role ?? 'scorekeeper';
  const seed = await seedPoolPlayTournament('other-organizer', {
    ...opts,
    tournamentOverrides: {
      staff: { [userUid]: role },
      staffUids: [userUid],
      ...opts.tournamentOverrides,
    },
  });
  return { ...seed, role };
}

/**
 * Seeds a match with spectator projection and optional score events.
 * Auto-populates `lastSnapshot` so `extractLiveScore` reads correct scores.
 *
 * Use when: testing spectator scoreboard, play-by-play, match detail page.
 * NOT for: casual scoring tests (those create matches through UI).
 */
export async function seedSpectatorMatch(userUid: string, opts: SpectatorMatchOptions = {}): Promise<SpectatorMatchSeed> {
  const tournamentId = opts.tournamentId ?? uid('tournament');
  const matchId = uid('match');
  const code = shareCode();
  const team1Name = opts.team1Name ?? 'Alpha';
  const team2Name = opts.team2Name ?? 'Bravo';
  const team1Score = opts.team1Score ?? 0;
  const team2Score = opts.team2Score ?? 0;

  // Seed tournament if not provided
  if (!opts.tournamentId) {
    const tournament = makeTournament({
      id: tournamentId,
      organizerId: userUid,
      shareCode: code,
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedFirestoreDocAdmin(PATHS.tournaments, tournamentId, tournament);
  }

  // Seed match with lastSnapshot
  const match = makePublicMatch(userUid, {
    id: matchId,
    tournamentId,
    team1Name,
    team2Name,
    status: 'in-progress',
    team1Score,
    team2Score,
    ...opts.matchOverrides,
  });
  await seedFirestoreDocAdmin(PATHS.matches, matchId, match);

  // Seed spectator projection
  const projection = makeSpectatorProjection({
    publicTeam1Name: team1Name,
    publicTeam2Name: team2Name,
    team1Score,
    team2Score,
    gameNumber: 1,
    status: 'in-progress',
    visibility: 'public',
    tournamentId,
    tournamentShareCode: code,
  });
  await seedFirestoreDocAdmin(PATHS.spectatorProjection(matchId), SPECTATOR_DOC_ID, projection);

  // Seed score events if requested
  if (opts.withEvents) {
    const events = [
      makeScoreEvent(matchId, { team: 1, team1Score: 1, team2Score: 0, timestamp: Date.now() - 30000, visibility: 'public' }),
      makeScoreEvent(matchId, { team: 2, team1Score: 1, team2Score: 1, timestamp: Date.now() - 20000, visibility: 'public' }),
      makeScoreEvent(matchId, { team: 1, team1Score: 2, team2Score: 1, timestamp: Date.now() - 10000, visibility: 'public' }),
    ];
    for (const event of events) {
      await seedFirestoreDocAdmin(PATHS.scoreEvents(matchId), event.id, event);
    }
  }

  return { matchId, tournamentId, shareCode: code };
}

/**
 * Seeds a buddy group with the given user as a member.
 *
 * Use when: testing buddy group detail, member list, session creation within a group.
 * NOT for: open-visibility sessions that don't require group membership.
 */
export async function seedBuddyGroupWithMember(userUid: string, opts: BuddyGroupOptions = {}): Promise<BuddyGroupSeed> {
  const groupId = uid('group');
  const code = shareCode();

  const group = makeBuddyGroup({
    id: groupId,
    name: opts.name ?? 'Test Group',
    description: opts.description ?? '',
    defaultLocation: opts.defaultLocation ?? null,
    shareCode: code,
    createdBy: userUid,
    memberCount: 1,
  });
  await seedFirestoreDocAdmin(PATHS.buddyGroups, groupId, group);

  await seedFirestoreDocAdmin(PATHS.buddyMembers(groupId), userUid, {
    displayName: opts.displayName ?? 'Test Player',
    photoURL: null,
    role: 'admin',
    joinedAt: Date.now(),
  });

  return { groupId, group, shareCode: code };
}

/**
 * Seeds a game session with the required buddy group membership for security rule access.
 * Only creates group/member docs when visibility is not 'open'.
 *
 * Use when: testing session detail, RSVP, voting, cancelled sessions.
 * NOT for: open play listing (seed session directly with visibility: 'open').
 */
export async function seedGameSessionWithAccess(userUid: string, opts: GameSessionOptions = {}): Promise<GameSessionSeed> {
  const visibility = opts.visibility ?? 'private';
  let groupId: string;
  let group: Record<string, unknown>;
  let groupShareCode: string;

  if (visibility === 'open') {
    groupId = uid('group');
    group = {};
    groupShareCode = '';
  } else {
    const groupSeed = await seedBuddyGroupWithMember(userUid, {
      name: opts.name,
      description: opts.description,
      defaultLocation: opts.defaultLocation,
      displayName: opts.displayName,
    });
    groupId = groupSeed.groupId;
    group = groupSeed.group;
    groupShareCode = groupSeed.shareCode;
  }

  const sessionId = uid('session');
  const session = makeGameSession({
    id: sessionId,
    groupId,
    title: opts.sessionTitle ?? 'Test Session',
    location: opts.sessionLocation ?? 'Test Courts',
    status: opts.status ?? 'proposed',
    visibility,
    spotsTotal: opts.spotsTotal ?? 8,
    rsvpStyle: opts.rsvpStyle ?? 'simple',
    createdBy: userUid,
    shareCode: shareCode(),
    ...opts.sessionOverrides,
  });
  await seedFirestoreDocAdmin(PATHS.gameSessions, sessionId, session);

  return { groupId, group, shareCode: groupShareCode, sessionId, session };
}

/**
 * Seeds a best-of-3 match where game 1 is complete, between-games state.
 */
export async function seedBetweenGamesMatch(
  userUid: string,
  opts: BetweenGamesOptions = {},
): Promise<BetweenGamesSeed> {
  const tournamentId = opts.tournamentId || uid('tournament');
  const sc = shareCode();
  const matchId = uid('match');
  const game1Score = opts.game1Score || [11, 7];

  const match = makePublicMatch(userUid, {
    id: matchId,
    team1Name: opts.team1Name || 'Team Alpha',
    team2Name: opts.team2Name || 'Team Beta',
    status: 'in-progress',
    config: {
      gameType: 'doubles',
      scoringMode: 'sideout',
      matchFormat: 'best-of-3',
      pointsToWin: 11,
    },
    games: [
      {
        gameNumber: 1,
        team1Score: game1Score[0],
        team2Score: game1Score[1],
        winningSide: game1Score[0] > game1Score[1] ? 1 : 2,
      },
    ],
    lastSnapshot: JSON.stringify({
      team1Score: 0,
      team2Score: 0,
      gameNumber: 2,
    }),
  });

  const projection = makeSpectatorProjection({
    publicTeam1Name: opts.team1Name || 'Team Alpha',
    publicTeam2Name: opts.team2Name || 'Team Beta',
    team1Score: 0,
    team2Score: 0,
    gameNumber: 2,
    team1Wins: game1Score[0] > game1Score[1] ? 1 : 0,
    team2Wins: game1Score[1] > game1Score[0] ? 1 : 0,
    status: 'in-progress',
    tournamentId,
    tournamentShareCode: sc,
  });

  await seedFirestoreDocAdmin(PATHS.matches, matchId, match);
  await seedFirestoreDocAdmin(
    PATHS.spectatorProjection(matchId),
    SPECTATOR_DOC_ID,
    projection,
  );

  return { matchId, tournamentId, shareCode: sc };
}

/**
 * Seeds a completed match with final score and projection.
 */
export async function seedCompletedMatch(
  userUid: string,
  opts: CompletedMatchOptions = {},
): Promise<CompletedMatchSeed> {
  const tournamentId = opts.tournamentId || uid('tournament');
  const sc = shareCode();
  const matchId = uid('match');
  const finalScore = opts.finalScore || [11, 5];

  const match = makePublicMatch(userUid, {
    id: matchId,
    team1Name: opts.team1Name || 'Team Alpha',
    team2Name: opts.team2Name || 'Team Beta',
    status: 'completed',
    team1Score: finalScore[0],
    team2Score: finalScore[1],
  });

  const projection = makeSpectatorProjection({
    publicTeam1Name: opts.team1Name || 'Team Alpha',
    publicTeam2Name: opts.team2Name || 'Team Beta',
    team1Score: finalScore[0],
    team2Score: finalScore[1],
    gameNumber: 1,
    status: 'completed',
    tournamentId,
    tournamentShareCode: sc,
  });

  await seedFirestoreDocAdmin(PATHS.matches, matchId, match);
  await seedFirestoreDocAdmin(
    PATHS.spectatorProjection(matchId),
    SPECTATOR_DOC_ID,
    projection,
  );

  return { matchId, tournamentId, shareCode: sc };
}

/**
 * Seeds a completed tournament with resolved bracket and winner.
 */
export async function seedCompletedTournament(
  userUid: string,
  opts: CompletedTournamentOptions = {},
): Promise<CompletedTournamentSeed> {
  const teamCount = opts.teamCount || 4;
  const tournament = makeTournament({
    organizerId: userUid,
    status: 'completed',
    format: 'single-elimination',
  });
  const sc = tournament.shareCode;

  await seedFirestoreDocAdmin(PATHS.tournaments, tournament.id, tournament);

  const teams: ReturnType<typeof makeTeam>[] = [];
  for (let i = 0; i < teamCount; i++) {
    const team = makeTeam({
      tournamentId: tournament.id,
      name: `Team ${String.fromCharCode(65 + i)}`,
      seed: i + 1,
    });
    teams.push(team);
    await seedFirestoreDocAdmin(PATHS.teams(tournament.id), team.id, team);
  }

  // Create bracket: semi-finals + final
  const semi1 = makeBracketSlot({
    tournamentId: tournament.id,
    round: 1,
    position: 1,
    team1Id: teams[0].id,
    team2Id: teams[1].id,
    winnerId: teams[0].id,
  });
  const semi2 = makeBracketSlot({
    tournamentId: tournament.id,
    round: 1,
    position: 2,
    team1Id: teams[2].id,
    team2Id: teams[3].id,
    winnerId: teams[2].id,
  });
  const final = makeBracketSlot({
    tournamentId: tournament.id,
    round: 2,
    position: 1,
    team1Id: teams[0].id,
    team2Id: teams[2].id,
    winnerId: teams[0].id,
  });

  semi1.nextSlotId = final.id;
  semi2.nextSlotId = final.id;

  await seedFirestoreDocAdmin(PATHS.bracket(tournament.id), semi1.id, semi1);
  await seedFirestoreDocAdmin(PATHS.bracket(tournament.id), semi2.id, semi2);
  await seedFirestoreDocAdmin(PATHS.bracket(tournament.id), final.id, final);

  return {
    tournamentId: tournament.id,
    tournament,
    teams,
    shareCode: sc,
    winnerId: teams[0].id,
  };
}

/**
 * Seeds a game session with multiple RSVPs in mixed states.
 */
export async function seedSessionWithRsvps(
  userUid: string,
  opts: SessionWithRsvpsOptions = {},
): Promise<SessionWithRsvpsSeed> {
  const rsvpCount = opts.rsvpCount || 4;
  const baseSeed = await seedGameSessionWithAccess(userUid, {
    sessionOverrides: {
      spotsTotal: rsvpCount + 2,
      spotsConfirmed: 0,
      ...opts.sessionOverrides,
    },
  });

  const statuses = ['in', 'in', 'out', 'maybe'];
  const rsvps: Array<{ userId: string; status: string }> = [];

  for (let i = 0; i < rsvpCount; i++) {
    const rsvpUserId = uid('rsvp-user');
    const status = statuses[i % statuses.length];
    const rsvp = makeRsvp({
      userId: rsvpUserId,
      displayName: `Player ${i + 1}`,
      status,
    });
    await seedFirestoreDocAdmin(
      PATHS.rsvps(baseSeed.sessionId),
      rsvpUserId,
      rsvp,
    );
    rsvps.push({ userId: rsvpUserId, status });
  }

  return { ...baseSeed, rsvps };
}

/**
 * Seeds a user profile with stats, match history, and achievements.
 */
export async function seedProfileWithHistory(
  userUid: string,
  opts: ProfileWithHistoryOptions = {},
): Promise<ProfileWithHistorySeed> {
  const matchCount = opts.matchCount || 5;
  const achievementCount = opts.achievementCount || 3;

  const profile = makeUserProfile({ email: `${userUid}@test.com` });
  const stats = makeStatsSummary({ totalMatches: matchCount, wins: matchCount - 1, losses: 1 });

  await seedFirestoreDocAdmin(PATHS.users, userUid, profile);
  await seedFirestoreDocAdmin(PATHS.stats(userUid), 'summary', stats);

  const matchRefs: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (let i = 0; i < matchCount; i++) {
    const ref = makeMatchRefSeed({
      ownerId: userUid,
      result: i === matchCount - 1 ? 'loss' : 'win',
      scores: i === matchCount - 1 ? '7-11' : '11-7',
      startedAt: Date.now() - (i + 1) * 86400000,
      completedAt: Date.now() - (i + 1) * 86400000 + 3600000,
    });
    await seedFirestoreDocAdmin(PATHS.matchRefs(userUid), ref.id, ref.data);
    matchRefs.push(ref);
  }

  const achievementTypes = [
    { achievementId: 'first-match', label: 'First Match', description: 'Played your first match', icon: 'trophy' },
    { achievementId: 'win-streak-3', label: 'On Fire', description: '3-game win streak', icon: 'flame' },
    { achievementId: 'tournament-winner', label: 'Champion', description: 'Won a tournament', icon: 'crown' },
  ];

  const achievements: ReturnType<typeof makeAchievement>[] = [];
  for (let i = 0; i < achievementCount; i++) {
    const ach = makeAchievement(achievementTypes[i % achievementTypes.length]);
    await seedFirestoreDocAdmin(PATHS.achievements(userUid), ach.achievementId, ach);
    achievements.push(ach);
  }

  return { profile, stats, matchRefs, achievements };
}

/**
 * Seeds a batch of notifications for a user.
 */
export async function seedNotifications(
  userUid: string,
  count: number = 3,
): Promise<ReturnType<typeof makeNotification>[]> {
  const types = [
    { type: 'tournament_update', title: 'Pool Play Started', body: 'Your tournament has begun.' },
    { type: 'buddy_invite', title: 'Group Invite', body: 'Alex invited you to Pickle Pals.' },
    { type: 'match_result', title: 'Match Result', body: 'You won 11-7!' },
    { type: 'achievement', title: 'Achievement Unlocked', body: 'You earned First Match!' },
  ];

  const notifications: ReturnType<typeof makeNotification>[] = [];
  for (let i = 0; i < count; i++) {
    const notif = makeNotification({
      ...types[i % types.length],
      read: i >= 2,
      createdAt: Date.now() - i * 3600000,
    });
    await seedFirestoreDocAdmin(PATHS.notifications(userUid), notif.id, notif);
    notifications.push(notif);
  }

  return notifications;
}
