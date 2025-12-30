'use client';

import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSearch } from '@/hooks/use-search';

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onMenuClick: () => void;
  onSignOut: () => void;
}

export function Header({ user, onMenuClick, onSignOut }: HeaderProps) {
  const {
    query,
    results,
    isSearching,
    isOpen,
    setIsOpen,
    handleQueryChange,
    handleResultClick,
    clearSearch,
  } = useSearch();

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Cmd/Ctrl + K to focus search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      // Escape to close and clear
      if (event.key === 'Escape' && isOpen) {
        clearSearch();
        inputRef.current?.blur();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, clearSearch, setIsOpen]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return (
        <svg className="w-5 h-5 text-(--primary)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (mimeType === 'application/pdf') {
      return (
        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-(--muted-foreground)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const SearchResults = () => {
    if (!isOpen || query.length < 2) return null;

    return (
      <div className="absolute top-full left-0 right-0 mt-2 bg-(--card) border border-(--border) rounded-lg shadow-xl max-h-80 overflow-auto z-50">
        {isSearching ? (
          <div className="p-4 flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-(--primary) border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-(--muted-foreground)">Searching...</span>
          </div>
        ) : results.length > 0 ? (
          <div className="py-2">
            <div className="px-3 py-1.5 text-xs font-medium text-(--muted-foreground) uppercase tracking-wide">
              Files ({results.length})
            </div>
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => handleResultClick(result)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-(--muted) transition-colors text-left"
              >
                {getFileIcon(result.mimeType)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-(--foreground) truncate">
                    {result.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-(--muted-foreground)">
                    <span>{formatFileSize(result.sizeBytes)}</span>
                    {(result.ocrText || result.ocrSummary) && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-(--primary)">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          AI content
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {result.isStarred && (
                  <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-(--muted-foreground)">
            No files found for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-(--card) border-b border-(--border) flex items-center justify-between px-4 lg:px-6 shadow-sm">
      {/* Left side - Mobile menu button + Search */}
      <div className="flex items-center gap-4 flex-1">
        {/* Mobile menu button with animation */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden -ml-2 btn-press"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>

        {/* Search bar with enhanced styling and results dropdown */}
        <div className="hidden sm:flex items-center flex-1 max-w-xl relative" ref={searchRef}>
          <div className="relative w-full group">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-(--muted-foreground) transition-colors group-focus-within:text-(--primary)"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                handleQueryChange(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => query.length >= 2 && setIsOpen(true)}
              placeholder="Search files... (Cmd+K)"
              className="pl-10 pr-10 transition-all duration-200 focus:shadow-md focus:border-(--primary)/50"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-(--muted) text-(--muted-foreground) hover:text-(--foreground) transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <SearchResults />
        </div>
      </div>

      {/* Right side - User menu */}
      <div className="flex items-center gap-2">
        {/* Mobile search button */}
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden btn-press"
          onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </Button>

        {/* Notifications with badge indicator */}
        <Button variant="ghost" size="icon" className="relative btn-press">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-(--accent) rounded-full animate-pulse-soft" />
        </Button>

        {/* User dropdown with enhanced styling */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 p-1 h-auto btn-press hover:bg-(--muted) transition-all duration-200"
            >
              <Avatar className="h-8 w-8 ring-2 ring-(--border) ring-offset-1 ring-offset-(--background)">
                {user.image && <AvatarImage src={user.image} alt={user.name || 'User'} />}
                <AvatarFallback className="bg-gradient-warm text-(--primary-foreground) text-sm font-semibold">
                  {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-sm font-medium max-w-[120px] truncate">
                {user.name || user.email}
              </span>
              <svg
                className="hidden md:block w-4 h-4 text-(--muted-foreground) transition-transform duration-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 animate-scale-in shadow-lg">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold">{user.name || 'User'}</p>
                <p className="text-xs text-(--muted-foreground) truncate">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer transition-colors hover:bg-(--muted)">
              <svg className="w-4 h-4 mr-2 text-(--muted-foreground)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer transition-colors hover:bg-(--muted)">
              <svg className="w-4 h-4 mr-2 text-(--muted-foreground)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onSignOut}
              className="cursor-pointer text-(--destructive) transition-colors hover:bg-(--destructive)/10 focus:bg-(--destructive)/10"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-50 sm:hidden bg-(--background)">
          <div className="flex items-center gap-2 p-4 border-b border-(--border)">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setMobileSearchOpen(false);
                clearSearch();
              }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-(--muted-foreground)"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search files..."
                className="pl-10"
              />
            </div>
          </div>
          <div className="p-4 overflow-auto max-h-[calc(100vh-80px)]">
            {isSearching ? (
              <div className="flex items-center justify-center gap-2 py-8">
                <div className="w-5 h-5 border-2 border-(--primary) border-t-transparent rounded-full animate-spin" />
                <span className="text-(--muted-foreground)">Searching...</span>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-1">
                {results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => {
                      handleResultClick(result);
                      setMobileSearchOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-(--muted) transition-colors text-left"
                  >
                    {getFileIcon(result.mimeType)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-(--foreground) truncate">{result.name}</p>
                      <p className="text-sm text-(--muted-foreground)">{formatFileSize(result.sizeBytes)}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : query.length >= 2 ? (
              <p className="text-center text-(--muted-foreground) py-8">No files found</p>
            ) : (
              <p className="text-center text-(--muted-foreground) py-8">
                Type at least 2 characters to search
              </p>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
