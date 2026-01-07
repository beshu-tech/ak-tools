import { useState, useEffect, useCallback } from 'react';
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
  const [keyPairs, setKeyPairs] = useState<KeyPair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setKeyPairs(parsed);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load key pairs from storage'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Persist to localStorage whenever keyPairs changes (after initial load)
  const persistKeyPairs = useCallback((pairs: KeyPair[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs));
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to save key pairs to storage'));
    }
  }, []);

  const addKeyPair = useCallback((pair: Omit<KeyPair, 'id' | 'createdAt'>): KeyPair => {
    const newPair: KeyPair = {
      ...pair,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    setKeyPairs(prev => {
      const updated = [...prev, newPair];
      persistKeyPairs(updated);
      return updated;
    });

    return newPair;
  }, [persistKeyPairs]);

  const updateKeyPair = useCallback((id: string, updates: Partial<Omit<KeyPair, 'id' | 'createdAt'>>) => {
    setKeyPairs(prev => {
      const updated = prev.map(pair =>
        pair.id === id ? { ...pair, ...updates } : pair
      );
      persistKeyPairs(updated);
      return updated;
    });
  }, [persistKeyPairs]);

  const deleteKeyPair = useCallback((id: string) => {
    setKeyPairs(prev => {
      const updated = prev.filter(pair => pair.id !== id);
      persistKeyPairs(updated);
      return updated;
    });
  }, [persistKeyPairs]);

  const getKeyPairById = useCallback((id: string): KeyPair | undefined => {
    return keyPairs.find(pair => pair.id === id);
  }, [keyPairs]);

  return {
    keyPairs,
    isLoading,
    error,
    addKeyPair,
    updateKeyPair,
    deleteKeyPair,
    getKeyPairById,
  };
}
