export interface CompetitionZone {
  minPos: number;
  maxPos: number;
  label: string;
  colorClass: string;
  bgHoverClass: string;
  dotColor: string;
}

export interface CompetitionZoneParams {
  competitionType?: 'estadual' | 'nacional' | 'copa' | 'libertadores' | 'sulamericana' | 'champions' | string;
  totalTeams: number;
  division?: number;
  countryId?: number;
  stateCode?: string;
  stateDivisions?: number;
  totalClubsInState?: number;
  customRelegated?: number;
}

/**
 * Returns dynamic qualification and relegation zones based on tournament rules and configuration.
 *
 * Rules:
 * - Estadual: G4 qualifies for Semifinais. Relegation only exists if state has access division (divisions > 1
 *   or more clubs than top division). Intermediates have NO continental spots.
 * - Nacional Série A: Libertadores (1-4), Pré-Libert. (5-6), Sul-Americana (7-12), Rebaixamento (17-20).
 * - Nacional Série B / C: Acesso (1-4), Rebaixamento (últimos nRebaixados).
 * - Nacional Série D: Acesso (1-4), sem rebaixamento.
 * - Continental (Libertadores/Sulamericana/Champions): Classificação (1-2), sem rebaixamento.
 * - Copa: Mata-mata, sem zonas de liga.
 */
