import { createSignal, createEffect, onCleanup } from 'solid-js';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type {
  Tournament,
  TournamentTeam,
  TournamentPool,
  BracketSlot,
  TournamentRegistration,
} from '../../../data/types';

export interface TournamentLiveData {
  tournament: () => Tournament | undefined;
  teams: () => TournamentTeam[];
  pools: () => TournamentPool[];
  bracket: () => BracketSlot[];
  registrations: () => TournamentRegistration[];
  loading: () => boolean;
  error: () => string;
}

export function useTournamentLive(tournamentId: () => string | undefined): TournamentLiveData {
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

  const subscribe = (id: string) => {
    cleanup();
    setLoading(true);
    setError('');

    // Listen to tournament doc
    const tournamentRef = doc(firestore, 'tournaments', id);
    unsubscribers.push(
      onSnapshot(
        tournamentRef,
        (snap) => {
          if (snap.exists()) {
            setTournament({ id: snap.id, ...snap.data() } as Tournament);
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
          setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentTeam));
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
          setPools(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentPool));
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
          setBracket(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BracketSlot));
        },
        (err) => console.error('Bracket listener error:', err),
      ),
    );

    // Listen to registrations sub-collection
    const regsRef = collection(firestore, 'tournaments', id, 'registrations');
    unsubscribers.push(
      onSnapshot(
        regsRef,
        (snap) => {
          setRegistrations(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentRegistration));
        },
        (err) => console.error('Registrations listener error:', err),
      ),
    );
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
