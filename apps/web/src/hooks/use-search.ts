'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/api';

interface SearchResult {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string | null;
  isStarred: boolean;
  ocrText?: string | null;
  ocrSummary?: string | null;
  createdAt: string;
}

interface UseSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
}

export function useSearch(options: UseSearchOptions = {}) {
  const { debounceMs = 300, minQueryLength = 2 } = options;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const apiUrl = getApiUrl();

  const search = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < minQueryLength) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        const response = await fetch(
          `${apiUrl}/files/search?q=${encodeURIComponent(searchQuery)}&limit=10`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const data = await response.json();
          setResults(data.files || []);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [apiUrl, minQueryLength]
  );

  const handleQueryChange = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);

      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (newQuery.length < minQueryLength) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      // Debounce the search
      debounceRef.current = setTimeout(() => {
        search(newQuery);
      }, debounceMs);
    },
    [search, debounceMs, minQueryLength]
  );

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      // Build URL with folder and preview params
      const params = new URLSearchParams();
      if (result.folderId) {
        params.set('folder', result.folderId);
      }
      // Add preview param to open the file preview modal
      params.set('preview', result.id);

      const queryString = params.toString();
      router.push(`/dashboard${queryString ? `?${queryString}` : ''}`);

      setIsOpen(false);
      setQuery('');
      setResults([]);
    },
    [router]
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }, []);

  return {
    query,
    results,
    isSearching,
    isOpen,
    setIsOpen,
    handleQueryChange,
    handleResultClick,
    clearSearch,
  };
}
