"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);

  // Comprobar si ya hay una sesión guardada
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Escuchar cambios (cuando haces login o logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) alert("Error al entrar: " + error.message);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Pantalla de carga super simple
  if (loading) {
    return <div className="flex h-screen items-center justify-center text-gray-500">Cargando...</div>;
  }

  // --- VISTA 1: NO LOGUEADO (FORMULARIO) ---
  if (!session) {
    return (
      <div className="flex flex-col h-screen justify-center p-6">
        <div className="bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-700">
          <h1 className="text-3xl font-bold mb-8 text-center tracking-tight">Gym PWA</h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Tu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="p-4 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="p-4 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold mt-4 active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- VISTA 2: LOGUEADO (INICIO DE LA APP) ---
  return (
    <div className="p-6 flex flex-col h-screen">
      <header className="flex justify-between items-center mb-8 pt-4">
        <div>
          <h1 className="text-2xl font-bold">Mis Rutinas</h1>
          <p className="text-sm text-gray-400">{session.user.email}</p>
        </div>
        <button 
          onClick={handleLogout} 
          className="text-sm bg-gray-800 text-gray-300 px-4 py-2 rounded-lg active:scale-95 transition-transform"
        >
          Salir
        </button>
      </header>

      {/* Aquí listaremos las rutinas que traigamos de la Base de Datos */}
      <div className="flex-1">
        <p className="text-gray-500 text-center mt-10">Aún no hay rutinas creadas.</p>
      </div>
      
      <button className="w-full bg-blue-600 p-5 rounded-2xl font-bold text-lg active:scale-95 transition-transform shadow-xl mb-6">
        Nueva Sesión Rápida
      </button>
    </div>
  );
}