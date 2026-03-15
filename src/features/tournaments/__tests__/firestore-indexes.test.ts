import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('firestore.indexes.json', () => {
  const indexes = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../firestore.indexes.json'), 'utf-8'),
  );

  it('has composite index for (tournamentId, status) on matches', () => {
    const found = indexes.indexes.some((idx: any) =>
      idx.collectionGroup === 'matches' &&
      idx.fields.some((f: any) => f.fieldPath === 'tournamentId') &&
      idx.fields.some((f: any) => f.fieldPath === 'status'),
    );
    expect(found).toBe(true);
  });
});
