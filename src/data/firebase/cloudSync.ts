import { auth } from './config';
import { firestoreMatchRepository } from './firestoreMatchRepository';
import { firestoreScoreEventRepository } from './firestoreScoreEventRepository';
import { firestoreTournamentRepository } from './firestoreTournamentRepository';
import { firestoreUserRepository } from './firestoreUserRepository';
import { firestorePlayerStatsRepository } from './firestorePlayerStatsRepository';
import { matchRepository } from '../repositories/matchRepository';
import type { Match, ScoreEvent, Tournament } from '../types';

export const cloudSync = {
  /**
   * Save a match to Firestore if user is signed in.
   * Fire-and-forget — failures are logged, never block the UI.
   */
  syncMatchToCloud(match: Match): void {
    const user = auth.currentUser;
    if (!user) return;
    firestoreMatchRepository.save(match, user.uid).catch((err) => {
      console.warn('Cloud sync failed for match:', match.id, err);
    });
  },

  /**
   * Save a score event to Firestore if user is signed in.
   * Fire-and-forget.
   */
  syncScoreEventToCloud(event: ScoreEvent): void {
    const user = auth.currentUser;
    if (!user) return;
    firestoreScoreEventRepository.save(event, user.uid).catch((err) => {
      console.warn('Cloud sync failed for score event:', event.id, err);
    });
  },

  /**
   * Pull all cloud matches into local Dexie.
   * Called on sign-in to hydrate local DB with cloud data.
   */
  async pullCloudMatchesToLocal(): Promise<number> {
    const user = auth.currentUser;
    if (!user) return 0;

    try {
      const cloudMatches = await firestoreMatchRepository.getByOwner(user.uid);
      let synced = 0;
      for (const cloudMatch of cloudMatches) {
        const localMatch: Match = {
          id: cloudMatch.id,
          config: cloudMatch.config,
          team1PlayerIds: cloudMatch.team1PlayerIds,
          team2PlayerIds: cloudMatch.team2PlayerIds,
          team1Name: cloudMatch.team1Name,
          team2Name: cloudMatch.team2Name,
          team1Color: cloudMatch.team1Color,
          team2Color: cloudMatch.team2Color,
          games: cloudMatch.games,
          winningSide: cloudMatch.winningSide,
          status: cloudMatch.status,
          startedAt: cloudMatch.startedAt,
          completedAt: cloudMatch.completedAt,
          lastSnapshot: cloudMatch.lastSnapshot,
          tournamentId: cloudMatch.tournamentId,
          tournamentTeam1Id: cloudMatch.tournamentTeam1Id,
          tournamentTeam2Id: cloudMatch.tournamentTeam2Id,
          poolId: cloudMatch.poolId,
          bracketSlotId: cloudMatch.bracketSlotId,
          court: cloudMatch.court,
        };
        await matchRepository.save(localMatch);
        synced++;
      }
      return synced;
    } catch (err) {
      console.warn('Failed to pull cloud matches:', err);
      return 0;
    }
  },

  /**
   * Save user profile to Firestore on sign-in.
   */
  async syncUserProfile(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await firestoreUserRepository.saveProfile(user);
    } catch (err) {
      console.warn('Failed to sync user profile:', err);
    }
  },

  /**
   * Push all local matches to cloud.
   * Called on first sign-in to backup existing local matches.
   */
  async pushLocalMatchesToCloud(): Promise<number> {
    const user = auth.currentUser;
    if (!user) return 0;

    try {
      const localMatches = await matchRepository.getAll();
      let pushed = 0;
      for (const match of localMatches) {
        await firestoreMatchRepository.save(match, user.uid);
        pushed++;
      }
      return pushed;
    } catch (err) {
      console.warn('Failed to push local matches:', err);
      return 0;
    }
  },

  /**
   * Save a tournament to Firestore. Fire-and-forget.
   */
  syncTournamentToCloud(tournament: Tournament): void {
    const user = auth.currentUser;
    if (!user) return;
    firestoreTournamentRepository.save(tournament).catch((err) => {
      console.warn('Cloud sync failed for tournament:', tournament.id, err);
    });
  },

  /**
   * Pull organizer's tournaments from Firestore.
   */
  async pullTournamentsFromCloud(): Promise<Tournament[]> {
    const user = auth.currentUser;
    if (!user) return [];
    try {
      return await firestoreTournamentRepository.getByOrganizer(user.uid);
    } catch (err) {
      console.warn('Failed to pull tournaments:', err);
      return [];
    }
  },

  /**
   * Fire-and-forget: update match refs and stats for all signed-in participants.
   */
  syncPlayerStatsAfterMatch(match: Match): void {
    const user = auth.currentUser;
    if (!user) return;
    firestorePlayerStatsRepository
      .processMatchCompletion(match, user.uid)
      .catch((err) => {
        console.warn('Stats sync failed:', match.id, err);
      });
  },
};
