import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { Club } from '../types';

interface ClubCrestProps {
  club?: Partial<Pick<Club, 'name' | 'primaryColor' | 'secondaryColor' | 'crestUrl' | 'crestMiniUrl'>> | null;
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
  const primaryUrl = preferMini
    ? club?.crestMiniUrl || club?.crestUrl
    : club?.crestUrl || club?.crestMiniUrl;
  const secondaryUrl = preferMini ? club?.crestUrl : club?.crestMiniUrl;

  const [currentSrc, setCurrentSrc] = useState<string | undefined>(primaryUrl || undefined);
  const [hasError, setHasError] = useState(false);

  // If club changes, reset image state
  React.useEffect(() => {
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

  const initials = clubName
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
