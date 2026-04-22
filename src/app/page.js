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
  
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(10);
  const [rir, setRir] = useState(2);

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
    const { data, error } = await supabase
      .from('routines')
      .select(`
        id, 
        name, 
        routine_exercises (id, name, sort_order, day_name, target_sets, target_reps, target_rir)
      `)
      .order('created_at', { ascending: false });

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleOpenCreate = () => {
    setEditingRoutineId(null);
    setNewRoutineName('');
    setRoutineDays([{ dayName: 'Día 1', exercises: [{ id: null, name: '', targetSets: '', targetReps: '', targetRir: '' }] }]);
    setView('creating');
  };

  const handleEditRoutine = (routine) => {
    setEditingRoutineId(routine.id);
    setNewRoutineName(routine.name);
    
    const daysMap = {};
    routine.routine_exercises.forEach(ex => {
      const day = ex.day_name || 'Día 1';
      if (!daysMap[day]) daysMap[day] = [];
      daysMap[day].push({
        id: ex.id, 
        name: ex.name,
        targetSets: ex.target_sets || '',
        targetReps: ex.target_reps || '',
        targetRir: ex.target_rir || ''
      });
    });

    const formattedDays = Object.keys(daysMap).map(dayName => ({
      dayName,
      exercises: daysMap[dayName]
    }));

    setRoutineDays(formattedDays.length > 0 ? formattedDays : [{ dayName: 'Día 1', exercises: [{ id: null, name: '', targetSets: '', targetReps: '', targetRir: '' }] }]);
    setView('creating');
  };

  const handleDeleteRoutine = async (id) => {
    if (!window.confirm("¿Seguro que quieres borrar esta rutina? Se perderá todo el historial de pesos de estos ejercicios.")) return;
    
    setLoading(true);
    const { error } = await supabase.from('routines').delete().eq('id', id);
    if (error) alert("Error al borrar: " + error.message);
    else fetchRoutines(); 
    setLoading(false);
  };

  const handleSaveRoutine = async () => {
    if (!newRoutineName.trim()) return alert("Ponle un nombre a la rutina.");
    
    let validationFailed = false;
    let hasValidExercises = false;

    for (const day of routineDays) {
      const validExercises = day.exercises.filter(ex => ex.name.trim() !== '');
      if (validExercises.length > 0) hasValidExercises = true;

      for (const ex of validExercises) {
        if (!ex.targetSets.trim() || !ex.targetReps.trim() || !ex.targetRir.trim()) {
          alert(`⚠️ Faltan datos en el ejercicio "${ex.name}" (${day.dayName}).\nLas Series, Repeticiones y RIR son obligatorios.`);
          validationFailed = true;
          break;
        }
      }
      if (validationFailed) break;
    }

    if (!hasValidExercises && !validationFailed) {
      return alert("Añade al menos un ejercicio válido.");
    }

    if (validationFailed) return;

    setLoading(true);
    let currentRoutineId = editingRoutineId;

    if (currentRoutineId) {
      const { error } = await supabase.from('routines').update({ name: newRoutineName }).eq('id', currentRoutineId);
      if (error) { alert("Error al actualizar rutina: " + error.message); setLoading(false); return; }
    } else {
      const { data, error } = await supabase.from('routines').insert([{ name: newRoutineName }]).select().single();
      if (error) { alert("Error al crear rutina: " + error.message); setLoading(false); return; }
      currentRoutineId = data.id;
    }

    const exercisesToInsert = [];
    const exercisesToUpdate = [];

    routineDays.forEach((day) => {
      const validExercises = day.exercises.filter(ex => ex.name.trim() !== '');
      validExercises.forEach((ex, index) => {
        const exerciseData = {
          routine_id: currentRoutineId,
          name: ex.name.trim(),
          day_name: day.dayName.trim() || 'Día 1',
          sort_order: index,
          target_sets: ex.targetSets.trim(),
          target_reps: ex.targetReps.trim(),
          target_rir: ex.targetRir.trim()
        };

        if (ex.id) exercisesToUpdate.push(exerciseData);
        else exercisesToInsert.push(exerciseData);
      });
    });

    if (exercisesToInsert.length > 0) {
      const { error } = await supabase.from('routine_exercises').insert(exercisesToInsert);
      if (error) { alert("Error al insertar nuevos: " + error.message); setLoading(false); return; }
    }

    if (exercisesToUpdate.length > 0) {
      const { error } = await supabase.from('routine_exercises').upsert(exercisesToUpdate);
      if (error) { alert("Error al actualizar existentes: " + error.message); setLoading(false); return; }
    }

    if (editingRoutineId) {
      const keptIds = exercisesToUpdate.map(e => e.id);
      if (keptIds.length > 0) {
        await supabase.from('routine_exercises').delete().eq('routine_id', currentRoutineId).not('id', 'in', `(${keptIds.join(',')})`);
      } else {
        await supabase.from('routine_exercises').delete().eq('routine_id', currentRoutineId);
      }
    }

    setView('dashboard');
    fetchRoutines();
    setLoading(false);
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-black"><div className="w-8 h-8 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin"></div></div>;

  if (!session) {
    return (
      <div className="flex flex-col min-h-screen bg-black px-6 justify-center">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-10">
            <h1 className="text-5xl font-black text-white tracking-tighter mb-2">Gym<span className="text-blue-500">PWA</span></h1>
            <p className="text-gray-400 font-medium text-lg">Entrar, anotar, salir.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 outline-none text-lg" required />
            <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 outline-none text-lg" required />
            <button type="submit" className="w-full bg-blue-600 text-white font-bold text-lg px-5 py-4 rounded-2xl mt-4 active:scale-95 transition-all">Iniciar Sesión</button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'creating') {
    return (
      <div className="flex flex-col h-screen bg-black px-6 pt-10 pb-6 animate-in fade-in duration-300">
        <header className="flex justify-between items-center mb-8 shrink-0">
          <button onClick={() => setView('dashboard')} className="text-gray-400 p-2 -ml-2 active:scale-90 text-lg">← Volver</button>
          <span className="text-white font-bold">{editingRoutineId ? 'Editar Rutina' : 'Nueva Rutina'}</span>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 overflow-y-auto pb-4 space-y-8 hide-scrollbar">
          <div>
            <label className="text-sm font-bold text-gray-500 ml-2 mb-2 block">NOMBRE DE LA RUTINA</label>
            <input type="text" placeholder="Ej. Torso / Pierna" value={newRoutineName} onChange={(e) => setNewRoutineName(e.target.value)} className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 focus:border-blue-500 outline-none text-xl font-bold"/>
          </div>

          <div className="space-y-6">
            {routineDays.map((day, dayIndex) => (
              <div key={dayIndex} className="bg-gray-900/50 p-4 rounded-3xl border border-gray-800">
                <input type="text" value={day.dayName} onChange={(e) => { const updated = [...routineDays]; updated[dayIndex].dayName = e.target.value; setRoutineDays(updated); }} className="bg-transparent text-blue-500 font-bold text-xl mb-4 w-full outline-none focus:border-b border-blue-500" placeholder="Ej. Día 1: Empuje"/>
                
                <div className="space-y-4">
                  {day.exercises.map((ex, exIndex) => (
                    <div key={exIndex} className="bg-black p-3 rounded-2xl border border-gray-800 space-y-3 relative group">
                      <input type="text" placeholder={`Ejercicio ${exIndex + 1}`} value={ex.name} onChange={(e) => { const updated = [...routineDays]; updated[dayIndex].exercises[exIndex].name = e.target.value; setRoutineDays(updated); }} className="w-full bg-transparent text-white px-2 py-1 outline-none text-lg font-bold border-b border-gray-800 focus:border-blue-500 pr-8"/>
                      
                      <button onClick={() => { const updated = [...routineDays]; updated[dayIndex].exercises.splice(exIndex, 1); setRoutineDays(updated); }} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 font-bold px-2">✕</button>

                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 ml-1">Series *</label>
                          <input type="text" placeholder="Ej. 3" value={ex.targetSets} onChange={(e) => { const updated = [...routineDays]; updated[dayIndex].exercises[exIndex].targetSets = e.target.value; setRoutineDays(updated); }} className="w-full bg-gray-900 text-white px-2 py-2 rounded-xl outline-none text-sm text-center border border-gray-800 focus:border-blue-500 transition-colors"/>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 ml-1">Reps *</label>
                          <input type="text" placeholder="Ej. 8-12" value={ex.targetReps} onChange={(e) => { const updated = [...routineDays]; updated[dayIndex].exercises[exIndex].targetReps = e.target.value; setRoutineDays(updated); }} className="w-full bg-gray-900 text-white px-2 py-2 rounded-xl outline-none text-sm text-center border border-gray-800 focus:border-blue-500 transition-colors"/>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 ml-1">RIR *</label>
                          <input type="text" placeholder="Ej. 1-2" value={ex.targetRir} onChange={(e) => { const updated = [...routineDays]; updated[dayIndex].exercises[exIndex].targetRir = e.target.value; setRoutineDays(updated); }} className="w-full bg-gray-900 text-white px-2 py-2 rounded-xl outline-none text-sm text-center border border-gray-800 focus:border-blue-500 transition-colors"/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button onClick={() => { const updated = [...routineDays]; updated[dayIndex].exercises.push({ id: null, name: '', targetSets: '', targetReps: '', targetRir: '' }); setRoutineDays(updated); }} className="w-full mt-4 py-3 rounded-2xl border-2 border-dashed border-gray-700 text-gray-400 font-bold active:bg-gray-800 text-sm">
                  + Añadir ejercicio
                </button>
              </div>
            ))}
          </div>

          <button onClick={() => setRoutineDays([...routineDays, { dayName: `Día ${routineDays.length + 1}`, exercises: [{ id: null, name: '', targetSets: '', targetReps: '', targetRir: '' }] }])} className="w-full py-4 rounded-2xl bg-gray-800 text-white font-bold active:bg-gray-700 transition-colors">
            + Añadir Nuevo Día
          </button>
        </div>

        <button onClick={handleSaveRoutine} className="w-full bg-blue-600 text-white font-bold text-xl px-5 py-5 rounded-3xl active:scale-95 transition-transform mt-4 shrink-0">
          {editingRoutineId ? 'Guardar Cambios' : 'Guardar Rutina'}
        </button>
      </div>
    );
  }

  if (view === 'training') {
    return (
      <div className="flex flex-col h-screen bg-black px-6 pt-10 pb-6 animate-in fade-in duration-300">
        <header className="flex justify-between items-center mb-8 shrink-0">
          <button onClick={() => setView('dashboard')} className="text-gray-400 p-2 -ml-2 active:scale-90 text-lg">← Salir</button>
          <span className="text-white font-bold bg-gray-900 px-4 py-1 rounded-full text-xs uppercase border border-gray-800">Entrenando</span>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <h2 className="text-4xl font-black text-white mb-1 tracking-tight">Press Banca</h2>
          <p className="text-blue-500 font-bold mb-1">SERIE 1 DE 3</p>
          <p className="text-gray-500 text-sm mb-8">Objetivo: 10-12 Reps • RIR 2</p>

          <div className="space-y-6">
            <Stepper label="PESO" value={weight} onChange={setWeight} step={2.5} unit="kg" />
            <Stepper label="REPS" value={reps} onChange={setReps} step={1} min={0} />
            <Stepper label="RIR" value={rir} onChange={setRir} step={1} min={0} max={10} />
          </div>
        </div>

        <button onClick={() => alert("Aquí guardaremos en Supabase")} className="w-full bg-green-600 text-white font-bold text-xl px-5 py-5 rounded-3xl active:scale-95 mt-auto mb-4 shrink-0">
          ✓ GUARDAR SERIE
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black px-6 pt-10 pb-6 animate-in fade-in duration-300">
      <header className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Mis Rutinas</h1>
          <p className="text-sm font-medium text-gray-500 mt-1 truncate max-w-[200px]">{session.user.email}</p>
        </div>
        <button onClick={handleLogout} className="bg-gray-900 text-gray-400 px-4 py-2 rounded-xl text-xs font-bold border border-gray-800 active:scale-95">SALIR</button>
      </header>

      <div className="flex-1 overflow-y-auto space-y-6 hide-scrollbar">
        {routines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center pb-20">
            <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center mb-6 border border-gray-800"><span className="text-4xl">💪</span></div>
            <h3 className="text-white font-bold text-xl">Sin rutinas</h3>
            <p className="text-gray-500 text-sm mt-2 px-10">Crea tu primera rutina para empezar a entrenar.</p>
          </div>
        ) : (
          routines.map((routine) => {
            const daysMap = routine.routine_exercises.reduce((acc, ex) => {
              const day = ex.day_name || 'Día 1';
              if (!acc[day]) acc[day] = [];
              acc[day].push(ex);
              return acc;
            }, {});

            return (
              <div key={routine.id} className="bg-gray-900 p-5 rounded-3xl border border-gray-800">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl font-black text-white">{routine.name}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditRoutine(routine)} className="text-gray-400 bg-gray-800 p-2 rounded-lg text-xs font-bold active:scale-90">✏️</button>
                    <button onClick={() => handleDeleteRoutine(routine.id)} className="text-gray-400 bg-gray-800 p-2 rounded-lg text-xs font-bold active:scale-90">🗑️</button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {Object.entries(daysMap).map(([dayName, exercises]) => (
                    <div key={dayName} className="bg-black p-4 rounded-2xl border border-gray-800 flex flex-col">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-blue-500 font-bold text-lg">{dayName}</span>
                      </div>
                      <div className="space-y-2 mb-4">
                        {exercises.map((ex, i) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span className="text-gray-300 font-medium">{ex.name}</span>
                            {(ex.target_sets || ex.target_reps || ex.target_rir) && (
                              <span className="text-gray-500 text-xs text-right ml-2 whitespace-nowrap">
                                {ex.target_sets && <span className="text-gray-400 font-bold">{ex.target_sets}s </span>}
                                {ex.target_reps && `${ex.target_reps}r `}
                                {ex.target_rir && `RIR ${ex.target_rir}`}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setView('training')} className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl active:bg-gray-700 transition-colors">
                        Empezar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
      
      <button onClick={handleOpenCreate} className="w-full bg-blue-600 text-white font-bold text-lg px-5 py-5 rounded-3xl active:scale-95 transition-transform mt-4 shrink-0">
        + NUEVA RUTINA
      </button>
    </div>
  );
}