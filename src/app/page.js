"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Stepper from '../components/Stepper';

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE DATOS ---
  const [routines, setRoutines] = useState([]);
  
  // --- ESTADOS DE NAVEGACIÓN ---
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'creating' | 'training'
  
  // --- ESTADOS PARA CREAR RUTINA ---
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newExercises, setNewExercises] = useState(['']); 
  
  // --- ESTADOS DE ENTRENAMIENTO (MOCKUP) ---
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(10);
  const [rir, setRir] = useState(2);

  // 1. INICIALIZAR SESIÓN Y CARGAR RUTINAS
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

  // 2. FUNCIÓN PARA TRAER LAS RUTINAS DE SUPABASE
  const fetchRoutines = async () => {
    setLoading(true);
    // Traemos las rutinas y sus ejercicios anidados gracias a la magia de Supabase
    const { data, error } = await supabase
      .from('routines')
      .select(`
        id, 
        name, 
        routine_exercises (id, name, sort_order)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) setRoutines(data);
    setLoading(false);
  };

  // 3. FUNCIONES DE LOGIN / LOGOUT
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

  // 4. GUARDAR NUEVA RUTINA EN LA BASE DE DATOS
  const handleSaveRoutine = async () => {
    if (!newRoutineName.trim()) return alert("Ponle un nombre a la rutina.");
    
    // Limpiamos los inputs vacíos
    const validExercises = newExercises.filter(ex => ex.trim() !== '');
    if (validExercises.length === 0) return alert("Añade al menos un ejercicio.");

    setLoading(true);

    // A. Crear la rutina
    const { data: routineData, error: routineError } = await supabase
      .from('routines')
      .insert([{ name: newRoutineName }])
      .select()
      .single();

    if (routineError) {
      alert("Error al crear rutina: " + routineError.message);
      setLoading(false);
      return;
    }

    // B. Crear los ejercicios vinculados a esa rutina
    const exercisesToInsert = validExercises.map((name, index) => ({
      routine_id: routineData.id,
      name: name,
      sort_order: index
    }));

    const { error: exercisesError } = await supabase
      .from('routine_exercises')
      .insert(exercisesToInsert);

    if (exercisesError) {
      alert("Error al guardar ejercicios: " + exercisesError.message);
    } else {
      // Éxito: Limpiamos formulario, volvemos al inicio y recargamos
      setNewRoutineName('');
      setNewExercises(['']);
      setView('dashboard');
      fetchRoutines();
    }
    setLoading(false);
  };

  // --------------------------------------------------------
  // RENDERIZADO DE VISTAS
  // --------------------------------------------------------

  if (loading) return <div className="flex h-screen items-center justify-center bg-black"><div className="w-8 h-8 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin"></div></div>;

  // --- VISTA 1: LOGIN ---
  if (!session) {
    return (
      <div className="flex flex-col min-h-screen bg-black px-6 justify-center">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-10">
            <h1 className="text-5xl font-black text-white tracking-tighter mb-2">Gym<span className="text-blue-500">PWA</span></h1>
            <p className="text-gray-400 font-medium text-lg">Entrar, anotar, salir.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 focus:border-blue-500 outline-none text-lg" required />
            <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 focus:border-blue-500 outline-none text-lg" required />
            <button type="submit" className="w-full bg-blue-600 text-white font-bold text-lg px-5 py-4 rounded-2xl mt-4 active:scale-95 transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]">Iniciar Sesión</button>
          </form>
        </div>
      </div>
    );
  }

  // --- VISTA 2: CREAR RUTINA ---
  if (view === 'creating') {
    return (
      <div className="flex flex-col h-screen bg-black px-6 pt-10 pb-6 animate-in fade-in duration-300">
        <header className="flex justify-between items-center mb-8">
          <button onClick={() => setView('dashboard')} className="text-gray-400 p-2 -ml-2 active:scale-90 text-lg">← Volver</button>
          <span className="text-white font-bold">Nueva Rutina</span>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 overflow-y-auto pb-4 space-y-6">
          <div>
            <label className="text-sm font-bold text-gray-500 ml-2 mb-2 block">NOMBRE DE LA RUTINA</label>
            <input 
              type="text" 
              placeholder="Ej. Pecho y Tríceps" 
              value={newRoutineName}
              onChange={(e) => setNewRoutineName(e.target.value)}
              className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 focus:border-blue-500 outline-none text-xl font-bold"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-gray-500 ml-2 mb-2 block">EJERCICIOS</label>
            <div className="space-y-3">
              {newExercises.map((ex, index) => (
                <input 
                  key={index}
                  type="text" 
                  placeholder={`Ejercicio ${index + 1}`}
                  value={ex}
                  onChange={(e) => {
                    const updated = [...newExercises];
                    updated[index] = e.target.value;
                    setNewExercises(updated);
                  }}
                  className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 focus:border-blue-500 outline-none text-lg"
                />
              ))}
            </div>
            <button 
              onClick={() => setNewExercises([...newExercises, ''])}
              className="w-full mt-4 py-4 rounded-2xl border-2 border-dashed border-gray-800 text-gray-400 font-bold active:bg-gray-900 transition-colors"
            >
              + Añadir otro ejercicio
            </button>
          </div>
        </div>

        <button 
          onClick={handleSaveRoutine}
          className="w-full bg-blue-600 text-white font-bold text-xl px-5 py-5 rounded-3xl active:scale-95 transition-transform mt-4"
        >
          Guardar Rutina
        </button>
      </div>
    );
  }

  // --- VISTA 3: MODO ENTRENAMIENTO (MOCKUP ACTUALIZADO CON RIR) ---
  if (view === 'training') {
    return (
      <div className="flex flex-col h-screen bg-black px-6 pt-10 pb-6 animate-in fade-in duration-300">
        <header className="flex justify-between items-center mb-8">
          <button onClick={() => setView('dashboard')} className="text-gray-400 p-2 -ml-2 active:scale-90 text-lg">← Salir</button>
          <span className="text-white font-bold bg-gray-900 px-4 py-1 rounded-full text-xs uppercase border border-gray-800">Entrenando</span>
          <div className="w-10"></div>
        </header>

        <div className="flex-1">
          <h2 className="text-4xl font-black text-white mb-1 tracking-tight">Press Banca</h2>
          <p className="text-blue-500 font-bold mb-10">SERIE 1</p>

          <div className="space-y-6">
            <Stepper label="PESO" value={weight} onChange={setWeight} step={2.5} unit="kg" />
            <Stepper label="REPS" value={reps} onChange={setReps} step={1} min={0} />
            <Stepper label="RIR" value={rir} onChange={setRir} step={1} min={0} max={10} />
          </div>
        </div>

        <button onClick={() => alert("Aquí guardaremos en Supabase")} className="w-full bg-green-600 text-white font-bold text-xl px-5 py-5 rounded-3xl active:scale-95 shadow-[0_0_20px_rgba(22,163,74,0.4)] mt-auto mb-4">
          ✓ GUARDAR SERIE
        </button>
      </div>
    );
  }

  // --- VISTA 4: DASHBOARD / RUTINAS ---
  return (
    <div className="flex flex-col h-screen bg-black px-6 pt-10 pb-6 animate-in fade-in duration-300">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Mis Rutinas</h1>
          <p className="text-sm font-medium text-gray-500 mt-1 truncate max-w-[200px]">{session.user.email}</p>
        </div>
        <button onClick={handleLogout} className="bg-gray-900 text-gray-400 px-4 py-2 rounded-xl text-xs font-bold border border-gray-800 active:scale-95">SALIR</button>
      </header>

      <div className="flex-1 overflow-y-auto space-y-4">
        {routines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center pb-20">
            <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center mb-6 border border-gray-800">
              <span className="text-4xl">💪</span>
            </div>
            <h3 className="text-white font-bold text-xl">Sin rutinas</h3>
            <p className="text-gray-500 text-sm mt-2 px-10">Crea tu primera rutina para empezar a entrenar.</p>
          </div>
        ) : (
          routines.map((routine) => (
            <div 
              key={routine.id} 
              onClick={() => setView('training')}
              className="bg-gray-900 p-5 rounded-3xl border border-gray-800 active:scale-95 transition-transform cursor-pointer"
            >
              <h3 className="text-xl font-bold text-white mb-2">{routine.name}</h3>
              <p className="text-sm text-gray-500 line-clamp-2">
                {routine.routine_exercises.map(e => e.name).join(' • ')}
              </p>
            </div>
          ))
        )}
      </div>
      
      <button 
        onClick={() => setView('creating')}
        className="w-full bg-blue-600 text-white font-bold text-lg px-5 py-5 rounded-3xl active:scale-95 transition-transform shadow-[0_0_20px_rgba(37,99,235,0.4)] mt-4"
      >
        + NUEVA RUTINA
      </button>
    </div>
  );
}