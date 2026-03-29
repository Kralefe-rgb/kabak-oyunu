import { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';

// Burayı kendi Render linkinle değiştirmeyi unutma!
const socket = io('https://kabak-oyunu.onrender.com');

function App() {
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [myInfo, setMyInfo] = useState<any>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [message, setMessage] = useState('HOŞ GELDİNİZ');
  const [timeLeft, setTimeLeft] = useState(100);
  const [step, setStep] = useState<'bekle' | 'olmaz_de' | 'kac_olsun_sor' | 'hedef_sec'>('bekle');
  const [turn, setTurn] = useState({ s_id: '', t_id: '' });

  const alivePlayers = players.filter(p => p.isAlive);
  const isWinner = alivePlayers.length === 1 && gameStarted && myInfo?.isAlive;

  useEffect(() => {
    socket.off();
    socket.on('update_players', (data) => { setPlayers(data); setMyInfo(data.find((p: any) => p.id === socket.id)); });
    socket.on('game_start_signal', () => {
      setGameStarted(true);
      setMessage("TARLAYI EKTİM BİÇTİM...");
      if (players.find(p => p.num === 1)?.id === socket.id) setStep('hedef_sec');
      setTimeLeft(100);
    });
    socket.on('game_reset_signal', () => { setGameStarted(false); setStep('bekle'); setMessage('HOŞ GELDİNİZ'); setTimeLeft(100); });
    socket.on('receive_olur', (d) => {
      setMessage(`${d.s_name} (${d.s_num}): ${d.t_num} KABAK OLUR!`);
      setTurn({ s_id: d.s_id, t_id: d.t_id });
      setStep(socket.id === d.t_id ? 'olmaz_de' : 'bekle');
      setTimeLeft(100);
    });
    socket.on('receive_olmaz', (d) => { setMessage(`${d.s_name} (${d.s_num}): OLMAZ DEDİ!`); setStep(socket.id === turn.s_id ? 'kac_olsun_sor' : 'bekle'); setTimeLeft(100); });
    socket.on('receive_kac_olsun', (d) => { setMessage(`${d.s_name}: YA KAÇ KABAK OLUR?`); setStep(socket.id === turn.t_id ? 'hedef_sec' : 'bekle'); setTimeLeft(100); });
    socket.on('timeout_recovery', (data) => { setMessage("SIRA DEVREDİLDİ!"); setStep(socket.id === data.next_id ? 'hedef_sec' : 'bekle'); setTimeLeft(100); });
    return () => { socket.off(); };
  }, [players, turn]);

  useEffect(() => {
    let timer: any;
    if (step !== 'bekle' && gameStarted && myInfo?.isAlive && !isWinner) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 0) { socket.emit('wrong_action', { back_to_id: turn.s_id }); setStep('bekle'); return 0; }
          return prev - 2;
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [step, gameStarted, myInfo, turn, isWinner]);

  const handleAction = (type: string, tNum?: number) => {
    if (type === 'olmaz_de') socket.emit('send_olmaz', { t_id: turn.s_id });
    else if (type === 'kac_olsun_sor') socket.emit('send_kac_olsun', { t_id: turn.t_id });
    else if (type === 'hedef_sec' && tNum) socket.emit('send_olur', { targetNum: tNum });
    setStep('bekle');
  };

  const fixedButtons = useMemo(() => {
    if (step !== 'olmaz_de' || !myInfo) return [];
    const traps = [
      { label: `${myInfo.num} KABAK OLMAZ!`, isFake: false },
      { label: `${myInfo.num} KABAK OLUR`, isFake: true },
      { label: `${myInfo.num + 1} KABAK OLMAZ`, isFake: true },
      { label: `1 KABAK OLUR`, isFake: true },
    ].sort(() => 0.5 - Math.random());
    return traps;
  }, [step === 'olmaz_de', myInfo?.num]);

  if (!joined) return (
    <div style={{ backgroundColor: '#1a1a1a', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '20px' }}>
      <h1 style={{color:'#4CAF50', fontSize:'2.5rem', textAlign:'center'}}>KABAK OYUNU</h1>
      <input placeholder="Adın" onChange={(e) => setName(e.target.value)} style={{ padding: '15px', borderRadius: '10px', border:'none', fontSize:'1.2rem', width:'100%', maxWidth:'300px', textAlign:'center' }} />
      <button onClick={() => { if(name) { socket.emit('join_game', { name }); setJoined(true); } }} style={{ marginTop: '20px', padding: '15px 50px', backgroundColor: '#4CAF50', color: 'white', borderRadius: '10px', fontWeight: 'bold', cursor:'pointer', border:'none', width:'100%', maxWidth:'300px' }}>BAŞLA</button>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#121212', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      {/* ÜST PANEL */}
      <div style={{ padding: '10px 15px', backgroundColor: '#1f1f1f', display: 'flex', justifyContent: 'space-between', borderBottom:'1px solid #333', alignItems:'center', fontSize: '0.9rem' }}>
        <div>💰 <span style={{color:'#FFD700'}}>{myInfo?.points}p</span></div>
        {myInfo?.num === 1 && gameStarted && (
          <button onClick={() => socket.emit('reset_game_request')} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', fontSize:'0.7rem' }}>Sıfırla</button>
        )}
        <div>No: <span style={{color:'#4CAF50'}}>{myInfo?.num}</span></div>
      </div>

      {/* SÜRE ÇUBUĞU */}
      <div style={{ height: '6px', backgroundColor: '#333' }}>
        <div style={{ height: '100%', backgroundColor: timeLeft > 30 ? '#4CAF50' : '#e74c3c', width: `${timeLeft}%`, transition: 'width 0.1s linear' }}></div>
      </div>
      
      {/* ANA İÇERİK (Dikey Dizilim) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px', gap: '15px' }}>
        
        {/* OYUNCU LİSTESİ (Yatay Kaydırılabilir) */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', borderBottom: '1px solid #222' }}>
          {players.map(p => (
            <div key={p.id} style={{ 
              minWidth: '90px', padding: '8px', borderRadius: '10px', 
              backgroundColor: p.isAlive ? (p.id === myInfo?.id ? '#1e3a2a' : '#2c3e50') : '#000', 
              border: p.id === myInfo?.id ? '1px solid #4CAF50' : 'none',
              opacity: p.isAlive ? 1 : 0.4, textAlign: 'center', fontSize: '0.75rem'
            }}>
              <div style={{fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis'}}>{p.name} ({p.num})</div>
              <div>{p.points}p</div>
              {alivePlayers.length === 1 && p.id === alivePlayers[0].id && gameStarted && <div style={{color:'#FFD700', fontSize:'0.6rem'}}>🏆</div>}
            </div>
          ))}
        </div>

        {/* MESAJ VE BUTONLAR */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px' }}>
          {isWinner ? (
            <h1 style={{fontSize:'3rem', color:'#FFD700'}}>🏆 ŞAMPİYON!</h1>
          ) : myInfo?.isAlive ? (
            <div style={{width: '100%'}}>
              <h2 style={{ fontSize: '1.4rem', color: '#4CAF50', marginBottom: '30px', minHeight: '3.5rem' }}>{message}</h2>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>
                {!gameStarted ? (
                  players[0]?.id === socket.id && <button onClick={() => socket.emit('start_game_request')} style={{ padding: '15px 40px', backgroundColor: '#FFD700', borderRadius: '50px', fontWeight: 'bold', color:'black' }}>OYUNU BAŞLAT</button>
                ) : (
                  <>
                    {step === 'bekle' && <p style={{ color: '#888' }}>Diğerleri oynuyor...</p>}
                    
                    {step === 'olmaz_de' && fixedButtons.map((btn, i) => (
                      <button key={i} onClick={() => { if(btn.isFake) { socket.emit('wrong_action', { back_to_id: turn.s_id }); setStep('bekle'); } else { handleAction('olmaz_de'); } }} style={mobileBtn}>{btn.label}</button>
                    ))}

                    {step === 'kac_olsun_sor' && <button onClick={() => handleAction('kac_olsun_sor')} style={mobileBtn}>YA KAÇ KABAK OLUR?</button>}
                    
                    {step === 'hedef_sec' && alivePlayers.filter(p=>p.num !== myInfo?.num).map(p => (
                      <button key={p.id} onClick={() => handleAction('hedef_sec', p.num)} style={mobileChoiceBtn}>{p.num} KABAK OLUR</button>
                    ))}
                  </>
                )}
              </div>
            </div>
          ) : <h1 style={{color: '#e74c3c'}}>💀 ELENDİN!</h1>}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ padding: '8px', textAlign: 'center', backgroundColor: '#1a1a1a', color: '#444', fontSize: '0.65rem' }}>
        © 2026 | Created by <span style={{ color: '#FFD700' }}>ED</span>
      </div>
    </div>
  );
}

const mobileBtn = { 
  width: '85%', padding: '16px', backgroundColor: '#4CAF50', color: 'white', 
  border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', 
  boxShadow: '0 4px 0 #2E7D32', active: { transform: 'translateY(2px)', boxShadow: 'none' } 
};

const mobileChoiceBtn = { 
  width: '45%', padding: '12px', backgroundColor: '#2c3e50', color: 'white', 
  border: '1px solid #444', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem' 
};

export default App;