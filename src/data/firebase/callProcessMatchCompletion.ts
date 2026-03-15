import { httpsCallable } from 'firebase/functions';
import { functions } from './config';

const processMatchCallable = httpsCallable(functions, 'processMatchCompletion');

export async function callProcessMatchCompletion(matchId: string): Promise<{ status: string }> {
  const result = await processMatchCallable({ matchId });
  return result.data as { status: string };
}
