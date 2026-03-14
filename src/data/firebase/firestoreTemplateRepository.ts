import { doc, collection, setDoc, getDocs, deleteDoc, updateDoc, query, orderBy, increment } from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentTemplate } from '../../features/tournaments/engine/templateTypes';
import type { TournamentFormat, TournamentConfig, TournamentAccessMode, TournamentRules } from '../types';

/** Input for creating a new template — repo generates id, timestamps, usageCount. */
export interface TemplateInput {
  name: string;
  description?: string;
  format: TournamentFormat;
  gameType: TournamentConfig['gameType'];
  config: TournamentConfig;
  teamFormation: string | null;
  maxPlayers: number | null;
  accessMode: TournamentAccessMode;
  rules: TournamentRules;
}

/** Save a new tournament template for a user. Generates id, timestamps, usageCount. */
export async function saveTemplate(userId: string, input: TemplateInput): Promise<string> {
  const colRef = collection(firestore, 'users', userId, 'templates');
  const docRef = doc(colRef);
  const now = Date.now();
  await setDoc(docRef, {
    id: docRef.id,
    ...input,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  });
  return docRef.id;
}

/** Get all templates for a user, sorted by updatedAt descending. */
export async function getTemplates(userId: string): Promise<TournamentTemplate[]> {
  const colRef = collection(firestore, 'users', userId, 'templates');
  const q = query(colRef, orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TournamentTemplate));
}

/** Delete a tournament template. */
export async function deleteTemplate(userId: string, templateId: string): Promise<void> {
  const ref = doc(firestore, 'users', userId, 'templates', templateId);
  await deleteDoc(ref);
}

/** Increment the usage count for a template. */
export async function incrementUsageCount(userId: string, templateId: string): Promise<void> {
  const ref = doc(firestore, 'users', userId, 'templates', templateId);
  await updateDoc(ref, { usageCount: increment(1) });
}
