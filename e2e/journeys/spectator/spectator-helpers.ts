import { FIRESTORE_EMULATOR, PROJECT_ID } from '../../helpers/emulator-config';

export function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') fields[key] = { stringValue: value };
    else if (typeof value === 'number') fields[key] = { integerValue: String(value) };
    else if (typeof value === 'boolean') fields[key] = { booleanValue: value };
    else if (value === null) fields[key] = { nullValue: null };
    else if (Array.isArray(value))
      fields[key] = {
        arrayValue: {
          values: value.map((v) => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { integerValue: String(v) };
            if (typeof v === 'boolean') return { booleanValue: v };
            if (v === null) return { nullValue: null };
            if (typeof v === 'object')
              return { mapValue: { fields: toFirestoreFields(v as Record<string, unknown>) } };
            return { stringValue: String(v) };
          }),
        },
      };
    else if (typeof value === 'object')
      fields[key] = {
        mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) },
      };
  }
  return fields;
}

export async function seedDoc(path: string, data: Record<string, unknown>) {
  const parts = path.split('/');
  const collectionPath = parts.slice(0, -1).join('/');
  const docId = parts[parts.length - 1];

  const resp = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?documentId=${docId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner',
      },
      body: JSON.stringify({ fields: toFirestoreFields(data) }),
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`seedDoc(${path}) failed ${resp.status}: ${text}`);
  }
}
