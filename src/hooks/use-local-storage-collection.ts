import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Base interface for items stored in localStorage collections.
 * All items must have an id and createdAt timestamp.
 */
export interface StorableItem {
  id: string;
  createdAt: string;
}

export interface UseLocalStorageCollectionOptions<T extends StorableItem> {
  /** localStorage key for persistence */
  storageKey: string;
  /** Human-readable name for error messages (e.g., "templates", "key pairs") */
  entityName: string;
  /** Default items to initialize with if storage is empty */
  defaultItems?: T[];
}

export interface UseLocalStorageCollectionReturn<T extends StorableItem> {
  items: T[];
  isLoading: boolean;
  error: Error | null;
  add: (item: Omit<T, 'id' | 'createdAt'>) => T;
  update: (id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>) => void;
  remove: (id: string) => void;
  getById: (id: string) => T | undefined;
}

/**
 * Generic hook for managing a collection of items persisted to localStorage.
 * Provides CRUD operations with automatic persistence.
 *
 * @example
 * ```typescript
 * interface Template extends StorableItem {
 *   name: string;
 *   content: string;
 * }
 *
 * const { items, add, update, remove } = useLocalStorageCollection<Template>({
 *   storageKey: 'templates',
 *   entityName: 'templates',
 * });
 * ```
 */
export function useLocalStorageCollection<T extends StorableItem>(
  options: UseLocalStorageCollectionOptions<T>
): UseLocalStorageCollectionReturn<T> {
  const { storageKey, entityName, defaultItems = [] } = options;

  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Store defaultItems in a ref to avoid effect re-runs when caller doesn't memoize
  const defaultItemsRef = useRef(defaultItems);

  // Load from localStorage on mount only
  useEffect(() => {
    const defaults = defaultItemsRef.current;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
        } else if (defaults.length > 0) {
          setItems(defaults);
          localStorage.setItem(storageKey, JSON.stringify(defaults));
        }
      } else if (defaults.length > 0) {
        setItems(defaults);
        localStorage.setItem(storageKey, JSON.stringify(defaults));
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(`Failed to load ${entityName} from storage`));
      if (defaults.length > 0) {
        setItems(defaults);
      }
    } finally {
      setIsLoading(false);
    }
  }, [storageKey, entityName]);

  const persist = useCallback((newItems: T[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newItems));
    } catch (e) {
      setError(e instanceof Error ? e : new Error(`Failed to save ${entityName} to storage`));
    }
  }, [storageKey, entityName]);

  const add = useCallback((item: Omit<T, 'id' | 'createdAt'>): T => {
    const newItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    } as T;

    setItems(prev => {
      const updated = [...prev, newItem];
      persist(updated);
      return updated;
    });

    return newItem;
  }, [persist]);

  const update = useCallback((id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>) => {
    setItems(prev => {
      const updated = prev.map(item =>
        item.id === id ? { ...item, ...updates } : item
      );
      persist(updated);
      return updated;
    });
  }, [persist]);

  const remove = useCallback((id: string) => {
    setItems(prev => {
      const updated = prev.filter(item => item.id !== id);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const getById = useCallback((id: string): T | undefined => {
    return items.find(item => item.id === id);
  }, [items]);

  return {
    items,
    isLoading,
    error,
    add,
    update,
    remove,
    getById,
  };
}
