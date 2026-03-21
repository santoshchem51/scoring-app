import { firestore } from './config';
import { doc, deleteDoc, collection, getDocs, query, where, writeBatch, limit } from 'firebase/firestore';

async function deleteSubcollection(parentPath: string, subcollectionName: string): Promise<void> {
  const colRef = collection(firestore, parentPath, subcollectionName);
  const snap = await getDocs(colRef);
  if (snap.empty) return;

  const batch = writeBatch(firestore);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

export async function deleteAllUserData(uid: string): Promise<void> {
  // 1. Delete user subcollections
  const userSubcollections = [
    'notifications', 'buddyNotifications', 'achievements',
    'matchRefs', 'templates',
  ];
  await Promise.allSettled(
    userSubcollections.map(sub => deleteSubcollection(`users/${uid}`, sub))
  );

  // 2. Delete known user subdocs
  await Promise.allSettled([
    deleteDoc(doc(firestore, 'users', uid, 'public', 'tier')),
    deleteDoc(doc(firestore, 'users', uid, 'stats', 'summary')),
  ]);

  // 3. Delete user-owned matches and their subcollections
  const matchQuery = query(
    collection(firestore, 'matches'),
    where('ownerUid', '==', uid),
    limit(500)
  );
  const matchSnap = await getDocs(matchQuery);
  for (const matchDoc of matchSnap.docs) {
    await deleteSubcollection(`matches/${matchDoc.id}`, 'scoreEvents').catch(() => {});
    await deleteDoc(doc(firestore, 'matches', matchDoc.id, 'public', 'spectator')).catch(() => {});
    await deleteDoc(matchDoc.ref).catch(() => {});
  }

  // 4. Delete buddy groups created by user
  const groupQuery = query(
    collection(firestore, 'buddyGroups'),
    where('createdBy', '==', uid),
    limit(100)
  );
  const groupSnap = await getDocs(groupQuery);
  for (const groupDoc of groupSnap.docs) {
    await deleteSubcollection(`buddyGroups/${groupDoc.id}`, 'members').catch(() => {});
    await deleteDoc(groupDoc.ref).catch(() => {});
  }

  // 5. Delete game sessions created by user
  const sessionQuery = query(
    collection(firestore, 'gameSessions'),
    where('createdBy', '==', uid),
    limit(100)
  );
  const sessionSnap = await getDocs(sessionQuery);
  for (const sessionDoc of sessionSnap.docs) {
    await deleteSubcollection(`gameSessions/${sessionDoc.id}`, 'rsvps').catch(() => {});
    await deleteDoc(sessionDoc.ref).catch(() => {});
  }

  // 6. Delete top-level user docs
  await Promise.allSettled([
    deleteDoc(doc(firestore, 'users', uid)),
    deleteDoc(doc(firestore, 'leaderboard', uid)),
  ]);
}
