import { doc, collection, setDoc, getDocs, deleteDoc, updateDoc, query, orderBy, increment } from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentTemplate } from '../../features/tournaments/engine/templateTypes';

/** Save (create or overwrite) a tournament template for a user. */
export async function saveTemplate(userId: string, template: TournamentTemplate): Promise<void> {
  const ref = doc(firestore, 'users', userId, 'templates', template.id);
  await setDoc(ref, template);
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
