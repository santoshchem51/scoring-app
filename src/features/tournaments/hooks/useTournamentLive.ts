import { createSignal, createEffect, onCleanup } from 'solid-js';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import { db } from '../../../data/db';
import type {
  Tournament,
  TournamentTeam,
  TournamentPool,
  BracketSlot,
  TournamentRegistration,
} from '../../../data/types';

const ACTIVE_STATUSES = new Set(['registration', 'pool-play', 'bracket', 'paused']);

export interface TournamentLiveData {
  tournament: () => Tournament | undefined;
  teams: () => TournamentTeam[];
  pools: () => TournamentPool[];
  bracket: () => BracketSlot[];
  registrations: () => TournamentRegistration[];
  loading: () => boolean;
  error: () => string;
}

export function useTournamentLive(
  tournamentId: () => string | undefined,
  options?: { skipRegistrations?: boolean },
): TournamentLiveData {
  const [tournament, setTournament] = createSignal<Tournament | undefined>(undefined);
  const [teams, setTeams] = createSignal<TournamentTeam[]>([]);
  const [pools, setPools] = createSignal<TournamentPool[]>([]);
  const [bracket, setBracket] = createSignal<BracketSlot[]>([]);
  const [registrations, setRegistrations] = createSignal<TournamentRegistration[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');

  let unsubscribers: (() => void)[] = [];

  const cleanup = () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
    unsubscribers = [];
  };

  const subscribe = async (id: string) => {
    cleanup();
    setLoading(true);
    setError('');

    // Hydrate from Dexie cache immediately (stale-while-revalidate)
    try {
      const [cachedT, cachedTeamRows, cachedPoolRows, cachedBracketRows, cachedRegRows] =
        await Promise.all([
          db.cachedTournaments.get(id),
          db.cachedTeams.where('tournamentId').equals(id).toArray(),
          db.cachedPools.where('tournamentId').equals(id).toArray(),
          db.cachedBrackets.where('tournamentId').equals(id).toArray(),
          db.cachedRegistrations.where('tournamentId').equals(id).toArray(),
        ]);

      if (cachedT) {
        setTournament(cachedT);
        setLoading(false); // Cache hit — show UI immediately
      }
      if (cachedTeamRows.length) setTeams(cachedTeamRows);
      if (cachedPoolRows.length) setPools(cachedPoolRows);
      if (cachedBracketRows.length) setBracket(cachedBracketRows);
      if (cachedRegRows.length) setRegistrations(cachedRegRows);
    } catch {
      // Cache read failed — continue to network
    }

    // Listen to tournament doc
    const tournamentRef = doc(firestore, 'tournaments', id);
    unsubscribers.push(
      onSnapshot(
        tournamentRef,
        (snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() } as Tournament;
            setTournament(data);
            // Write-through to Dexie (only active statuses)
            if (ACTIVE_STATUSES.has(data.status)) {
              db.cachedTournaments.put({ ...data, cachedAt: Date.now() }).catch(() => {});
            } else {
              // Completed/cancelled — clean up cache
              db.transaction('rw',
                db.cachedTournaments, db.cachedTeams, db.cachedPools,
                db.cachedBrackets, db.cachedRegistrations,
                async () => {
                  await Promise.all([
                    db.cachedTournaments.delete(id),
                    db.cachedTeams.where('tournamentId').equals(id).delete(),
                    db.cachedPools.where('tournamentId').equals(id).delete(),
                    db.cachedBrackets.where('tournamentId').equals(id).delete(),
                    db.cachedRegistrations.where('tournamentId').equals(id).delete(),
                  ]);
                },
              ).catch(() => {});
            }
          } else {
            setTournament(undefined);
          }
          setLoading(false);
        },
        (err) => {
          console.error('Tournament listener error:', err);
          setError(err.message);
          setLoading(false);
        },
      ),
    );

    // Listen to teams sub-collection
    const teamsRef = collection(firestore, 'tournaments', id, 'teams');
    unsubscribers.push(
      onSnapshot(
        teamsRef,
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentTeam);
          setTeams(data);
          db.cachedTeams.bulkPut(data.map(t => ({ ...t, tournamentId: id, cachedAt: Date.now() }))).catch(() => {});
        },
        (err) => console.error('Teams listener error:', err),
      ),
    );

    // Listen to pools sub-collection
    const poolsRef = collection(firestore, 'tournaments', id, 'pools');
    unsubscribers.push(
      onSnapshot(
        poolsRef,
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentPool);
          setPools(data);
          db.cachedPools.bulkPut(data.map(p => ({ ...p, tournamentId: id, cachedAt: Date.now() }))).catch(() => {});
        },
        (err) => console.error('Pools listener error:', err),
      ),
    );

    // Listen to bracket sub-collection
    const bracketRef = collection(firestore, 'tournaments', id, 'bracket');
    unsubscribers.push(
      onSnapshot(
        bracketRef,
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BracketSlot);
          setBracket(data);
          db.cachedBrackets.bulkPut(data.map(b => ({ ...b, tournamentId: id, cachedAt: Date.now() }))).catch(() => {});
        },
        (err) => console.error('Bracket listener error:', err),
      ),
    );

    // Listen to registrations sub-collection
    if (!options?.skipRegistrations) {
      const regsRef = collection(firestore, 'tournaments', id, 'registrations');
      unsubscribers.push(
        onSnapshot(
          regsRef,
          (snap) => {
            const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentRegistration);
            setRegistrations(data);
            db.cachedRegistrations.bulkPut(data.map(r => ({ ...r, tournamentId: id, cachedAt: Date.now() }))).catch(() => {});
          },
          (err) => console.error('Registrations listener error:', err),
        ),
      );
    }
  };

  createEffect(() => {
    const id = tournamentId();
    if (id) {
      subscribe(id);
    } else {
      cleanup();
      setTournament(undefined);
      setTeams([]);
      setPools([]);
      setBracket([]);
      setRegistrations([]);
      setLoading(false);
    }
  });

  onCleanup(cleanup);

  return {
    tournament,
    teams,
    pools,
    bracket,
    registrations,
    loading,
    error,
  };
}
