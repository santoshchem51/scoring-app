import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('firestore.rules — spectator projection field whitelist', () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf-8');

  it('contains hasOnly whitelist for spectator projection writes', () => {
    // The spectator projection rule should use hasOnly to restrict allowed fields
    expect(rules).toContain('hasOnly');
    // Check for the specific whitelist context within the public/{docId} match
    expect(rules).toMatch(/match\s+\/public\/\{docId\}/);
    expect(rules).toMatch(/request\.resource\.data\.keys\(\)\.hasOnly\(/);
  });

  it('whitelists the expected fields for spectator projection', () => {
    const expectedFields = [
      'publicTeam1Name',
      'publicTeam2Name',
      'team1Score',
      'team2Score',
      'gameNumber',
      'team1Wins',
      'team2Wins',
      'status',
      'tournamentId',
      'spectatorCount',
      'updatedAt',
      'visibility',
    ];
    for (const field of expectedFields) {
      expect(rules).toContain(`'${field}'`);
    }
  });

  it('does NOT allow tournamentShareCode in spectator projection whitelist', () => {
    // Extract the spectator projection section (between match /public/{docId} and its closing)
    const publicMatch = rules.match(
      /match\s+\/public\/\{docId\}[\s\S]*?allow create, update:[\s\S]*?hasOnly\(\[([^\]]+)\]/,
    );
    expect(publicMatch).not.toBeNull();
    const whitelistStr = publicMatch![1];
    expect(whitelistStr).not.toContain('tournamentShareCode');
  });
});
