import { seedFirestoreDocAdmin } from '../../helpers/emulator-auth';

export async function seedDoc(path: string, data: Record<string, unknown>) {
  const parts = path.split('/');
  const docId = parts[parts.length - 1];
  const collectionPath = parts.slice(0, -1).join('/');
  await seedFirestoreDocAdmin(collectionPath, docId, data);
}
