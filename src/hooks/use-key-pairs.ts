import { useLocalStorageCollection } from './use-local-storage-collection';
import { KeyPair } from '../types/activationKey';

const STORAGE_KEY = 'keyPairs';

interface UseKeyPairsReturn {
  keyPairs: KeyPair[];
  isLoading: boolean;
  error: Error | null;
  addKeyPair: (pair: Omit<KeyPair, 'id' | 'createdAt'>) => KeyPair;
  updateKeyPair: (id: string, updates: Partial<Omit<KeyPair, 'id' | 'createdAt'>>) => void;
  deleteKeyPair: (id: string) => void;
  getKeyPairById: (id: string) => KeyPair | undefined;
}

export function useKeyPairs(): UseKeyPairsReturn {
  const { items, isLoading, error, add, update, remove, getById } = useLocalStorageCollection<KeyPair>({
    storageKey: STORAGE_KEY,
    entityName: 'key pairs',
  });

  return {
    keyPairs: items,
    isLoading,
    error,
    addKeyPair: add,
    updateKeyPair: update,
    deleteKeyPair: remove,
    getKeyPairById: getById,
  };
}
