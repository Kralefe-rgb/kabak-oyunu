import { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';

// NOT: Publish ederken buradaki localhost adresini Render linkinle değiştireceksin!
const socket = io('http://localhost:3001');

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
    socket.on('timeout_recovery', (data) => { setMessage("BİRİ ELENDİ VEYA HATA YAPTI!"); setStep(socket.id === data.next_id ? 'hedef_sec' : 'bekle'); setTimeLeft(100); });
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
    <div style={{ backgroundColor: '#1a1a1a', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <h1 style={{color:'#4CAF50', fontSize:'3rem'}}>KABAK OYUNU</h1>
      <input placeholder="Adın" onChange={(e) => setName(e.target.value)} style={{ padding: '15px', borderRadius: '10px', border:'none', fontSize:'1.2rem', textAlign:'center' }} />
      <button onClick={() => { if(name) { socket.emit('join_game', { name }); setJoined(true); } }} style={{ marginTop: '20px', padding: '15px 50px', backgroundColor: '#4CAF50', color: 'white', borderRadius: '10px', fontWeight: 'bold', cursor:'pointer', border:'none' }}>BAŞLA</button>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#121212', color: 'white', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div style={{ padding: '15px 25px', backgroundColor: '#1f1f1f', display: 'flex', justifyContent: 'space-between', borderBottom:'1px solid #333', alignItems:'center' }}>
        <div>💰 Puan: <span style={{color:'#FFD700'}}>{myInfo?.points}</span></div>
        {myInfo?.num === 1 && gameStarted && (
          <button onClick={() => socket.emit('reset_game_request')} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🔄 OYUNU SIFIRLA</button>
        )}
        <div>Senin No: <span style={{color:'#4CAF50'}}>{myInfo?.num}</span></div>
      </div>
      <div style={{ height: '8px', backgroundColor: '#333' }}>
        <div style={{ height: '100%', backgroundColor: timeLeft > 30 ? '#4CAF50' : '#e74c3c', width: `${timeLeft}%`, transition: 'width 0.1s linear' }}></div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', padding: '20px', gap: '20px', overflow:'hidden' }}>
        <div style={{ width: '250px', backgroundColor: '#1a1a1a', borderRadius: '15px', padding: '15px', border: '1px solid #333' }}>
          <h4 style={{ color: '#888', textAlign: 'center', margin: '0 0 10px 0' }}>OYUNCULAR</h4>
          {players.map(p => {
            const isPlayerWinner = alivePlayers.length === 1 && p.id === alivePlayers[0].id && gameStarted;
            return (
              <div key={p.id} style={{ padding: '10px', marginBottom: '8px', borderRadius: '8px', backgroundColor: p.isAlive ? '#2c3e50' : '#000', border: p.id === myInfo?.id ? '2px solid #4CAF50' : 'none', opacity: p.isAlive ? 1 : 0.4 }}>
                <strong>{p.name} ({p.num})</strong> {isPlayerWinner && <span style={{backgroundColor:'#FFD700', color:'black', padding:'2px 5px', borderRadius:'4px', fontSize:'0.7rem', fontWeight:'bold', marginLeft:'5px'}}>KAZANDI</span>} <br/> {p.points}p {!p.isAlive && "💀 ELENDİ"}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          {isWinner ? ( <h1 style={{fontSize:'5rem', color:'#FFD700'}}>🏆 ŞAMPİYONSUN!</h1> ) : myInfo?.isAlive ? (
            <div style={{maxWidth: '80%'}}>
              <h1 style={{ fontSize: '2.8rem', color: '#4CAF50', marginBottom: '40px', lineHeight:'1.3' }}>{message}</h1>
              <div style={{ minHeight: '150px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {!gameStarted ? ( players[0]?.id === socket.id && <button onClick={() => socket.emit('start_game_request')} style={{ padding: '20px 60px', backgroundColor: '#FFD700', borderRadius: '50px', fontWeight: 'bold', border:'none', cursor:'pointer' }}>🚀 OYUNU BAŞLAT</button> ) : (
                  <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {step === 'bekle' && <p style={{ color: '#888', fontSize:'1.2rem' }}>Sıra bekleniyor...</p>}
                    {step === 'olmaz_de' && fixedButtons.map((btn, i) => (
                      <button key={i} onClick={() => { if(btn.isFake) { socket.emit('wrong_action', { back_to_id: turn.s_id }); setStep('bekle'); } else { handleAction('olmaz_de'); } }} style={btnStyle}>{btn.label}</button>
                    ))}
                    {step === 'kac_olsun_sor' && <button onClick={() => handleAction('kac_olsun_sor')} style={btnStyle}>YA KAÇ KABAK OLUR?</button>}
                    {step === 'hedef_sec' && alivePlayers.filter(p=>p.num !== myInfo?.num).map(p => ( <button key={p.id} onClick={() => handleAction('hedef_sec', p.num)} style={choiceBtn}>{p.num} KABAK OLUR</button> ))}
                  </div>
                )}
              </div>
            </div>
          ) : <h1 style={{color: '#e74c3c', fontSize:'4rem'}}>💀 PATLADIN! <br/><span style={{fontSize:'1rem', color:'#555'}}>Created by ED</span></h1>}
        </div>
      </div>

      {/* FOOTER: Created by ED Kısmı */}
      <div style={{ padding: '10px', textAlign: 'center', backgroundColor: '#1a1a1a', color: '#444', fontSize: '0.75rem', borderTop: '1px solid #333' }}>
        © 2026 KABAK OYUNU | Created by <span style={{ color: '#FFD700', fontWeight: 'bold' }}>ED</span>. Tüm Hakları Saklıdır.
      </div>
    </div>
  );
}

const btnStyle = { padding: '20px 30px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '15px', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer', boxShadow: '0 5px 0 #2E7D32' };
const choiceBtn = { padding: '15px 25px', backgroundColor: '#2c3e50', color: 'white', border: '1px solid #444', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };

export default App;