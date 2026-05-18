import { useContext } from 'react';
import { WikiContext } from './wikiContext';

export function useWiki() {
  const ctx = useContext(WikiContext);
  if (!ctx) throw new Error('useWiki must be used inside WikiProvider');
  return ctx;
}
