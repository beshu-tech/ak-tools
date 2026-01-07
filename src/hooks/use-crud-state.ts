import { useState, useCallback, Dispatch, SetStateAction } from 'react';

/**
 * State and handlers for CRUD form operations.
 * Manages the pattern of adding new items and editing existing items
 * that's common across list-based UI components.
 */
export interface UseCrudStateReturn<T extends { id: string }, TNew = Omit<T, 'id' | 'createdAt'>> {
  // Adding new item state
  isAddingNew: boolean;
  newItem: TNew;
  setNewItem: Dispatch<SetStateAction<TNew>>;
  startAdding: () => void;
  cancelAdding: () => void;
  resetNew: () => void;

  // Editing existing item state
  editingId: string | null;
  editingItem: T | null;
  setEditingItem: Dispatch<SetStateAction<T | null>>;
  startEditing: (item: T) => void;
  cancelEditing: () => void;

  // Toggle edit (starts if not editing, cancels if editing same item)
  toggleEdit: (item: T) => void;
}

export interface UseCrudStateOptions<TNew> {
  /** Initial/empty state for new items */
  emptyItem: TNew;
}

/**
 * Hook for managing CRUD form state patterns.
 *
 * @example
 * ```typescript
 * const {
 *   isAddingNew,
 *   newItem,
 *   setNewItem,
 *   startAdding,
 *   cancelAdding,
 *   editingId,
 *   editingItem,
 *   toggleEdit,
 * } = useCrudState<Template>({
 *   emptyItem: { name: '', description: '', content: '' },
 * });
 * ```
 */
export function useCrudState<T extends { id: string }, TNew = Omit<T, 'id' | 'createdAt'>>(
  options: UseCrudStateOptions<TNew>
): UseCrudStateReturn<T, TNew> {
  const { emptyItem } = options;

  // Adding new item state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<TNew>(emptyItem);

  // Editing existing item state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<T | null>(null);

  const startAdding = useCallback(() => {
    setIsAddingNew(true);
    // Cancel any ongoing edit
    setEditingId(null);
    setEditingItem(null);
  }, []);

  const cancelAdding = useCallback(() => {
    setIsAddingNew(false);
    setNewItem(emptyItem);
  }, [emptyItem]);

  const resetNew = useCallback(() => {
    setNewItem(emptyItem);
    setIsAddingNew(false);
  }, [emptyItem]);

  const startEditing = useCallback((item: T) => {
    setEditingId(item.id);
    setEditingItem(item);
    // Cancel any ongoing add
    setIsAddingNew(false);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditingItem(null);
  }, []);

  const toggleEdit = useCallback((item: T) => {
    if (editingId === item.id) {
      setEditingId(null);
      setEditingItem(null);
    } else {
      setEditingId(item.id);
      setEditingItem(item);
    }
  }, [editingId]);

  return {
    isAddingNew,
    newItem,
    setNewItem,
    startAdding,
    cancelAdding,
    resetNew,
    editingId,
    editingItem,
    setEditingItem,
    startEditing,
    cancelEditing,
    toggleEdit,
  };
}
