import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { Club } from '../types';
import { getMiniSprite, getNormalSprite, subscribeSpriteMaps } from '../utils/spriteManager';

interface ClubCrestProps {
  club?: Partial<Pick<Club, 'name' | 'fileRef' | 'primaryColor' | 'secondaryColor' | 'crestUrl' | 'crestMiniUrl'>> | null;
  preferMini?: boolean;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showInitialsOnFallback?: boolean;
}

export const ClubCrest: React.FC<ClubCrestProps> = ({
  club,
  preferMini = false,
  className = '',
  size = 'md',
  showInitialsOnFallback = true,
}) => {
  const [, setMapsVersion] = useState(0);

  // Subscribe to sprite map downloads
  useEffect(() => {
    return subscribeSpriteMaps(() => {
      setMapsVersion((v) => v + 1);
    });
  }, []);

  const primaryUrl = preferMini
    ? club?.crestMiniUrl || club?.crestUrl
    : club?.crestUrl || club?.crestMiniUrl;
  const secondaryUrl = preferMini ? club?.crestUrl : club?.crestMiniUrl;

  const [currentSrc, setCurrentSrc] = useState<string | undefined>(primaryUrl || undefined);
  const [hasError, setHasError] = useState(false);

  // Extract slug
  const extractSlug = (url?: string): string => {
    if (!url) return '';
    const m = url.match(/\/([^/]+)\.png(?:[?#].*)?$/);
    return m ? m[1] : '';
  };

  const slug = club?.fileRef || extractSlug(primaryUrl);

  // Check spritesheet first
  const miniSprite = preferMini && slug ? getMiniSprite(slug) : null;
  const normalSprite = !preferMini && slug ? getNormalSprite(slug) : null;
  // Fallback to mini sprite if normal sprite is not yet in atlas
  const activeSprite = miniSprite || normalSprite || (slug ? getMiniSprite(slug) : null);
  const isMiniAtlas = Boolean(activeSprite && (activeSprite === miniSprite || activeSprite === getMiniSprite(slug)));

  // If club changes, reset image state
  useEffect(() => {
    setCurrentSrc(primaryUrl || undefined);
    setHasError(false);
  }, [primaryUrl]);

  const handleImageError = () => {
    if (currentSrc && secondaryUrl && currentSrc !== secondaryUrl) {
      setCurrentSrc(secondaryUrl);
    } else {
      setHasError(true);
    }
  };

  const clubName = club?.name || 'Clube';
  const primaryColor = club?.primaryColor || '#14532d';
  const secondaryColor =
    club?.secondaryColor === '#000000' || club?.secondaryColor === '#ffffff'
      ? club?.secondaryColor
      : '#ffffff';

  const initials =
    clubName
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || clubName.substring(0, 3).toUpperCase();

  const sizeClasses = {
    xs: 'w-3 h-3 text-[7px]',
    sm: 'w-4 h-4 text-[8px]',
    md: 'w-6 h-6 text-[10px]',
    lg: 'w-9 h-9 text-xs',
    xl: 'w-12 h-12 text-sm',
  }[size];

  // 1. If sprite is available in atlas, render crisp SVG viewBox
  if (activeSprite && !hasError) {
    const iconDim = isMiniAtlas ? 18 : 60;
    return (
      <svg
        viewBox={`${activeSprite.x} ${activeSprite.y} ${iconDim} ${iconDim}`}
        className={`object-contain shrink-0 drop-shadow select-none ${sizeClasses} ${className}`}
        aria-label={clubName}
        role="img"
      >
        <image
          href={activeSprite.atlasUrl}
          width={activeSprite.sheetWidth}
          height={activeSprite.sheetHeight}
          preserveAspectRatio="none"
        />
      </svg>
    );
  }

  // 2. If fallback / image failed
  if (!currentSrc || hasError) {
    return (
      <div
        className={`rounded flex items-center justify-center font-bold font-mono tracking-tighter shrink-0 select-none shadow-xs border border-white/10 ${sizeClasses} ${className}`}
        style={{
          backgroundColor: primaryColor,
          color: secondaryColor,
        }}
        title={clubName}
      >
        {showInitialsOnFallback && initials ? (
          <span>{initials}</span>
        ) : (
          <Shield className="w-3/4 h-3/4 opacity-80" />
        )}
      </div>
    );
  }

  // 3. Fallback direct image (while maps load or for custom editor clubs)
  return (
    <img
      src={currentSrc}
      alt={clubName}
      className={`object-contain shrink-0 drop-shadow select-none ${sizeClasses} ${className}`}
      onError={handleImageError}
      loading="lazy"
    />
  );
};
