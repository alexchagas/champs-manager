import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Save, Search, Trash2, ArrowRightLeft, Pencil } from 'lucide-react';
import type { Club, Player, Position } from '../types';
import { getAllClubs, getAllCountries } from '../data/teamsDatabase';
import { saveClubEdits } from '../data/editorPersistence';

type PlayerDraft = Pick<Player, 'id' | 'name' | 'age' | 'position' | 'foot' | 'strength' | 'skill1' | 'skill2'>;
const positions: Position[] = ['GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'ATA'];
const inputClass = 'w-full rounded border border-[#315241] bg-[#0b1a12] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400';
const labelClass = 'block space-y-1 text-xs font-semibold text-slate-300';
const buttonClass = 'rounded bg-[#193526] px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-[#245238]';
const emptyPlayer = (id: number): PlayerDraft => ({ id, name: '', age: 22, position: 'MEI', foot: 'D', strength: 60, skill1: '', skill2: '' });

export const TeamEditorScreen: React.FC<{ onBack: () => void; onDirtyChange: (dirty: boolean) => void }> = ({ onBack, onDirtyChange }) => {
  const [clubs, setClubs] = useState<Club[]>(() => [...getAllClubs()]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(() => new Set());
  const [playerDraft, setPlayerDraft] = useState<PlayerDraft | null>(null);
  const [transferId, setTransferId] = useState<number | null>(null);
  const [transferTarget, setTransferTarget] = useState<number | ''>('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => onDirtyChange(dirtyIds.size > 0), [dirtyIds, onDirtyChange]);
  const countries = useMemo(() => getAllCountries(), []);
  const selected = clubs.find((club) => club.id === selectedId);
  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return clubs.filter((club) => !text || club.name.toLocaleLowerCase().includes(text))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).slice(0, 80);
  }, [clubs, query]);

  const updateClubs = (updates: Club[]) => {
    const byId = new Map(updates.map((club) => [club.id, club]));
    setClubs((current) => {
      const next = current.map((club) => byId.get(club.id) ?? club);
      updates.forEach((club) => { if (!current.some((item) => item.id === club.id)) next.push(club); });
      return next;
    });
    setDirtyIds((current) => new Set([...current, ...updates.map((club) => club.id)]));
    setMessage('Alterações pendentes. Clique em Salvar Alterações.');
  };
  const updateSelected = (patch: Partial<Club>) => { if (selected) updateClubs([{ ...selected, ...patch }]); };
  const createClub = () => {
    const id = Math.max(0, ...clubs.map((club) => club.id)) + 1;
    const club: Club = {
      id, name: 'Novo Clube', stadium: '', capacity: 0, countryId: 29,
      division: 1, divisionName: 'Série A', leagueName: 'Brasileirão', reputation: 1,
      coach: '', primaryColor: '#008f55', secondaryColor: '#ffffff', balance: 1000000,
      ticketPrice: 20, crestUrl: '', crestMiniUrl: '', squad: [],
      tactics: { formation: '4-4-2', mentality: 'Equilibrada', penaltyTakerId: 0,
        freeKickTakerId: 0, cornerTakerId: 0, captainId: 0 },
    };
    updateClubs([club]);
    setSelectedId(id);
    setQuery('');
  };
  const savePlayer = () => {
    if (!selected || !playerDraft) return;
    if (!playerDraft.name.trim() || !Number.isInteger(playerDraft.age) || playerDraft.age < 15 || playerDraft.age > 60 ||
      !Number.isInteger(playerDraft.strength) || playerDraft.strength < 1 || playerDraft.strength > 100) {
      setMessage('Informe nome, idade entre 15 e 60 e força entre 1 e 100.'); return;
    }
    const existing = selected.squad.find((player) => player.id === playerDraft.id);
    const player: Player = existing ? { ...existing, ...playerDraft, name: playerDraft.name.trim() } : {
      ...playerDraft, name: playerDraft.name.trim(), energy: 100, salary: 3000,
      marketValue: playerDraft.strength ** 2 * 800, isStarter: false, isStar: false,
      isWorldTop: false, goals: 0, assists: 0, yellowCards: 0, redCards: 0,
      injured: false, suspended: false, contractYears: 2,
    };
    updateSelected({ squad: existing ? selected.squad.map((item) => item.id === player.id ? player : item) : [...selected.squad, player] });
    setPlayerDraft(null);
  };
  const deletePlayer = (id: number) => {
    if (!selected || !window.confirm('Excluir este jogador do elenco?')) return;
    updateSelected({ squad: selected.squad.filter((player) => player.id !== id) });
  };
  const transferPlayer = () => {
    if (!selected || !transferId || transferTarget === '' || transferTarget === selected.id) return;
    const target = clubs.find((club) => club.id === transferTarget);
    const player = selected.squad.find((item) => item.id === transferId);
    if (!target || !player) return;
    updateClubs([
      { ...selected, squad: selected.squad.filter((item) => item.id !== player.id) },
      { ...target, squad: [...target.squad, { ...player, isStarter: false }] },
    ]);
    setTransferId(null);
    setTransferTarget('');
  };
  const save = async () => {
    if (!dirtyIds.size) return;
    const changes = clubs.filter((club) => dirtyIds.has(club.id));
    if (changes.some((club) => !club.name.trim() || !club.stadium.trim() || club.capacity < 0 || !Number.isInteger(club.capacity))) {
      setMessage('Preencha nome e estádio e informe uma capacidade válida em todos os clubes alterados.'); return;
    }
    setSaving(true);
    try {
      await saveClubEdits(changes);
      setDirtyIds(new Set());
      setMessage('Alterações salvas. Novas carreiras usarão esta base.');
    } catch (error) {
      setMessage(`Não foi possível salvar: ${error instanceof Error ? error.message : String(error)}`);
    } finally { setSaving(false); }
  };
  const handleBack = () => onBack();
  const newPlayerId = Math.max(0, ...clubs.flatMap((club) => club.squad.map((player) => player.id))) + 1;

  return <div className="mx-auto max-w-6xl space-y-4 text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-black text-emerald-400">Editor de Clubes e Jogadores</h2>
        <p className="text-xs text-slate-400">Edite a base para as próximas carreiras.</p></div>
      <div className="flex gap-2"><button onClick={handleBack} className={buttonClass}><ArrowLeft className="mr-1 inline h-4 w-4"/>Voltar</button>
        <button onClick={save} disabled={!dirtyIds.size || saving} className="rounded bg-emerald-500 px-4 py-2 text-xs font-black text-black disabled:opacity-50"><Save className="mr-1 inline h-4 w-4"/>Salvar Alterações</button></div>
    </div>
    {message && <p role="status" className="rounded border border-[#315241] bg-[#10251a] px-3 py-2 text-xs text-emerald-200">{message}</p>}
    <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-[#254433] bg-[#102018] p-3">
        <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500"/><input aria-label="Buscar clube" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar qualquer clube" className={`${inputClass} pl-8`}/></div>
        <button onClick={createClub} className="mt-2 w-full rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-black"><Plus className="mr-1 inline h-4 w-4"/>Criar Novo Clube</button>
        <div className="mt-3 max-h-[62vh] space-y-1 overflow-y-auto">{filtered.map((club) => <button key={club.id} onClick={() => setSelectedId(club.id)} className={`w-full rounded px-2 py-2 text-left text-xs ${selectedId === club.id ? 'bg-emerald-700 text-white' : 'hover:bg-[#1a3626] text-slate-300'}`}>{club.name}{dirtyIds.has(club.id) && <span className="ml-1 text-amber-400">●</span>}</button>)}</div>
      </aside>
      {selected ? <div className="space-y-4">
        <section className="rounded-lg border border-[#254433] bg-[#102018] p-4">
          <h3 className="mb-3 text-sm font-bold text-emerald-400">Dados do Clube</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className={labelClass}>Nome<input className={inputClass} value={selected.name} onChange={(e) => updateSelected({ name: e.target.value })}/></label>
            <label className={labelClass}>Estádio<input className={inputClass} value={selected.stadium} onChange={(e) => updateSelected({ stadium: e.target.value })}/></label>
            <label className={labelClass}>Capacidade<input type="number" min="0" className={inputClass} value={selected.capacity} onChange={(e) => updateSelected({ capacity: Number(e.target.value) })}/></label>
            <label className={labelClass}>País<select className={inputClass} value={selected.countryId ?? 29} onChange={(e) => {
              const countryId = Number(e.target.value);
              updateSelected({ countryId, stateId: undefined, stateCode: '', stateName: '', leagueName: countryId === 29 ? 'Brasileirão' : `Liga ${countries.find((c) => c.id === countryId)?.name ?? ''}` });
            }}>{countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}</select></label>
            <label className={labelClass}>Divisão<input type="number" min="1" max="20" className={inputClass} value={selected.division ?? 1} onChange={(e) => { const division = Number(e.target.value); updateSelected({ division, divisionName: selected.countryId === 29 ? `Série ${String.fromCharCode(64 + Math.min(division, 26))}` : `${division}ª Divisão` }); }}/></label>
            <label className={labelClass}>Reputação<select className={inputClass} value={selected.reputation} onChange={(e) => updateSelected({ reputation: Number(e.target.value) })}>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{'★'.repeat(n)} {n}</option>)}</select></label>
            <label className={labelClass}>Cor primária<input type="color" className="h-10 w-full cursor-pointer rounded bg-transparent" value={selected.primaryColor} onChange={(e) => updateSelected({ primaryColor: e.target.value })}/></label>
            <label className={labelClass}>Cor secundária<input type="color" className="h-10 w-full cursor-pointer rounded bg-transparent" value={selected.secondaryColor} onChange={(e) => updateSelected({ secondaryColor: e.target.value })}/></label>
          </div>
        </section>
        <section className="rounded-lg border border-[#254433] bg-[#102018] p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-emerald-400">Elenco ({selected.squad.length})</h3><button className={buttonClass} onClick={() => setPlayerDraft(emptyPlayer(newPlayerId))}><Plus className="mr-1 inline h-4 w-4"/>Adicionar Novo Jogador</button></div>
          <div className="max-h-[48vh] overflow-auto"><table className="w-full min-w-[430px] text-left text-xs"><thead className="sticky top-0 bg-[#193526] text-slate-300"><tr><th className="p-2">Jogador</th><th>Pos.</th><th>Idade</th><th>Força</th><th>Ações</th></tr></thead><tbody>{selected.squad.map((player) => <tr key={player.id} className="border-b border-[#264230]"><td className="p-2 font-semibold">{player.name}</td><td>{player.position}</td><td>{player.age}</td><td>{player.strength}</td><td className="whitespace-nowrap"><button title="Editar" aria-label={`Editar ${player.name}`} onClick={() => setPlayerDraft({ id: player.id, name: player.name, age: player.age, position: player.position, foot: player.foot, strength: player.strength, skill1: player.skill1, skill2: player.skill2 })} className="p-1 text-emerald-300"><Pencil className="h-4 w-4"/></button><button title="Transferir" aria-label={`Transferir ${player.name}`} onClick={() => { setTransferId(player.id); setTransferTarget(''); }} className="p-1 text-sky-300"><ArrowRightLeft className="h-4 w-4"/></button><button title="Excluir" aria-label={`Excluir ${player.name}`} onClick={() => deletePlayer(player.id)} className="p-1 text-rose-400"><Trash2 className="h-4 w-4"/></button></td></tr>)}</tbody></table></div>
        </section>
      </div> : <div className="rounded-lg border border-[#254433] bg-[#102018] p-8 text-center text-sm text-slate-400">Busque e selecione um clube ou crie um novo.</div>}
    </div>
    {playerDraft && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Editar jogador"><div className="w-full max-w-lg space-y-4 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] p-5 shadow-2xl"><h3 className="font-bold text-[var(--app-text-accent)]">{selected?.squad.some((player) => player.id === playerDraft.id) ? 'Editar Jogador' : 'Novo Jogador'}</h3><div className="grid gap-3 sm:grid-cols-2">
      <label className={labelClass}>Nome<input className={inputClass} value={playerDraft.name} onChange={(e) => setPlayerDraft({ ...playerDraft, name: e.target.value })}/></label>
      <label className={labelClass}>Idade<input type="number" min="15" max="60" className={inputClass} value={playerDraft.age} onChange={(e) => setPlayerDraft({ ...playerDraft, age: Number(e.target.value) })}/></label>
      <label className={labelClass}>Posição<select className={inputClass} value={playerDraft.position} onChange={(e) => setPlayerDraft({ ...playerDraft, position: e.target.value as Position })}>{positions.map((position) => <option key={position}>{position}</option>)}</select></label>
      <label className={labelClass}>Força<input type="number" min="1" max="100" className={inputClass} value={playerDraft.strength} onChange={(e) => setPlayerDraft({ ...playerDraft, strength: Number(e.target.value) })}/></label>
      <label className={labelClass}>Lado<select className={inputClass} value={playerDraft.foot} onChange={(e) => setPlayerDraft({ ...playerDraft, foot: e.target.value as Player['foot'] })}><option value="D">Direito</option><option value="E">Esquerdo</option><option value="A">Ambidestro</option></select></label>
      <label className={labelClass}>Característica Especial 1<input className={inputClass} value={playerDraft.skill1} onChange={(e) => setPlayerDraft({ ...playerDraft, skill1: e.target.value })}/></label>
      <label className={labelClass}>Característica Especial 2<input className={inputClass} value={playerDraft.skill2} onChange={(e) => setPlayerDraft({ ...playerDraft, skill2: e.target.value })}/></label>
    </div><div className="flex justify-end gap-2"><button className={buttonClass} onClick={() => setPlayerDraft(null)}>Cancelar</button><button className="rounded bg-emerald-500 px-4 py-2 text-xs font-bold text-black" onClick={savePlayer}>Confirmar</button></div></div></div>}
    {transferId !== null && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Transferir jogador"><div className="w-full max-w-md space-y-4 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-1)] p-5"><h3 className="font-bold text-[var(--app-text-accent)]">Transferência rápida</h3><p className="text-xs text-slate-300">Escolha o clube de destino.</p><select className={inputClass} value={transferTarget} onChange={(e) => setTransferTarget(Number(e.target.value))}><option value="">Selecione um clube</option>{clubs.filter((club) => club.id !== selectedId).sort((a,b) => a.name.localeCompare(b.name)).map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select><div className="flex justify-end gap-2"><button className={buttonClass} onClick={() => setTransferId(null)}>Cancelar</button><button disabled={transferTarget === ''} className="rounded bg-emerald-500 px-4 py-2 text-xs font-bold text-black disabled:opacity-50" onClick={transferPlayer}>Transferir</button></div></div></div>}
  </div>;
};
