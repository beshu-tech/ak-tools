import { useState, useEffect, useCallback } from 'react';

export interface AkTemplate {
  id: string;
  name: string;
  description?: string;
  activationKey: string;
  createdAt: string;
}

/** @deprecated Use AkTemplate instead */
export type JwtTemplate = AkTemplate;

const STORAGE_KEY = 'akTemplates';

// Default example template
const DEFAULT_TEMPLATES: AkTemplate[] = [
  {
    id: 'default-anaphora-free',
    name: 'Anaphora Free Edition',
    description: 'Example activation key for Anaphora Free edition',
    activationKey: 'eyJhbGciOiJFUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjg4MDYxMjEyODAwLCJpc3MiOiJodHRwczovL2FwaS5iZXNodS50ZWNoIiwiaWF0IjoxNjYxMzU2MTAxLCJqdGkiOiJhbmFwaG9yYV9saWNfMjViMmFhYTgtMTQwMS00YjhmLThkMGYtNmMzMTdmOWJhNjcwIiwiYXVkIjoiQW5hcGhvcmEiLCJzdWIiOiIxMTExMTExMS0xMTExLTExMTEtMTExMS0xMTExMTExMSIsImxpY2Vuc29yIjp7Im5hbWUiOiJBbmFwaG9yYSIsImNvbnRhY3QiOlsic3VwcG9ydEByZWFkb25seXJlc3QuY29tIiwiZmluYW5jZUByZWFkb25seXJlc3QuY29tIl0sImlzc3VlciI6InN1cHBvcnRAcmVhZG9ubHlyZXN0LmNvbSJ9LCJsaWNlbnNlZSI6eyJuYW1lIjoiQW5vbnltb3VzIEZyZWUgVXNlciIsImJ1eWluZ19mb3IiOm51bGwsImJpbGxpbmdfZW1haWwiOiJ1bmtub3duQGFuYXBob3JhLmNvbSIsImFsdF9lbWFpbHMiOltdLCJhZGRyZXNzIjpbIlVua25vd24iXX0sImxpY2Vuc2UiOnsiY2x1c3Rlcl91dWlkIjoiKiIsImVkaXRpb24iOiJmcmVlIiwiZWRpdGlvbl9uYW1lIjoiRnJlZSIsImlzVHJpYWwiOmZhbHNlfX0.ATAB81zkWRxTdpSD_23tcFxba81OCrjdtcGlx_yXwa2VSvJAx7rWQYO2VM2N8zeknA01SzYpPP2o_FXzP3TCEo4iABRof2G1u0iD1AFf5Y0m_TYPs89acR5Fztb46wSBwsj4L1ONal0y8xHYfJC54SKwdXJV4XTJwIP2tBVcTl9QNAfn',
    createdAt: new Date().toISOString(),
  },
];

interface UseTemplatesReturn {
  templates: AkTemplate[];
  isLoading: boolean;
  error: Error | null;
  addTemplate: (template: Omit<AkTemplate, 'id' | 'createdAt'>) => AkTemplate;
  updateTemplate: (id: string, updates: Partial<Omit<AkTemplate, 'id' | 'createdAt'>>) => void;
  deleteTemplate: (id: string) => void;
  getTemplateById: (id: string) => AkTemplate | undefined;
}

export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<AkTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTemplates(parsed);
        } else {
          // Initialize with default templates if empty
          setTemplates(DEFAULT_TEMPLATES);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
        }
      } else {
        // Initialize with default templates
        setTemplates(DEFAULT_TEMPLATES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load templates from storage'));
      setTemplates(DEFAULT_TEMPLATES);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persistTemplates = useCallback((newTemplates: AkTemplate[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTemplates));
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to save templates to storage'));
    }
  }, []);

  const addTemplate = useCallback((template: Omit<AkTemplate, 'id' | 'createdAt'>): AkTemplate => {
    const newTemplate: AkTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    setTemplates(prev => {
      const updated = [...prev, newTemplate];
      persistTemplates(updated);
      return updated;
    });

    return newTemplate;
  }, [persistTemplates]);

  const updateTemplate = useCallback((id: string, updates: Partial<Omit<AkTemplate, 'id' | 'createdAt'>>) => {
    setTemplates(prev => {
      const updated = prev.map(template =>
        template.id === id ? { ...template, ...updates } : template
      );
      persistTemplates(updated);
      return updated;
    });
  }, [persistTemplates]);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => {
      const updated = prev.filter(template => template.id !== id);
      persistTemplates(updated);
      return updated;
    });
  }, [persistTemplates]);

  const getTemplateById = useCallback((id: string): AkTemplate | undefined => {
    return templates.find(template => template.id === id);
  }, [templates]);

  return {
    templates,
    isLoading,
    error,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateById,
  };
}
