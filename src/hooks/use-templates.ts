import { useMemo } from 'react';
import { useLocalStorageCollection } from './use-local-storage-collection';

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
  // Memoize default templates to prevent useEffect re-runs
  const defaultTemplates = useMemo(() => DEFAULT_TEMPLATES, []);

  const { items, isLoading, error, add, update, remove, getById } = useLocalStorageCollection<AkTemplate>({
    storageKey: STORAGE_KEY,
    entityName: 'templates',
    defaultItems: defaultTemplates,
  });

  return {
    templates: items,
    isLoading,
    error,
    addTemplate: add,
    updateTemplate: update,
    deleteTemplate: remove,
    getTemplateById: getById,
  };
}
