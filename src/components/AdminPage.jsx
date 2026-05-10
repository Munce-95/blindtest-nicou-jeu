import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminPage() {
  const [musics, setMusics] = useState([]);
  const [players, setPlayers] = useState([]);
  const [buzzedPlayer, setBuzzedPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  // RÉFÉRENCE : Pour détecter le changement de buzzer instantanément
  const lastBuzzerRef = useRef(null);

  // Styles homogènes
  const borderStyle = "border-[8px] border-[#2e1065]";
  const bgStyle = "bg-[#262626]/76 backdrop-blur-md";
  const lightGrey = "#d1d5db"; 
  const forcedRounded = { borderRadius: '24px' };

  useEffect(() => {
    fetchData();

    // Souscription temps réel
    const playerChannel = supabase
      .channel('player_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'BlindtestPlayer' }, fetchData)
      .subscribe();

    const musicChannel = supabase
      .channel('music_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'BlindtestMusic' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(playerChannel);
      supabase.removeChannel(musicChannel);
    };
  }, []);

  async function fetchData() {
    // 1. Récupérer les musiques
    const { data: musicData } = await supabase
      .from('BlindtestMusic')
      .select('*')
      .eq('is_played', false)
      .order('filename');
    
    if (musicData) setMusics(musicData);

    // 2. Récupérer les joueurs
    const { data: playerData } = await supabase
      .from('BlindtestPlayer')
      .select('*')
      .order('score', { ascending: false });

    if (playerData) {
      setPlayers(playerData);
      const firstBuzzer = playerData.find(p => p.status === 'buzzed');
      
      // LOGIQUE AUTO-PAUSE RENFORCÉE
      if (firstBuzzer && lastBuzzerRef.current !== firstBuzzer.username) {
        lastBuzzerRef.current = firstBuzzer.username;
        handleTogglePause(true); // Enclenche la pause
      } 
      else if (!firstBuzzer) {
        lastBuzzerRef.current = null;
      }
      
      setBuzzedPlayer(firstBuzzer ? firstBuzzer.username : null);
    }
    
    setLoading(false);
  }

  // ACTION : Play / Pause Manuel ou Automatique + Lancement de Queue
  async function handleTogglePause(pauseState) {
    // On cherche d'abord s'il y a une musique active
    const activeMusic = musics.find(m => m.is_active);

    if (activeMusic) {
      // Cas normal : On gère la pause/lecture du morceau en cours
      await supabase
        .from('BlindtestMusic')
        .update({ is_paused: pauseState })
        .eq('id', activeMusic.id);
    } 
    else if (pauseState === false) {
      // Cas "Play intelligent" : Pas de musique active, on regarde si une musique est en attente
      const queuedMusic = musics.find(m => m.is_queued);
      if (queuedMusic) {
        await supabase
          .from('BlindtestMusic')
          .update({ is_active: true, is_queued: false, is_paused: false })
          .eq('id', queuedMusic.id);
        
        await resetBuzzers(); // On nettoie les buzzers pour le nouveau départ
        fetchData();
      }
    }
  }

  // RESET DES MUSIQUES UNIQUEMENT
  async function resetAllMusics() {
    const confirmReset = window.confirm("🔄 Remettre toutes les musiques en 'non jouées' ? (Les scores seront conservés)");
    if (!confirmReset) return;

    await supabase
      .from('BlindtestMusic')
      .update({ is_played: false, is_active: false, is_queued: false, is_paused: false })
      .neq('id', 0); 
    
    fetchData();
  }

  // RESET DES SCORES UNIQUEMENT
  async function resetScores() {
    const confirmReset = window.confirm("🏆 Voulez-vous remettre tous les scores à zéro ?");
    if (!confirmReset) return;

    await supabase
      .from('BlindtestPlayer')
      .update({ score: 0, status: 'active' })
      .neq('username', '');
    
    fetchData();
  }

  // RESET DES BUZZERS (Remet tout le monde à active)
  async function resetBuzzers() {
    await supabase
      .from('BlindtestPlayer')
      .update({ status: 'active' })
      .neq('username', ''); 
  }

  // ACTION : Préparer la prochaine musique
  async function setNextMusic(id) {
    await supabase.from('BlindtestMusic').update({ is_queued: false }).eq('is_queued', true);
    await supabase.from('BlindtestMusic').update({ is_queued: true }).eq('id', id);
    fetchData();
  }

  // ACTION : Valider la réponse (Sans lecture automatique de la suivante)
  async function handleValidate() {
    if (!buzzedPlayer) return;
    const player = players.find(p => p.username === buzzedPlayer);
    const currentActive = musics.find(m => m.is_active);

    // 1. On donne le point
    await supabase.from('BlindtestPlayer')
      .update({ score: (player.score || 0) + 1 })
      .eq('username', buzzedPlayer);

    // 2. On marque la musique actuelle comme terminée (is_played: true)
    if (currentActive) {
      await supabase.from('BlindtestMusic')
        .update({ is_played: true, is_active: false, is_paused: false })
        .eq('id', currentActive.id);
    }

    // 3. On reset les buzzers
    await resetBuzzers();
    fetchData();
  }

  // ACTION : Refuser la réponse
  async function handleRefuse() {
    if (!buzzedPlayer) return;
    await supabase.from('BlindtestPlayer')
      .update({ status: 'waiting' })
      .eq('username', buzzedPlayer);
    
    fetchData();
  }

  const currentMusic = musics.find(m => m.is_active) || { filename: "--- SILENCE ---", is_paused: false };
  const nextMusicPreview = musics.find(m => m.is_queued) || { filename: "RIEN EN ATTENTE" };

  return (
    <div className="w-full max-w-7xl px-8 grid grid-cols-2 gap-12 h-[85vh] py-4 mx-auto">
      
      {/* GAUCHE : Régie Audio */}
      <div className="flex flex-col gap-6">
        
        {/* BLOC LIVE */}
        <div className={`${borderStyle} ${bgStyle} p-6 border-green-500/40`} style={forcedRounded}>
          <h3 className="text-green-400 font-[900] italic uppercase text-xs mb-1 tracking-widest">DIFFUSION EN DIRECT :</h3>
          <div className="flex justify-between items-center">
            <p className="text-4xl font-[1000] uppercase italic truncate text-white">
              {currentMusic.filename}
            </p>
            {currentMusic.is_paused && (
              <span className="text-red-500 font-black animate-pulse border-2 border-red-500 px-2 rounded ml-2 text-sm">PAUSE</span>
            )}
          </div>
        </div>

        {/* BLOC PREVIEW */}
        <div className={`${borderStyle} ${bgStyle} p-6 border-orange-500/40`} style={forcedRounded}>
          <h3 className="text-orange-400 font-[900] italic uppercase text-xs mb-1 tracking-widest">PROCHAINE :</h3>
          <p className="text-3xl font-[1000] uppercase italic truncate opacity-80" style={{ color: lightGrey }}>
            {nextMusicPreview.filename}
          </p>
        </div>

        {/* BIBLIOTHÈQUE */}
        <div className={`flex-1 ${borderStyle} ${bgStyle} p-6 flex flex-col gap-4`} style={forcedRounded}>
          <div className="w-full p-3 font-[1000] text-lg uppercase border-[4px] border-[#2e1065] bg-[#1a1a1a] text-[#facc15] text-center" style={{ borderRadius: '12px' }}>
            BIBLIOTHÈQUE MP3 ({musics.filter(m => !m.is_active).length})
          </div>
          
          <div className="flex-1 overflow-y-auto border-[4px] border-black/40 p-2 bg-black/40 font-mono text-base" style={{ borderRadius: '12px' }}>
             {loading ? (
               <div className="p-4 text-center italic" style={{ color: lightGrey }}>Chargement...</div>
             ) : musics.map((music) => (
               <div 
                key={music.id}
                onClick={() => setNextMusic(music.id)}
                className={`p-3 cursor-pointer border-b border-white/5 uppercase transition-colors hover:bg-[#2e1065] 
                  ${music.is_active ? 'hidden' : ''} 
                  ${music.is_queued ? 'bg-orange-500 text-black font-bold' : ''}`}
                style={{ color: music.is_queued ? 'black' : lightGrey }}
               >
                 {music.filename} {music.is_queued && " ➔ PRÊT"}
               </div>
             ))}
          </div>
        </div>

        {/* BARRE DE CONTROLE (4 BOUTONS MAINTENANT) */}
        <div className="flex justify-center gap-4">
          <button onClick={resetAllMusics} className="ctrl-btn bg-red-600 text-white !border-red-900 shadow-[0_8px_0_0_#450a0a]" title="Reset Musiques">🔄</button>
          <button onClick={resetScores} className="ctrl-btn bg-blue-600 text-white !border-blue-900 shadow-[0_8px_0_0_#1e3a8a]" title="Reset Scores">🏆</button>
          <button onClick={() => handleTogglePause(true)} className={`ctrl-btn ${currentMusic.is_paused ? 'bg-yellow-500 shadow-none translate-y-2' : ''}`}>⏸️</button>
          <button onClick={() => handleTogglePause(false)} className={`ctrl-btn ${(!currentMusic.is_paused && currentMusic.is_active) ? 'bg-green-500 shadow-none translate-y-2' : 'bg-white'}`}>▶️</button>
        </div>
      </div>

      {/* DROITE : Contrôle du Jeu */}
      <div className="flex flex-col gap-6">
        <div className={`flex-1 ${borderStyle} ${bgStyle} p-6 flex flex-col`} style={forcedRounded}>
          <h2 className="text-[#facc15] font-[1000] text-3xl text-center border-b-[4px] border-[#2e1065] pb-4 mb-6 italic uppercase tracking-[0.2em]">
            Live Ranking
          </h2>
          <div className="flex-1 overflow-y-auto space-y-4">
            {players.map((p, i) => (
              <div key={i} className="flex justify-between items-center px-4 border-b border-white/5 pb-2">
                <span className={`text-2xl font-bold uppercase italic ${p.status === 'waiting' ? 'text-red-500 opacity-50' : ''}`} style={{ color: p.status === 'waiting' ? '#ef4444' : lightGrey }}>
                  {p.username} {p.status === 'waiting' && "(BLOQUÉ)"}
                </span>
                <span className="text-[#facc15] font-[1000] text-2xl">{p.score} PTS</span>
              </div>
            ))}
          </div>
        </div>

        {/* ALERTE BUZZ */}
        <div className={`${borderStyle} ${bgStyle} h-40 flex items-center justify-center relative overflow-hidden text-center`} style={forcedRounded}>
          {buzzedPlayer ? (
            <div className="z-10">
              <p className="text-[#facc15] text-sm font-[900] uppercase tracking-[0.3em] mb-1">A BUZZÉ (PAUSE AUTO) :</p>
              <p className="text-6xl font-[1000] uppercase italic animate-pulse" style={{ color: lightGrey }}>
                {buzzedPlayer}
              </p>
            </div>
          ) : (
            <p className="font-[900] italic uppercase text-3xl tracking-[0.2em] opacity-30" style={{ color: lightGrey }}>
              Silence radio...
            </p>
          )}
        </div>

        {/* ACTIONS VALIDE / REFUSÉ */}
        <div className="grid grid-cols-2 gap-8">
          <button 
            onClick={handleValidate}
            className="h-24 border-[6px] border-black bg-[#22c55e] shadow-[0_10px_0_0_#15803d] active:translate-y-2 active:shadow-none font-[1000] text-4xl italic uppercase text-black disabled:opacity-30 transition-all"
            style={{ borderRadius: '20px' }}
            disabled={!buzzedPlayer}
          >
            VALIDE
          </button>
          <button 
            onClick={handleRefuse}
            className="h-24 border-[6px] border-black bg-[#dc2626] shadow-[0_10px_0_0_#991b1b] active:translate-y-2 active:shadow-none font-[1000] text-4xl italic uppercase text-black disabled:opacity-30 transition-all"
            style={{ borderRadius: '20px' }}
            disabled={!buzzedPlayer}
          >
            REFUSÉ
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .ctrl-btn {
          width: 4rem; height: 4rem; border-radius: 9999px; border: 6px solid black; background: white;
          box-shadow: 0 8px 0 0 #000; font-size: 1.8rem; display: flex; align-items: center; justify-content: center;
          transition: all 0.1s; cursor: pointer;
        }
        .ctrl-btn:active { transform: translateY(8px); box-shadow: none; }
        .ctrl-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      `}} />
    </div>
  );
}