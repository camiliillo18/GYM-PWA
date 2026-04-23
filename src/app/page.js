"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Stepper from '../components/Stepper';

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [routines, setRoutines] = useState([]);
  const [view, setView] = useState('dashboard'); 
  
  const [editingRoutineId, setEditingRoutineId] = useState(null); 
  const [newRoutineName, setNewRoutineName] = useState('');
  const [routineDays, setRoutineDays] = useState([{ 
    dayName: 'Día 1', 
    exercises: [{ id: null, name: '', targetSets: '', targetReps: '', targetRir: '' }] 
  }]);
  
  const [activeExercises, setActiveExercises] = useState([]);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [sessionLogs, setSessionLogs] = useState([]); 
  const [editingLogId, setEditingLogId] = useState(null); 
  
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(10);
  const [rir, setRir] = useState(2);

  const [historyData, setHistoryData] = useState([]);
  const [editingHistLog, setEditingHistLog] = useState(null); 
  const [copied, setCopied] = useState(false);
  const [expandedDates, setExpandedDates] = useState({}); 
  const [selectedDates, setSelectedDates] = useState({}); 

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchRoutines();
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchRoutines();
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchRoutines = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('routines').select(`id, name, routine_exercises (id, name, sort_order, day_name, target_sets, target_reps, target_rir)`).order('created_at', { ascending: false });
    if (!error && data) setRoutines(data);
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Error: " + error.message);
    setLoading(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const handleOpenHistory = async () => {
    setLoading(true);
    setEditingHistLog(null);
    const { data, error } = await supabase
      .from('workout_logs')
      .select(`id, weight, reps, rir, set_number, created_at, routine_exercises (name)`)
      .order('created_at', { ascending: false })
      .limit(300);

    if (!error && data) {
      const grouped = data.reduce((acc, log) => {
        const dateStr = new Date(log.created_at).toLocaleDateString();
        if (!acc[dateStr]) acc[dateStr] = {};
        const exName = log.routine_exercises?.name || 'Ejercicio borrado';
        if (!acc[dateStr][exName]) acc[dateStr][exName] = [];
        acc[dateStr][exName].push(log);
        return acc;
      }, {});

      const historyArray = Object.keys(grouped).map(date => ({
        date,
        exercises: Object.keys(grouped[date]).map(name => ({
          name,
          logs: grouped[date][name].sort((a, b) => a.set_number - b.set_number)
        }))
      }));

      setHistoryData(historyArray);

      const initialExpanded = {};
      const initialSelected = {};
      historyArray.forEach((d, idx) => {
        initialExpanded[d.date] = idx === 0; 
        initialSelected[d.date] = false;
      });
      setExpandedDates(initialExpanded);
      setSelectedDates(initialSelected);
    }
    setView('history');
    setLoading(false);
  };

  const handleCopyHistory = async () => {
    const datesToCopy = Object.keys(selectedDates).filter(date => selectedDates[date]);
    
    if (datesToCopy.length === 0) {
      return alert("Marca la casilla de al menos un día para copiar sus datos.");
    }

    let textContent = "";
    
    historyData.forEach(day => {
      if (selectedDates[day.date]) {
        textContent += `=== ${day.date} ===\n\n`;
        day.exercises.forEach(ex => {
          textContent += `${ex.name}\n`;
          ex.logs.forEach(log => {
            textContent += `- Serie ${log.set_number}: ${log.weight}kg x ${log.reps} reps RIR ${log.rir}\n`;
          });
          textContent += `\n`;
        });
      }
    });

    try {
      await navigator.clipboard.writeText(textContent.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("Tu navegador no permite copiar automáticamente.");
    }
  };

  const saveHistoryLog = async () => {
    setLoading(true);
    await supabase.from('workout_logs').update({
      weight: editingHistLog.weight,
      reps: editingHistLog.reps,
      rir: editingHistLog.rir
    }).eq('id', editingHistLog.id);
    setEditingHistLog(null);
    await handleOpenHistory();
  };

  const deleteHistoryLog = async (id) => {
    if(!window.confirm("¿Borrar esta serie definitivamente?")) return;
    setLoading(true);
    await supabase.from('workout_logs').delete().eq('id', id);
    setEditingHistLog(null);
    await handleOpenHistory(); 
  };

  const handleOpenCreate = () => {
    setEditingRoutineId(null); setNewRoutineName('');
    setRoutineDays([{ dayName: 'Día 1', exercises: [{ id: null, name: '', targetSets: '', targetReps: '', targetRir: '' }] }]);
    setView('creating');
  };

  const handleEditRoutine = (routine) => {
    setEditingRoutineId(routine.id); setNewRoutineName(routine.name);
    const daysMap = {};
    routine.routine_exercises.forEach(ex => {
      const day = ex.day_name || 'Día 1';
      if (!daysMap[day]) daysMap[day] = [];
      daysMap[day].push({ id: ex.id, name: ex.name, targetSets: ex.target_sets || '', targetReps: ex.target_reps || '', targetRir: ex.target_rir || '' });
    });
    const formattedDays = Object.keys(daysMap).map(dayName => ({ dayName, exercises: daysMap[dayName] }));
    setRoutineDays(formattedDays.length > 0 ? formattedDays : [{ dayName: 'Día 1', exercises: [{ id: null, name: '', targetSets: '', targetReps: '', targetRir: '' }] }]);
    setView('creating');
  };

  const handleDeleteRoutine = async (id) => {
    if (!window.confirm("¿Borrar rutina?")) return;
    setLoading(true);
    await supabase.from('routines').delete().eq('id', id);
    fetchRoutines();
    setLoading(false);
  };

  const handleSaveRoutine = async () => {
    if (!newRoutineName.trim()) return alert("Ponle nombre.");
    let validationFailed = false; let hasValidExercises = false;
    for (const day of routineDays) {
      const validExs = day.exercises.filter(ex => ex.name.trim() !== '');
      if (validExs.length > 0) hasValidExercises = true;
      for (const ex of validExs) {
        if (!ex.targetSets.trim() || !ex.targetReps.trim() || !ex.targetRir.trim()) {
          alert(`Faltan datos en "${ex.name}"`); validationFailed = true; break;
        }
      }
      if (validationFailed) break;
    }
    if (!hasValidExercises || validationFailed) return;
    setLoading(true);
    let currentId = editingRoutineId;
    if (currentId) await supabase.from('routines').update({ name: newRoutineName }).eq('id', currentId);
    else {
      const { data } = await supabase.from('routines').insert([{ name: newRoutineName }]).select().single();
      currentId = data.id;
    }
    const toInsert = []; const toUpdate = [];
    routineDays.forEach((day) => {
      day.exercises.filter(ex => ex.name.trim() !== '').forEach((ex, index) => {
        const d = { routine_id: currentId, name: ex.name.trim(), day_name: day.dayName.trim(), sort_order: index, target_sets: ex.targetSets, target_reps: ex.targetReps, target_rir: ex.targetRir };
        if (ex.id) { d.id = ex.id; toUpdate.push(d); } else toInsert.push(d);
      });
    });
    if (toInsert.length > 0) await supabase.from('routine_exercises').insert(toInsert);
    if (toUpdate.length > 0) await supabase.from('routine_exercises').upsert(toUpdate);
    if (editingRoutineId) {
      const kept = toUpdate.map(e => e.id);
      if (kept.length > 0) await supabase.from('routine_exercises').delete().eq('routine_id', currentId).not('id', 'in', `(${kept.join(',')})`);
      else await supabase.from('routine_exercises').delete().eq('routine_id', currentId);
    }
    setView('dashboard'); fetchRoutines(); setLoading(false);
  };

  const loadDefaultsForExercise = async (exId, currentSessionLogsParam) => {
    const logsThisSession = currentSessionLogsParam.filter(l => l.routine_exercise_id === exId);
    if (logsThisSession.length > 0) {
      const lastLog = logsThisSession[logsThisSession.length - 1];
      setWeight(lastLog.weight); setReps(lastLog.reps); setRir(lastLog.rir);
    } else {
      const { data } = await supabase.from('workout_logs').select('weight, reps, rir').eq('routine_exercise_id', exId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) { setWeight(data.weight); setReps(data.reps); setRir(data.rir); } 
      else { setWeight(20); setReps(10); setRir(2); }
    }
  };

  const handleStartTraining = async (exercises) => {
    setLoading(true);
    const sorted = [...exercises].sort((a, b) => a.sort_order - b.sort_order);
    setActiveExercises(sorted);
    setCurrentExIndex(0);
    setCurrentSet(1);
    setSessionLogs([]); 
    setEditingLogId(null);
    await loadDefaultsForExercise(sorted[0].id, []);
    setView('training');
    setLoading(false);
  };

  const handleSaveSet = async () => {
    const activeEx = activeExercises[currentExIndex];
    setLoading(true);

    if (editingLogId) {
      const { error } = await supabase.from('workout_logs').update({ weight, reps, rir }).eq('id', editingLogId);
      if (!error) {
        const updatedLogs = sessionLogs.map(log => log.id === editingLogId ? { ...log, weight, reps, rir } : log);
        setSessionLogs(updatedLogs);
        
        const currentExLogs = updatedLogs.filter(l => l.routine_exercise_id === activeEx.id);
        const maxTargetSets = parseInt((activeEx.target_sets || "1").split('-').pop());

        if (currentExLogs.length >= maxTargetSets) {
          const lastLog = currentExLogs[currentExLogs.length - 1];
          handleLoadLogForEdit(lastLog);
        } else {
          setEditingLogId(null);
          setCurrentSet(currentExLogs.length + 1);
        }
      }
    } else {
      const { data, error } = await supabase.from('workout_logs').insert([{
        routine_exercise_id: activeEx.id,
        set_number: currentSet,
        weight, reps, rir
      }]).select().single();

      if (!error) {
        const updatedLogs = [...sessionLogs, data];
        setSessionLogs(updatedLogs);
        
        const maxTargetSets = parseInt((activeEx.target_sets || "1").split('-').pop());

        if (currentSet >= maxTargetSets) {
          handleNextExercise(updatedLogs);
        } else {
          setCurrentSet(prev => prev + 1);
        }
      }
    }
    setLoading(false);
  };

  const handleLoadLogForEdit = (log) => {
    setEditingLogId(log.id);
    setWeight(log.weight);
    setReps(log.reps);
    setRir(log.rir);
    setCurrentSet(log.set_number);
  };

  const handleNextExercise = async (currentLogs = sessionLogs) => {
    if (currentExIndex < activeExercises.length - 1) {
      setLoading(true);
      const nextIndex = currentExIndex + 1;
      const nextEx = activeExercises[nextIndex];
      setCurrentExIndex(nextIndex);
      
      const logsForNextEx = currentLogs.filter(l => l.routine_exercise_id === nextEx.id);
      const maxTargetSets = parseInt((nextEx.target_sets || "1").split('-').pop());

      if (logsForNextEx.length >= maxTargetSets && logsForNextEx.length > 0) {
        const lastLog = logsForNextEx[logsForNextEx.length - 1];
        handleLoadLogForEdit(lastLog);
      } else {
        setCurrentSet(logsForNextEx.length + 1);
        setEditingLogId(null);
        await loadDefaultsForExercise(nextEx.id, currentLogs);
      }
      setLoading(false);
    } else {
      alert("¡Entrenamiento finalizado! 🏆");
      setView('dashboard');
    }
  };

  const handlePrevExercise = async () => {
    if (currentExIndex > 0) {
      setLoading(true);
      const prevIndex = currentExIndex - 1;
      const prevEx = activeExercises[prevIndex];
      setCurrentExIndex(prevIndex);
      
      const logsForPrevEx = sessionLogs.filter(l => l.routine_exercise_id === prevEx.id);
      const maxTargetSets = parseInt((prevEx.target_sets || "1").split('-').pop());

      if (logsForPrevEx.length >= maxTargetSets && logsForPrevEx.length > 0) {
        const lastLog = logsForPrevEx[logsForPrevEx.length - 1];
        handleLoadLogForEdit(lastLog);
      } else {
        setCurrentSet(logsForPrevEx.length + 1);
        setEditingLogId(null);
        await loadDefaultsForExercise(prevEx.id, sessionLogs);
      }
      setLoading(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-black"><div className="w-8 h-8 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin"></div></div>;

  if (!session) {
    return (
      <div className="flex flex-col min-h-screen bg-black px-6 justify-center">
        <div className="w-full max-w-sm mx-auto">
          <h1 className="text-5xl font-black text-white tracking-tighter mb-10">Gym<span className="text-blue-500">PWA</span></h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 outline-none" required />
            <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 outline-none" required />
            <button type="submit" className="w-full bg-blue-600 text-white font-bold text-lg px-5 py-4 rounded-2xl mt-4">Iniciar Sesión</button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'history') {
    const selectedCount = Object.values(selectedDates).filter(Boolean).length;

    return (
      <div className="flex flex-col h-screen bg-black px-6 pt-10 pb-6 animate-in fade-in">
        <header className="flex justify-between items-center mb-8 shrink-0">
          <button onClick={() => setView('dashboard')} className="text-gray-400 p-2 -ml-2 text-lg">← Volver</button>
          <span className="text-white font-bold">Historial</span>
          <button 
            onClick={handleCopyHistory} 
            className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${copied ? 'bg-green-600 text-white' : 'bg-gray-800 text-blue-400 active:scale-95'}`}
          >
            {copied ? '✅ Copiado' : `📋 Copiar (${selectedCount})`}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto space-y-4 hide-scrollbar pb-10">
          {historyData.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">Aún no hay entrenamientos registrados.</div>
          ) : (
            historyData.map((dayData, idx) => (
              <div key={idx} className="bg-gray-900 p-5 rounded-3xl border border-gray-800 transition-all">
                
                {/* ZONAS TÁCTILES SEPARADAS */}
                <div className="flex justify-between items-center select-none">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-2 -ml-2">
                      <input 
                        type="checkbox" 
                        checked={!!selectedDates[dayData.date]}
                        onChange={(e) => setSelectedDates(prev => ({...prev, [dayData.date]: e.target.checked}))}
                        className="w-6 h-6 accent-blue-500 cursor-pointer"
                      />
                    </div>
                    <h3 
                      className="text-xl font-black text-blue-500 cursor-pointer py-2 flex-1"
                      onClick={() => setExpandedDates(prev => ({...prev, [dayData.date]: !prev[dayData.date]}))}
                    >
                      {dayData.date}
                    </h3>
                  </div>
                  <div 
                    className="text-gray-500 font-bold text-3xl cursor-pointer p-2 -mr-2"
                    onClick={() => setExpandedDates(prev => ({...prev, [dayData.date]: !prev[dayData.date]}))}
                  >
                    {expandedDates[dayData.date] ? '−' : '+'}
                  </div>
                </div>

                {/* CONTENIDO DESPLEGABLE */}
                {expandedDates[dayData.date] && (
                  <div className="space-y-6 mt-6 animate-in fade-in slide-in-from-top-2">
                    {dayData.exercises.map((ex, eIdx) => (
                      <div key={eIdx}>
                        <h4 className="text-white font-bold mb-2">{ex.name}</h4>
                        <div className="space-y-2">
                          {ex.logs.map(log => (
                            <div key={log.id} className={`flex flex-col text-sm p-3 rounded-xl border transition-all ${editingHistLog?.id === log.id ? 'bg-black border-blue-500' : 'bg-black border-gray-800'}`}>
                              
                              {editingHistLog?.id === log.id ? (
                                <div className="flex flex-col gap-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-400 font-bold">Serie {log.set_number}</span>
                                    <button onClick={() => deleteHistoryLog(log.id)} className="bg-red-900/30 text-red-500 px-3 py-1 rounded-lg font-bold">🗑️ Borrar</button>
                                  </div>
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <label className="text-xs text-gray-500">Peso (kg)</label>
                                      <input type="number" step="0.5" value={editingHistLog.weight} onChange={(e) => setEditingHistLog({...editingHistLog, weight: e.target.value})} className="w-full bg-gray-900 text-white px-2 py-2 rounded-lg text-center"/>
                                    </div>
                                    <div className="flex-1">
                                      <label className="text-xs text-gray-500">Reps</label>
                                      <input type="number" value={editingHistLog.reps} onChange={(e) => setEditingHistLog({...editingHistLog, reps: e.target.value})} className="w-full bg-gray-900 text-white px-2 py-2 rounded-lg text-center"/>
                                    </div>
                                    <div className="flex-1">
                                      <label className="text-xs text-gray-500">RIR</label>
                                      <input type="number" value={editingHistLog.rir} onChange={(e) => setEditingHistLog({...editingHistLog, rir: e.target.value})} className="w-full bg-gray-900 text-white px-2 py-2 rounded-lg text-center"/>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-1">
                                    <button onClick={() => setEditingHistLog(null)} className="flex-1 bg-gray-800 text-white py-2 rounded-lg font-bold">Cancelar</button>
                                    <button onClick={saveHistoryLog} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold">Guardar</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-400 font-bold">Serie {log.set_number}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-white">{log.weight}kg <span className="text-gray-500 mx-1">|</span> {log.reps} reps <span className="text-gray-500 mx-1">|</span> RIR {log.rir}</span>
                                    <button onClick={() => setEditingHistLog({ id: log.id, weight: log.weight, reps: log.reps, rir: log.rir })} className="text-gray-500 active:scale-90 p-1">✏️</button>
                                  </div>
                                </div>
                              )}

                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === 'creating') {
    return (
      <div className="flex flex-col h-screen bg-black px-6 pt-10 pb-6 animate-in fade-in">
        <header className="flex justify-between items-center mb-8">
          <button onClick={() => setView('dashboard')} className="text-gray-400 p-2 -ml-2 text-lg">← Volver</button>
          <span className="text-white font-bold">{editingRoutineId ? 'Editar' : 'Nueva'}</span>
          <div className="w-10"></div>
        </header>
        <div className="flex-1 overflow-y-auto space-y-8 hide-scrollbar">
          <input type="text" placeholder="Nombre de la rutina" value={newRoutineName} onChange={(e) => setNewRoutineName(e.target.value)} className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 outline-none text-xl font-bold"/>
          <div className="space-y-6">
            {routineDays.map((day, dIdx) => (
              <div key={dIdx} className="bg-gray-900/50 p-4 rounded-3xl border border-gray-800">
                <input type="text" value={day.dayName} onChange={(e) => { const u = [...routineDays]; u[dIdx].dayName = e.target.value; setRoutineDays(u); }} className="bg-transparent text-blue-500 font-bold text-xl mb-4 w-full outline-none" placeholder="Día..."/>
                <div className="space-y-4">
                  {day.exercises.map((ex, eIdx) => (
                    <div key={eIdx} className="bg-black p-3 rounded-2xl border border-gray-800 space-y-3 relative group">
                      <input type="text" placeholder="Ejercicio" value={ex.name} onChange={(e) => { const u = [...routineDays]; u[dIdx].exercises[eIdx].name = e.target.value; setRoutineDays(u); }} className="w-full bg-transparent text-white px-2 py-1 outline-none text-lg font-bold border-b border-gray-800 pr-8"/>
                      <button onClick={() => { const u = [...routineDays]; u[dIdx].exercises.splice(eIdx, 1); setRoutineDays(u); }} className="absolute top-2 right-2 text-gray-600">✕</button>
                      <div className="flex gap-2">
                        {['Sets', 'Reps', 'Rir'].map(f => (
                          <div key={f} className="flex-1">
                            <label className="text-xs text-gray-500 ml-1">{f} *</label>
                            <input type="text" value={ex[`target${f}`]} onChange={(e) => { const u = [...routineDays]; u[dIdx].exercises[eIdx][`target${f}`] = e.target.value; setRoutineDays(u); }} className="w-full bg-gray-900 text-white px-2 py-2 rounded-xl outline-none text-sm text-center border border-gray-800 focus:border-blue-500"/>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => { const u = [...routineDays]; u[dIdx].exercises.push({ id: null, name: '', targetSets: '', targetReps: '', targetRir: '' }); setRoutineDays(u); }} className="w-full mt-4 py-3 rounded-2xl border-2 border-dashed border-gray-700 text-gray-400 font-bold text-sm">+ Ejercicio</button>
              </div>
            ))}
          </div>
          <button onClick={() => setRoutineDays([...routineDays, { dayName: `Día ${routineDays.length + 1}`, exercises: [{ id: null, name: '', targetSets: '', targetReps: '', targetRir: '' }] }])} className="w-full py-4 rounded-2xl bg-gray-800 text-white font-bold">+ Nuevo Día</button>
        </div>
        <button onClick={handleSaveRoutine} className="w-full bg-blue-600 text-white font-bold text-xl px-5 py-5 rounded-3xl mt-4">Guardar</button>
      </div>
    );
  }

  if (view === 'training') {
    const activeEx = activeExercises[currentExIndex];
    const isLastEx = currentExIndex === activeExercises.length - 1;
    const currentExLogs = sessionLogs.filter(log => log.routine_exercise_id === activeEx.id);

    return (
      <div className="flex flex-col h-screen bg-black px-6 pt-10 pb-6 animate-in fade-in">
        <header className="flex justify-between items-center mb-8 shrink-0">
          <button onClick={() => setView('dashboard')} className="text-gray-400 p-2 -ml-2 text-lg">← Salir</button>
          <span className="text-white font-bold bg-gray-900 px-4 py-1 rounded-full text-xs border border-gray-800">EJERCICIO {currentExIndex + 1}/{activeExercises.length}</span>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
          <h2 className="text-4xl font-black text-white mb-1 tracking-tight">{activeEx.name}</h2>
          <p className="text-blue-500 font-bold mb-1 uppercase tracking-wider">
            {editingLogId ? `EDITANDO SERIE ${currentSet}` : `SERIE ${currentSet}`}
          </p>
          <p className="text-gray-500 text-sm mb-8">Objetivo: {activeEx.target_sets}s • {activeEx.target_reps}r • RIR {activeEx.target_rir}</p>

          <div className="space-y-6 mb-10">
            <Stepper label="PESO" value={weight} onChange={setWeight} step={2.5} unit="kg" />
            <Stepper label="REPS" value={reps} onChange={setReps} step={1} min={0} />
            <Stepper label="RIR" value={rir} onChange={setRir} step={1} min={0} max={10} />
          </div>

          {currentExLogs.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest ml-1">Series guardadas (toca para editar)</p>
              {currentExLogs.map((log) => (
                <div 
                  key={log.id} 
                  onClick={() => handleLoadLogForEdit(log)}
                  className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${editingLogId === log.id ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-900 border-gray-800 active:scale-95'}`}
                >
                  <span className="text-white font-bold text-lg">S{log.set_number}</span>
                  <div className="text-right">
                    <span className="text-white font-black text-xl">{log.weight}kg</span>
                    <span className="text-gray-500 text-sm ml-2">{log.reps} reps • RIR {log.rir}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto space-y-3 shrink-0 pt-4">
          <button onClick={handleSaveSet} className={`w-full font-bold text-xl px-5 py-5 rounded-3xl active:scale-95 transition-all ${editingLogId ? 'bg-orange-600 text-white shadow-[0_0_20px_rgba(234,88,12,0.3)]' : 'bg-green-600 text-white shadow-[0_0_20px_rgba(22,163,74,0.3)]'}`}>
            {editingLogId ? '✓ ACTUALIZAR SERIE' : '✓ GUARDAR SERIE'}
          </button>
          
          <div className="flex gap-3">
            {currentExIndex > 0 && (
              <button onClick={handlePrevExercise} className="flex-1 bg-gray-900 text-gray-300 font-bold text-lg py-4 rounded-3xl border border-gray-800 active:scale-95 transition-transform">
                ← Anterior
              </button>
            )}
            <button onClick={() => handleNextExercise(sessionLogs)} className={`bg-gray-900 text-gray-300 font-bold text-lg py-4 rounded-3xl border border-gray-800 active:scale-95 transition-transform ${currentExIndex > 0 ? 'flex-1' : 'w-full'}`}>
              {isLastEx ? 'Finalizar 🏆' : 'Siguiente ➔'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black px-6 pt-10 pb-6 animate-in fade-in">
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">GymPWA</h1>
          <p className="text-sm font-medium text-gray-500 mt-1 truncate max-w-[200px]">{session.user.email}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={handleOpenHistory} className="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold border border-gray-800 active:scale-95">📋 HISTORIAL</button>
          <button onClick={handleLogout} className="bg-transparent text-gray-600 px-4 py-1 rounded-xl text-xs font-bold active:scale-95 text-right">SALIR</button>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto space-y-6 hide-scrollbar">
        {routines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h3 className="text-white font-bold text-xl">Sin rutinas</h3>
          </div>
        ) : (
          routines.map((routine) => {
            const daysMap = routine.routine_exercises.reduce((acc, ex) => {
              const day = ex.day_name || 'Día 1';
              if (!acc[day]) acc[day] = []; acc[day].push(ex); return acc;
            }, {});
            return (
              <div key={routine.id} className="bg-gray-900 p-5 rounded-3xl border border-gray-800">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl font-black text-white">{routine.name}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditRoutine(routine)} className="bg-gray-800 p-2 rounded-lg">✏️</button>
                    <button onClick={() => handleDeleteRoutine(routine.id)} className="bg-gray-800 p-2 rounded-lg">🗑️</button>
                  </div>
                </div>
                <div className="space-y-3">
                  {Object.entries(daysMap).map(([dayName, exercises]) => (
                    <div key={dayName} className="bg-black p-4 rounded-2xl border border-gray-800 flex flex-col">
                      <span className="text-blue-500 font-bold mb-3">{dayName}</span>
                      <div className="space-y-1 mb-4 text-sm text-gray-400">
                        {exercises.map((ex, i) => <div key={i}>{ex.name} ({ex.target_sets}s x {ex.target_reps}r)</div>)}
                      </div>
                      <button onClick={() => handleStartTraining(exercises)} className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl active:bg-gray-700">Empezar {dayName}</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
      <button onClick={handleOpenCreate} className="w-full bg-blue-600 text-white font-bold text-lg px-5 py-5 rounded-3xl mt-4">+ NUEVA RUTINA</button>
    </div>
  );
}