export function getCompetitionZones(params: CompetitionZoneParams): CompetitionZone[] {
  const {
    competitionType = 'nacional',
    totalTeams,
    division = 1,
    countryId = 29,
    stateDivisions,
    totalClubsInState,
    customRelegated,
  } = params;

  if (totalTeams <= 0) return [];

  // Copa is pure knockout, no league zones
  if (competitionType === 'copa') {
    return [];
  }

  // Continental group stages
  if (['libertadores', 'sulamericana', 'champions'].includes(competitionType)) {
    const qualifiedCount = Math.min(2, totalTeams);
    return [
      {
        minPos: 1,
        maxPos: qualifiedCount,
        label: 'Classificação',
        colorClass: 'text-emerald-400 font-bold',
        bgHoverClass: 'hover:bg-emerald-950/20',
        dotColor: 'bg-emerald-400',
      },
    ];
  }

  // State Championship (Estadual)
  if (competitionType === 'estadual') {
    const zones: CompetitionZone[] = [];

    // Se for 2ª Divisão Estadual (Módulo II / Série A2):
    // G2 de acesso à elite e, em SP, Z2 de rebaixamento para a Série A3.
    if (division === 2) {
      const promoSpots = Math.min(2, totalTeams);
      if (promoSpots > 0) {
        zones.push({
          minPos: 1,
          maxPos: promoSpots,
          label: 'Acesso à 1ª Divisão',
          colorClass: 'text-emerald-400 font-bold',
          bgHoverClass: 'hover:bg-emerald-950/20',
          dotColor: 'bg-emerald-400',
        });
      }
      if (params.stateCode?.toUpperCase() === 'SP' && totalTeams >= 12) {
        zones.push({
          minPos: totalTeams - 1,
          maxPos: totalTeams,
          label: 'Rebaixamento (Série A3)',
          colorClass: 'text-rose-400 font-bold',
          bgHoverClass: 'hover:bg-rose-950/20',
          dotColor: 'bg-rose-500',
        });
      }
      return zones;
    }

    // Playoff spots: 2 per group when grouped in 4-team groups (e.g. Paulistão), 4 for single-table Semifinals
    const playoffSpots = totalTeams >= 6 ? 4 : Math.min(2, totalTeams);
    if (playoffSpots > 0) {
      zones.push({
        minPos: 1,
        maxPos: playoffSpots,
        label: totalTeams === 4 ? 'Quartas de Final' : playoffSpots >= 4 ? 'Semifinais' : 'Final',
        colorClass: 'text-emerald-400 font-bold',
        bgHoverClass: 'hover:bg-emerald-950/20',
        dotColor: 'bg-emerald-400',
      });
    }

    // Relegation check:
    // 1. Explicit stateDivisions === 1 -> NO relegation
    // 2. Explicit stateDivisions > 1 -> HAS relegation
    // 3. Fallback: if totalClubsInState is provided, relegation exists only if totalClubsInState > totalTeams
    // 4. Fallback default: standard 12-team state leagues have 2 relegated, smaller single-flight states (<=8) do not
    let hasRelegation = false;
    if (totalTeams <= 4) {
      hasRelegation = false;
    } else if (stateDivisions !== undefined) {
      hasRelegation = stateDivisions > 1;
    } else if (totalClubsInState !== undefined) {
      hasRelegation = totalClubsInState > totalTeams;
    } else {
      hasRelegation = totalTeams >= 12;
    }

    if (hasRelegation) {
      const relegatedCount = customRelegated ?? 2;
      // Ensure relegation does not overlap with playoff spots
      if (relegatedCount > 0 && totalTeams - relegatedCount >= playoffSpots) {
        zones.push({
          minPos: totalTeams - relegatedCount + 1,
          maxPos: totalTeams,
          label: 'Rebaixamento',
          colorClass: 'text-rose-400 font-bold',
          bgHoverClass: 'hover:bg-rose-950/20',
          dotColor: 'bg-rose-500',
        });
      }
    }

    return zones;
  }

  // National Leagues (Nacional)
  const isBrazil = countryId === 29;

  // First Division (Série A)
  if (division === 1) {
    const zones: CompetitionZone[] = [];

    if (isBrazil) {
      // 1-4 Libertadores
      if (totalTeams >= 4) {
        zones.push({
          minPos: 1,
          maxPos: 4,
          label: 'Libertadores',
          colorClass: 'text-emerald-400 font-bold',
          bgHoverClass: 'hover:bg-emerald-950/20',
          dotColor: 'bg-emerald-400',
        });
      }
      // 5-6 Pré-Libertadores
      if (totalTeams >= 6) {
        zones.push({
          minPos: 5,
          maxPos: 6,
          label: 'Pré-Libert.',
          colorClass: 'text-sky-400 font-bold',
          bgHoverClass: 'hover:bg-sky-950/20',
          dotColor: 'bg-sky-400',
        });
      }
      // 7-12 Sul-Americana
      if (totalTeams >= 12) {
        zones.push({
          minPos: 7,
          maxPos: 12,
          label: 'Sul-Americana',
          colorClass: 'text-amber-400 font-bold',
          bgHoverClass: 'hover:bg-amber-950/20',
          dotColor: 'bg-amber-400',
        });
      }
    } else {
      // European top flight
      if (totalTeams >= 4) {
        zones.push({
          minPos: 1,
          maxPos: 4,
          label: 'Champions League',
          colorClass: 'text-emerald-400 font-bold',
          bgHoverClass: 'hover:bg-emerald-950/20',
          dotColor: 'bg-emerald-400',
        });
      }
      if (totalTeams >= 6) {
        zones.push({
          minPos: 5,
          maxPos: 6,
          label: 'Europa League',
          colorClass: 'text-sky-400 font-bold',
          bgHoverClass: 'hover:bg-sky-950/20',
          dotColor: 'bg-sky-400',
        });
      }
      if (totalTeams >= 7) {
        zones.push({
          minPos: 7,
          maxPos: 7,
          label: 'Conference',
          colorClass: 'text-amber-400 font-bold',
          bgHoverClass: 'hover:bg-amber-950/20',
          dotColor: 'bg-amber-400',
        });
      }
    }

    // Relegation
    const relegatedCount = customRelegated ?? (isBrazil ? 4 : 3);
    if (relegatedCount > 0 && totalTeams > relegatedCount) {
      zones.push({
        minPos: totalTeams - relegatedCount + 1,
        maxPos: totalTeams,
        label: 'Rebaixamento',
        colorClass: 'text-rose-400 font-bold',
        bgHoverClass: 'hover:bg-rose-950/20',
        dotColor: 'bg-rose-500',
      });
    }

    return zones;
  }

  // Access Divisions (Série B, Série C)
  if (division === 2 || division === 3) {
    const zones: CompetitionZone[] = [];
    const promoCount = division === 3 && isBrazil && totalTeams >= 16
      ? 8
      : Math.min(4, totalTeams);

    if (promoCount > 0) {
      zones.push({
        minPos: 1,
        maxPos: promoCount,
        label: 'Acesso',
        colorClass: 'text-emerald-400 font-bold',
        bgHoverClass: 'hover:bg-emerald-950/20',
        dotColor: 'bg-emerald-400',
      });
    }

    const relegatedCount = customRelegated ?? 4;
    if (relegatedCount > 0 && totalTeams - relegatedCount >= promoCount) {
      zones.push({
        minPos: totalTeams - relegatedCount + 1,
        maxPos: totalTeams,
        label: 'Rebaixamento',
        colorClass: 'text-rose-400 font-bold',
        bgHoverClass: 'hover:bg-rose-950/20',
        dotColor: 'bg-rose-500',
      });
    }

    return zones;
  }

  // Bottom Flight (e.g. Série D / 4th division or lower) - Promotion only, NO relegation
  const zones: CompetitionZone[] = [];
  const promoCount = Math.min(4, totalTeams);
  if (promoCount > 0) {
    zones.push({
      minPos: 1,
      maxPos: promoCount,
      label: 'Acesso',
      colorClass: 'text-emerald-400 font-bold',
      bgHoverClass: 'hover:bg-emerald-950/20',
      dotColor: 'bg-emerald-400',
    });
  }

  return zones;
}

/**
 * Finds the competition zone corresponding to a specific 1-indexed position.
 */
export function getZoneForPosition(zones: CompetitionZone[], position: number): CompetitionZone | undefined {
  return zones.find((z) => position >= z.minPos && position <= z.maxPos);
}
