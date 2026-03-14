import { createSignal, Show } from 'solid-js';
import { MAX_TEMPLATE_NAME_LENGTH } from '../engine/templateTypes';

const MAX_DESCRIPTION_LENGTH = 200;

interface SaveTemplateModalProps {
  onSave: (name: string, description: string) => void;
  onClose: () => void;
}

export default function SaveTemplateModal(props: SaveTemplateModalProps) {
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [error, setError] = createSignal('');

  const handleSave = () => {
    const trimmedName = name().trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    if (trimmedName.length > MAX_TEMPLATE_NAME_LENGTH) {
      setError(`Name must be ${MAX_TEMPLATE_NAME_LENGTH} characters or less`);
      return;
    }
    if (description().trim().length > MAX_DESCRIPTION_LENGTH) {
      setError(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`);
      return;
    }
    setError('');
    props.onSave(trimmedName, description().trim());
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 class="text-lg font-semibold mb-4">Save as Template</h2>

        <div class="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Template name"
              value={name()}
              onInput={(e) => setName(e.target.value)}
              class="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <textarea
              placeholder="Description (optional)"
              value={description()}
              onInput={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESCRIPTION_LENGTH}
              class="w-full border rounded px-3 py-2"
              rows={3}
            />
          </div>

          <Show when={error()}>
            <p class="text-red-600 text-sm">{error()}</p>
          </Show>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => props.onClose()}
              class="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
