import { firestore } from './config';
import { doc, deleteDoc, collection, getDocs, query, where, writeBatch, limit } from 'firebase/firestore';

const BATCH_LIMIT = 450; // Stay under Firestore's 500-op batch limit

async function deleteSubcollectionPaginated(parentPath: string, subcollectionName: string): Promise<void> {
  const colRef = collection(firestore, parentPath, subcollectionName);
  let hasMore = true;

  while (hasMore) {
    const snap = await getDocs(query(colRef, limit(BATCH_LIMIT)));
    if (snap.empty) break;

    const batch = writeBatch(firestore);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    hasMore = snap.docs.length === BATCH_LIMIT;
  }
}

async function deleteQueryResultsPaginated(
  collectionName: string,
  field: string,
  uid: string,
  subcollections: string[] = [],
): Promise<void> {
  let hasMore = true;

  while (hasMore) {
    const q = query(
      collection(firestore, collectionName),
      where(field, '==', uid),
      limit(BATCH_LIMIT)
    );
    const snap = await getDocs(q);
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      for (const sub of subcollections) {
        await deleteSubcollectionPaginated(`${collectionName}/${docSnap.id}`, sub).catch(() => {});
      }
      await deleteDoc(docSnap.ref).catch(() => {});
    }

    hasMore = snap.docs.length === BATCH_LIMIT;
  }
}

export async function deleteAllUserData(uid: string): Promise<void> {
  // 1. Delete user subcollections (paginated)
  const userSubcollections = [
    'notifications', 'buddyNotifications', 'achievements',
    'matchRefs', 'templates',
  ];
  await Promise.allSettled(
    userSubcollections.map(sub => deleteSubcollectionPaginated(`users/${uid}`, sub))
  );

  // 2. Delete known user subdocs
  await Promise.allSettled([
    deleteDoc(doc(firestore, 'users', uid, 'public', 'tier')),
    deleteDoc(doc(firestore, 'users', uid, 'stats', 'summary')),
  ]);

  // 3. Delete user-owned matches (field: ownerId) + subcollections
  await deleteQueryResultsPaginated('matches', 'ownerId', uid, ['scoreEvents']);
  // Also clean up spectator projection subdocs for owned matches
  // (handled inline since 'public/spectator' is a fixed doc, not a subcollection)

  // 4. Delete buddy groups created by user + members
  await deleteQueryResultsPaginated('buddyGroups', 'createdBy', uid, ['members']);

  // 5. Delete game sessions created by user + rsvps
  await deleteQueryResultsPaginated('gameSessions', 'createdBy', uid, ['rsvps']);

  // 6. Delete top-level user docs
  await Promise.allSettled([
    deleteDoc(doc(firestore, 'users', uid)),
    deleteDoc(doc(firestore, 'leaderboard', uid)),
  ]);
}
