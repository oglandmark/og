import { useEffect, useState } from 'react';
import { getMobileSettings, type MobileContent } from '@/lib/api';

let cachedContent: MobileContent | null = null;
let contentPromise: Promise<MobileContent> | null = null;

function fetchContent(): Promise<MobileContent> {
  if (!contentPromise) {
    contentPromise = getMobileSettings()
      .then((settings) => {
        cachedContent = settings.content;
        return settings.content;
      })
      .finally(() => {
        contentPromise = null;
      });
  }
  return contentPromise;
}

export function useMobileContent() {
  const [content, setContent] = useState<MobileContent | null>(cachedContent);
  useEffect(() => {
    let active = true;
    void fetchContent().then((next) => {
      if (active) setContent(next);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return content;
}