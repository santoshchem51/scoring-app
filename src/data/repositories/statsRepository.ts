import { db } from '../db';
import type { Match } from '../types';

export interface PlayerStats {
  playerId: string;
  playerName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: { type: 'W' | 'L'; count: number };
  bestWinStreak: number;
}

export interface HeadToHeadRecord {
  player1Id: string;
  player2Id: string;
  player1Wins: number;
  player2Wins: number;
  matches: Match[];
}

export const statsRepository = {
  async getPlayerStats(playerId: string): Promise<PlayerStats | null> {
    const player = await db.players.get(playerId);
    if (!player) return null;

    const t1Matches = await db.matches
      .where('team1PlayerIds').equals(playerId)
      .and((m) => m.status === 'completed')
      .toArray();
    const t2Matches = await db.matches
      .where('team2PlayerIds').equals(playerId)
      .and((m) => m.status === 'completed')
      .toArray();

    const allMatches = [...t1Matches, ...t2Matches].sort((a, b) => a.startedAt - b.startedAt);
    const matchesPlayed = allMatches.length;

    if (matchesPlayed === 0) {
      return {
        playerId, playerName: player.name,
        matchesPlayed: 0, wins: 0, losses: 0, winRate: 0,
        currentStreak: { type: 'W', count: 0 }, bestWinStreak: 0,
      };
    }

    let wins = 0;
    let currentStreak = { type: 'W' as 'W' | 'L', count: 0 };
    let bestWinStreak = 0;
    let tempWinStreak = 0;

    for (const match of allMatches) {
      const isTeam1 = match.team1PlayerIds.includes(playerId);
      const won = (isTeam1 && match.winningSide === 1) || (!isTeam1 && match.winningSide === 2);

      if (won) {
        wins++;
        tempWinStreak++;
        bestWinStreak = Math.max(bestWinStreak, tempWinStreak);
        if (currentStreak.type === 'W') {
          currentStreak.count++;
        } else {
          currentStreak = { type: 'W', count: 1 };
        }
      } else {
        tempWinStreak = 0;
        if (currentStreak.type === 'L') {
          currentStreak.count++;
        } else {
          currentStreak = { type: 'L', count: 1 };
        }
      }
    }

    return {
      playerId,
      playerName: player.name,
      matchesPlayed,
      wins,
      losses: matchesPlayed - wins,
      winRate: Math.round((wins / matchesPlayed) * 100),
      currentStreak,
      bestWinStreak,
    };
  },

  async getHeadToHead(player1Id: string, player2Id: string): Promise<HeadToHeadRecord> {
    const allMatches = await db.matches
      .where('status').equals('completed')
      .toArray();

    const h2hMatches = allMatches.filter((m) => {
      const hasP1 = m.team1PlayerIds.includes(player1Id) || m.team2PlayerIds.includes(player1Id);
      const hasP2 = m.team1PlayerIds.includes(player2Id) || m.team2PlayerIds.includes(player2Id);
      const p1Team1 = m.team1PlayerIds.includes(player1Id);
      const p2Team1 = m.team1PlayerIds.includes(player2Id);
      return hasP1 && hasP2 && p1Team1 !== p2Team1;
    });

    let player1Wins = 0;
    let player2Wins = 0;

    for (const m of h2hMatches) {
      const p1IsTeam1 = m.team1PlayerIds.includes(player1Id);
      if ((p1IsTeam1 && m.winningSide === 1) || (!p1IsTeam1 && m.winningSide === 2)) {
        player1Wins++;
      } else {
        player2Wins++;
      }
    }

    return { player1Id, player2Id, player1Wins, player2Wins, matches: h2hMatches };
  },
};
