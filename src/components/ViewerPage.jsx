import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export default function ViewerPage() {
  const [username, setUsername] = useState(() => localStorage.getItem("bt_username") || "");
  const [isRegistered, setIsRegistered] = useState(false);
  const [players, setPlayers] = useState([]); 
  const [status, setStatus] = useState("active"); // active, waiting, taken, me
  const [activeMusic, setActiveMusic] = useState(null); // Pour le son
  
  const audioRef = useRef(null);
  const lightGrey = "#d1d5db";

  // Base URL de ton storage Supabase
  const STORAGE_URL = "https://sxwltroedzxkvqpbcqjc.supabase.co/storage/v1/object/public/songs/";

  useEffect(() => {
    if (username) {
      setIsRegistered(true);
    }
  }, []);

  // --- LOGIQUE AUDIO ---
  useEffect(() => {
    if (!isRegistered) return;

    const fetchMusic = async () => {
      const { data } = await supabase
        .from('BlindtestMusic')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      
      setActiveMusic(data);
    };

    fetchMusic();

    const musicChannel = supabase
      .channel('music_viewer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'BlindtestMusic' }, fetchMusic)
      .subscribe();

    return () => supabase.removeChannel(musicChannel);
  }, [isRegistered]);

  // Gestion du lecteur Audio (Play/Pause)
  useEffect(() => {
    if (!audioRef.current) return;

    if (activeMusic) {
      if (activeMusic.is_paused) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.log("Attente interaction utilisateur pour le son"));
      }
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [activeMusic]);

  // 1. REJOINDRE LA PARTIE
  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanName = username.trim().toUpperCase();
    
    if (cleanName.length > 2) {
      const { data: existingPlayer } = await supabase
        .from('BlindtestPlayer')
        .select('username')
        .eq('username', cleanName)
        .maybeSingle();

      if (existingPlayer) {
        alert("CE PSEUDO EST DÉJÀ UTILISÉ ! CHOISIS-EN UN AUTRE.");
        return;
      }

      localStorage.setItem("bt_username", cleanName);
      const { error } = await supabase
        .from('BlindtestPlayer')
        .insert({ username: cleanName, score: 0, status: 'active' });

      if (!error) {
        setIsRegistered(true);
      } else {
        alert("Erreur lors de l'inscription : " + error.message);
      }
    }
  };

  // 2. ACTION DU BUZZ
  const handleBuzzAction = async () => {
    if (status !== "active") return;
    setStatus("me");
    await supabase
      .from('BlindtestPlayer')
      .update({ status: 'buzzed', buzzed_at: new Date().toISOString() })
      .eq('username', username);
  };

  // 3. LOGIQUE TEMPS RÉEL JOUEURS
  useEffect(() => {
    if (!isRegistered) return;

    const fetchData = async () => {
      const { data } = await supabase
        .from('BlindtestPlayer')
        .select('*')
        .order('score', { ascending: false });

      if (data) {
        setPlayers(data);
        const me = data.find(p => p.username === username);
        const someoneElseBuzzed = data.find(p => p.status === 'buzzed' && p.username !== username);

        if (me?.status === 'buzzed') setStatus("me");
        else if (me?.status === 'waiting') setStatus("waiting");
        else if (someoneElseBuzzed) setStatus("taken");
        else setStatus("active");
      }
    };

    fetchData();

    const channel = supabase
      .channel('viewer_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'BlindtestPlayer' }, fetchData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [isRegistered, username]);

  const getBuzzerStyle = () => {
    switch(status) {
      case "active":  return "bg-[#22c55e] shadow-[0_12px_0_0_#15803d] hover:bg-[#4ade80] active:shadow-none active:translate-y-2 cursor-pointer";
      case "waiting": return "bg-[#dc2626] shadow-[0_12px_0_0_#991b1b] cursor-not-allowed opacity-90";
      case "taken":   return "bg-[#6b7280] shadow-[0_12px_0_0_#374151] cursor-not-allowed opacity-80";
      case "me":      return "bg-[#f97316] shadow-[0_12px_0_0_#c2410c] animate-pulse";
      default:        return "bg-[#9ca3af]";
    }
  };

  const getFontSize = () => {
    if (status === "waiting") return "45px";
    return "65px";
  };

  if (!isRegistered) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full px-[10vw] bg-black">
        <form onSubmit={handleJoin} className="w-full max-w-md border-[8px] border-[#2e1065] bg-[#262626]/80 p-8 backdrop-blur-md flex flex-col gap-6" style={{ borderRadius: '24px' }}>
          <h2 className="text-[#facc15] font-[1000] text-3xl text-center italic uppercase tracking-widest">TON PSEUDO ?</h2>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toUpperCase())} placeholder="ÉCRIS ICI..." className="w-full box-border bg-black/50 border-4 border-[#2e1065] p-4 text-[#facc15] text-2xl font-[900] text-center outline-none focus:border-[#facc15] transition-colors" style={{ borderRadius: '12px' }} maxLength={12} />
          <button type="submit" className="w-full bg-[#facc15] text-black font-[1000] py-4 text-2xl uppercase italic shadow-[0_6px_0_0_#a16207] active:translate-y-1 active:shadow-none transition-all" style={{ borderRadius: '12px' }}>REJOINDRE</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center h-screen w-full pt-4 pb-2 px-[5vw] md:px-[20vw] bg-black overflow-hidden">
      
      {/* Lecteur Audio Invisible */}
      <audio 
        ref={audioRef} 
        src={activeMusic ? `${STORAGE_URL}${encodeURIComponent(activeMusic.filename)}` : ""} 
      />

      {/* SCOREBOARD */}
      <div className="w-full border-[8px] border-[#2e1065] bg-[#262626]/45 p-6 backdrop-blur-sm z-10 overflow-y-auto" style={{ minHeight: '350px', maxHeight: '48vh', borderRadius: '24px' }}>
        <div className="flex justify-between items-center border-b-[4px] border-[#2e1065] pb-4 mb-4 sticky top-0 bg-[#262626]/10 backdrop-blur-md">
           <h2 className="text-[#facc15] font-[1000] text-4xl italic uppercase tracking-[0.2em]">Scores</h2>
          <span className="font-mono text-sm opacity-50 uppercase" style={{ color: lightGrey }}>{username}</span>
        </div>
        
        <div className="space-y-4">
          {players.length > 0 ? players.map((p, i) => (
            <div key={i} className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-2xl md:text-3xl font-bold uppercase italic" style={{ color: p.username === username ? '#facc15' : lightGrey }}>
                {p.username} {p.username === username && "(MOI)"}
              </span>
              <span className="text-[#facc15] font-[1000] text-2xl md:text-3xl">{p.score} PTS</span>
            </div>
          )) : (
            <div className="h-40 flex items-center justify-center text-[#facc15]/30 text-2xl font-[900] uppercase italic text-center">En attente...</div>
          )}
        </div>
      </div>

      <div className="h-[84px] w-full flex-shrink-0"></div> 

      {/* SECTION DU BUZZER */}
      <div className="relative">
        <button 
          disabled={status !== "active"}
          onClick={handleBuzzAction}
          className={`w-[240px] h-[240px] md:w-[300px] md:h-[300px] rounded-full border-[8px] border-black flex items-center justify-center font-[1000] italic transition-all uppercase leading-none px-4 text-center ${getBuzzerStyle()}`}
          style={{ fontSize: getFontSize(), color: 'black' }}
        >
          {status === "active" && "BUZZ"}
          {status === "me" && "OK!"}
          {status === "taken" && "TROP TARD"}
          {status === "waiting" && "BLOQUÉ"}
        </button>
      </div>
    </div>
  );
}