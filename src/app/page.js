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

  const [importCode, setImportCode] = useState('');

  const [activeRoutine, setActiveRoutine] = useState(null);
  const [activeWeekTargets, setActiveWeekTargets] = useState({});
  const [dashboardWeekTargets, setDashboardWeekTargets] = useState({});

  const [programmingRoutine, setProgrammingRoutine] = useState(null);
  const [programmingTotalWeeks, setProgrammingTotalWeeks] = useState(0);
  const [programmingWeekActive, setProgrammingWeekActive] = useState(1);
  const [weekTargets, setWeekTargets] = useState({});

  const [expandedRoutines, setExpandedRoutines] = useState({});
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  const [installPromptEvent, setInstallPromptEvent] = useState(null);

  const fetchRoutines = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from('routines')
        .select(`id, name, share_code, has_weekly_plan, total_weeks, current_week, completed_weeks, routine_exercises (id, name, sort_order, day_name, target_sets, target_reps, target_rir)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRoutines(data);
        setExpandedRoutines(prev => {
          const next = { ...prev };
          data.forEach((r, idx) => {
            if (next[r.id] === undefined) next[r.id] = idx === 0;
          });
          return next;
        });

        const exerciseToWeek = {};
        data.forEach(r => {
          if (r.has_weekly_plan) {
            (r.routine_exercises || []).forEach(ex => { exerciseToWeek[ex.id] = r.current_week || 1; });
          }
        });
        const exIds = Object.keys(exerciseToWeek);
        if (exIds.length > 0) {
          const weekNumbers = [...new Set(Object.values(exerciseToWeek))];
          const { data: targets } = await supabase
            .from('exercise_week_targets')
            .select('routine_exercise_id, week_number, target_weight, target_sets, target_reps, target_rir')
            .in('routine_exercise_id', exIds)
            .in('week_number', weekNumbers);
          const map = {};
          (targets || []).forEach(t => {
            if (exerciseToWeek[t.routine_exercise_id] === t.week_number) {
              map[t.routine_exercise_id] = t;
            }
          });
          setDashboardWeekTargets(map);
        } else {
          setDashboardWeekTargets({});
        }
      }
    }
    setLoading(false);
  };

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

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    const onInstalled = () => setInstallPromptEvent(null);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Error: " + error.message);
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!confirm("¿Crear cuenta nueva?")) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert("Error: " + error.message);
    else alert("¡Cuenta creada! Ya puedes entrar.");
    setLoading(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const handleImportRoutine = async () => {
    if (!importCode.trim()) return;
    setLoading(true);
    const { data: originalRoutine, error: rError } = await supabase.from('routines').select('*, routine_exercises(*)').eq('share_code', importCode.trim()).single();
    if (rError || !originalRoutine) { alert("No se encontró ninguna rutina con ese código."); setLoading(false); return; }
    const { data: newRoutine, error: nError } = await supabase.from('routines').insert([{
      name: originalRoutine.name + " (Copia)",
      has_weekly_plan: !!originalRoutine.has_weekly_plan,
      total_weeks: originalRoutine.total_weeks || 0,
      current_week: 1,
    }]).select().single();
    if (nError) { alert("Error al clonar: " + nError.message); setLoading(false); return; }

    const oldExIds = originalRoutine.routine_exercises.map(e => e.id);
    const newExercises = originalRoutine.routine_exercises.map(ex => ({
      routine_id: newRoutine.id, name: ex.name, day_name: ex.day_name, sort_order: ex.sort_order, target_sets: ex.target_sets, target_reps: ex.target_reps, target_rir: ex.target_rir
    }));
    const { data: insertedEx } = await supabase.from('routine_exercises').insert(newExercises).select();

    if (originalRoutine.has_weekly_plan && insertedEx && insertedEx.length > 0 && oldExIds.length > 0) {
      const { data: origTargets } = await supabase.from('exercise_week_targets')
        .select('routine_exercise_id, week_number, target_weight, target_sets, target_reps, target_rir')
        .in('routine_exercise_id', oldExIds);
      if (origTargets && origTargets.length > 0) {
        const oldById = Object.fromEntries(originalRoutine.routine_exercises.map(e => [e.id, e]));
        const newByKey = {};
        insertedEx.forEach(ne => { newByKey[`${ne.day_name}|${ne.sort_order}|${ne.name}`] = ne.id; });
        const rows = origTargets.map(t => {
          const oldEx = oldById[t.routine_exercise_id];
          const newId = oldEx ? newByKey[`${oldEx.day_name}|${oldEx.sort_order}|${oldEx.name}`] : null;
          if (!newId) return null;
          return {
            routine_exercise_id: newId,
            week_number: t.week_number,
            target_weight: t.target_weight,
            target_sets: t.target_sets,
            target_reps: t.target_reps,
            target_rir: t.target_rir,
          };
        }).filter(Boolean);
        if (rows.length > 0) await supabase.from('exercise_week_targets').insert(rows);
      }
    }

    alert("¡Rutina importada con éxito!"); setImportCode(''); fetchRoutines(); setLoading(false);
  };

  const handleOpenHistory = async () => {
    setLoading(true); setEditingHistLog(null);
    const { data, error } = await supabase.from('workout_logs').select(`id, weight, reps, rir, set_number, created_at, routine_exercises (name)`).order('created_at', { ascending: false }).limit(300);
    if (!error && data) {
      const grouped = data.reduce((acc, log) => {
        const dateStr = new Date(log.created_at).toLocaleDateString();
        if (!acc[dateStr]) acc[dateStr] = {};
        const exName = log.routine_exercises?.name || 'Ejercicio borrado';
        if (!acc[dateStr][exName]) acc[dateStr][exName] = [];
        acc[dateStr][exName].push(log); return acc;
      }, {});
      const historyArray = Object.keys(grouped).map(date => ({ date, exercises: Object.keys(grouped[date]).map(name => ({ name, logs: grouped[date][name].sort((a, b) => a.set_number - b.set_number) })) }));
      setHistoryData(historyArray);
      const initialExpanded = {}; const initialSelected = {};
      historyArray.forEach((d, idx) => { initialExpanded[d.date] = idx === 0; initialSelected[d.date] = false; });
      setExpandedDates(initialExpanded); setSelectedDates(initialSelected);
    }
    setView('history'); setLoading(false);
  };

  const handleCopyHistory = async () => {
    const datesToCopy = Object.keys(selectedDates).filter(date => selectedDates[date]);
    if (datesToCopy.length === 0) return alert("Selecciona algún día.");
    let text = "";
    historyData.forEach(day => {
      if (selectedDates[day.date]) {
        text += `=== ${day.date} ===\n\n`;
        day.exercises.forEach(ex => {
          text += `${ex.name}\n`;
          ex.logs.forEach(log => { text += `- Serie ${log.set_number}: ${log.weight}kg x ${log.reps} reps RIR ${log.rir}\n`; });
          text += `\n`;
        });
      }
    });
    try { await navigator.clipboard.writeText(text.trim()); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) { alert("Error al copiar."); }
  };

  const saveHistoryLog = async () => {
    setLoading(true); await supabase.from('workout_logs').update({ weight: editingHistLog.weight, reps: editingHistLog.reps, rir: editingHistLog.rir }).eq('id', editingHistLog.id);
    setEditingHistLog(null); await handleOpenHistory();
  };

  const deleteHistoryLog = async (id) => {
    if(!window.confirm("¿Borrar serie?")) return;
    setLoading(true); await supabase.from('workout_logs').delete().eq('id', id);
    setEditingHistLog(null); await handleOpenHistory(); 
  };

  const moveExercise = (dIdx, eIdx, direction) => {
    setRoutineDays(prev => {
      const u = [...prev];
      const day = { ...u[dIdx] };
      const exercises = [...day.exercises];
      const newIdx = eIdx + direction;
      if (newIdx < 0 || newIdx >= exercises.length) return prev;
      [exercises[eIdx], exercises[newIdx]] = [exercises[newIdx], exercises[eIdx]];
      day.exercises = exercises;
      u[dIdx] = day;
      return u;
    });
  };

  const handleOpenCreate = () => {
    setEditingRoutineId(null); setNewRoutineName('');
    setRoutineDays([{ dayName: 'Día 1', exercises: [{ id: null, name: '', targetSets: '', targetReps: '', targetRir: '' }] }]);
    setView('creating');
  };

  const handleEditRoutine = (routine) => {
    setEditingRoutineId(routine.id); setNewRoutineName(routine.name);
    const daysMap = {};
    const sortedExs = [...routine.routine_exercises].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    sortedExs.forEach(ex => {
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
    setLoading(true); await supabase.from('routines').delete().eq('id', id);
    fetchRoutines(); setLoading(false);
  };

  const handleOpenProgramming = async (routine) => {
    setLoading(true);
    setProgrammingRoutine(routine);
    setProgrammingTotalWeeks(routine.has_weekly_plan ? (routine.total_weeks || 0) : 0);
    setProgrammingWeekActive(routine.current_week || 1);
    const exIds = (routine.routine_exercises || []).map(e => e.id);
    if (routine.has_weekly_plan && exIds.length > 0) {
      const { data } = await supabase
        .from('exercise_week_targets')
        .select('routine_exercise_id, week_number, target_weight, target_sets, target_reps, target_rir')
        .in('routine_exercise_id', exIds);
      const map = {};
      (data || []).forEach(t => {
        if (!map[t.routine_exercise_id]) map[t.routine_exercise_id] = {};
        map[t.routine_exercise_id][t.week_number] = {
          weight: t.target_weight ?? '',
          sets: t.target_sets ?? '',
          reps: t.target_reps ?? '',
          rir: t.target_rir ?? '',
        };
      });
      setWeekTargets(map);
    } else {
      setWeekTargets({});
    }
    setView('programming');
    setLoading(false);
  };

  const handleCreateWeeklyPlan = (defaultWeeks = 4) => {
    setProgrammingTotalWeeks(defaultWeeks);
    setProgrammingWeekActive(1);
    const init = {};
    (programmingRoutine?.routine_exercises || []).forEach(ex => {
      init[ex.id] = {};
      for (let w = 1; w <= defaultWeeks; w++) {
        init[ex.id][w] = { weight: '', sets: ex.target_sets || '', reps: ex.target_reps || '', rir: ex.target_rir || '' };
      }
    });
    setWeekTargets(init);
  };

  const handleChangeTotalWeeks = (delta) => {
    const next = Math.max(1, Math.min(20, programmingTotalWeeks + delta));
    if (next === programmingTotalWeeks) return;
    if (next > programmingTotalWeeks) {
      const updated = { ...weekTargets };
      (programmingRoutine?.routine_exercises || []).forEach(ex => {
        if (!updated[ex.id]) updated[ex.id] = {};
        for (let w = programmingTotalWeeks + 1; w <= next; w++) {
          if (!updated[ex.id][w]) updated[ex.id][w] = { weight: '', sets: ex.target_sets || '', reps: ex.target_reps || '', rir: ex.target_rir || '' };
        }
      });
      setWeekTargets(updated);
    }
    if (programmingWeekActive > next) setProgrammingWeekActive(next);
    setProgrammingTotalWeeks(next);
  };

  const handleSelectProgrammingWeek = (targetWeek) => {
    if (targetWeek === programmingWeekActive) return;
    setWeekTargets(prev => {
      const next = { ...prev };
      (programmingRoutine?.routine_exercises || []).forEach(ex => {
        const targetCell = prev?.[ex.id]?.[targetWeek];
        const needsFill = !targetCell || targetCell.weight === '' || targetCell.weight === null || targetCell.weight === undefined;
        if (!needsFill) return;
        let sourceWeek = null;
        for (let w = targetWeek - 1; w >= 1; w--) {
          const c = prev?.[ex.id]?.[w];
          if (c && c.weight !== '' && c.weight !== null && c.weight !== undefined) { sourceWeek = w; break; }
        }
        if (sourceWeek === null) return;
        const src = prev[ex.id][sourceWeek];
        const exMap = { ...(next[ex.id] || {}) };
        exMap[targetWeek] = { ...src };
        next[ex.id] = exMap;
      });
      return next;
    });
    setProgrammingWeekActive(targetWeek);
  };

  const handleCopyFromPrevWeek = () => {
    if (programmingWeekActive <= 1) return;
    const source = programmingWeekActive - 1;
    setWeekTargets(prev => {
      const next = { ...prev };
      (programmingRoutine?.routine_exercises || []).forEach(ex => {
        const srcCell = prev?.[ex.id]?.[source];
        if (!srcCell) return;
        const exMap = { ...(next[ex.id] || {}) };
        exMap[programmingWeekActive] = { ...srcCell };
        next[ex.id] = exMap;
      });
      return next;
    });
  };

  const handleWeekCellChange = (exId, weekNumber, key, value) => {
    setWeekTargets(prev => {
      const next = { ...prev };
      const exMap = { ...(next[exId] || {}) };
      exMap[weekNumber] = { ...(exMap[weekNumber] || { weight: '', sets: '', reps: '', rir: '' }), [key]: value };
      next[exId] = exMap;
      return next;
    });
  };

  const handleSaveProgramming = async () => {
    if (!programmingRoutine) return;
    setLoading(true);
    const routineId = programmingRoutine.id;
    const exIds = (programmingRoutine.routine_exercises || []).map(e => e.id);

    const prevCompleted = programmingRoutine.completed_weeks || [];
    const prunedCompleted = prevCompleted.filter(w => w <= programmingTotalWeeks).sort((a, b) => a - b);

    await supabase.from('routines').update({
      has_weekly_plan: true,
      total_weeks: programmingTotalWeeks,
      current_week: Math.min(programmingWeekActive, programmingTotalWeeks || 1),
      completed_weeks: prunedCompleted,
    }).eq('id', routineId);

    const toUpsert = [];
    exIds.forEach(exId => {
      for (let w = 1; w <= programmingTotalWeeks; w++) {
        const cell = weekTargets?.[exId]?.[w];
        if (!cell) continue;
        const hasAny = ['weight', 'sets', 'reps', 'rir'].some(k => cell[k] !== '' && cell[k] !== null && cell[k] !== undefined);
        if (!hasAny) continue;
        toUpsert.push({
          routine_exercise_id: exId,
          week_number: w,
          target_weight: cell.weight === '' || cell.weight === null || cell.weight === undefined ? null : Number(cell.weight),
          target_sets: cell.sets || null,
          target_reps: cell.reps || null,
          target_rir: cell.rir || null,
        });
      }
    });
    if (toUpsert.length > 0) {
      await supabase.from('exercise_week_targets').upsert(toUpsert, { onConflict: 'routine_exercise_id,week_number' });
    }
    if (exIds.length > 0) {
      await supabase.from('exercise_week_targets')
        .delete()
        .in('routine_exercise_id', exIds)
        .gt('week_number', programmingTotalWeeks);
    }

    await fetchRoutines();
    setView('dashboard');
    setLoading(false);
  };

  const handleTogglePlanOff = async () => {
    if (!programmingRoutine) return;
    if (!window.confirm('¿Apagar la programación? Se borrarán los datos por semana. Las rutinas y el historial se conservan.')) return;
    setLoading(true);
    const routineId = programmingRoutine.id;
    const exIds = (programmingRoutine.routine_exercises || []).map(e => e.id);
    if (exIds.length > 0) {
      await supabase.from('exercise_week_targets').delete().in('routine_exercise_id', exIds);
    }
    await supabase.from('routines').update({ has_weekly_plan: false, total_weeks: 0, completed_weeks: [] }).eq('id', routineId);
    await fetchRoutines();
    setView('dashboard');
    setLoading(false);
  };

  const handleCompleteWeek = async (routine) => {
    haptic(20);
    const current = routine.current_week || 1;
    const total = routine.total_weeks || 1;
    const completedSet = new Set(routine.completed_weeks || []);
    completedSet.add(current);
    const newCompleted = [...completedSet].sort((a, b) => a - b);
    const nextWeek = Math.min(current + 1, total);

    setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, completed_weeks: newCompleted, current_week: nextWeek } : r));
    await supabase.from('routines').update({ completed_weeks: newCompleted, current_week: nextWeek }).eq('id', routine.id);

    if (nextWeek !== current) {
      const exIds = (routine.routine_exercises || []).map(e => e.id);
      if (exIds.length > 0) {
        const { data: targets } = await supabase
          .from('exercise_week_targets')
          .select('routine_exercise_id, week_number, target_weight, target_sets, target_reps, target_rir')
          .in('routine_exercise_id', exIds)
          .eq('week_number', nextWeek);
        setDashboardWeekTargets(prev => {
          const updated = { ...prev };
          exIds.forEach(id => { delete updated[id]; });
          (targets || []).forEach(t => { updated[t.routine_exercise_id] = t; });
          return updated;
        });
      }
    }
  };

  const handleChangeCurrentWeek = async (routine, delta) => {
    const total = routine.total_weeks || 1;
    const next = Math.max(1, Math.min(total, (routine.current_week || 1) + delta));
    if (next === routine.current_week) return;
    setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, current_week: next } : r));
    await supabase.from('routines').update({ current_week: next }).eq('id', routine.id);

    const exIds = (routine.routine_exercises || []).map(e => e.id);
    if (exIds.length > 0) {
      const { data: targets } = await supabase
        .from('exercise_week_targets')
        .select('routine_exercise_id, week_number, target_weight, target_sets, target_reps, target_rir')
        .in('routine_exercise_id', exIds)
        .eq('week_number', next);
      setDashboardWeekTargets(prev => {
        const updated = { ...prev };
        exIds.forEach(id => { delete updated[id]; });
        (targets || []).forEach(t => { updated[t.routine_exercise_id] = t; });
        return updated;
      });
    }
  };

  const handleSaveRoutine = async () => {
    if (!newRoutineName.trim()) return alert("Ponle nombre.");
    let validationFailed = false; let hasValidExercises = false;
    for (const day of routineDays) {
      const validExs = day.exercises.filter(ex => ex.name.trim() !== '');
      if (validExs.length > 0) hasValidExercises = true;
      for (const ex of validExs) {
        if (!ex.targetSets.trim() || !ex.targetReps.trim() || !ex.targetRir.trim()) { alert(`Faltan datos en "${ex.name}"`); validationFailed = true; break; }
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

  const getEffectiveTargetSets = (ex) => {
    if (!ex) return "1";
    const weeklySets = activeWeekTargets?.[ex.id]?.target_sets;
    return weeklySets || ex.target_sets || "1";
  };

  const parseNumFromText = (s, fallback) => {
    if (s === null || s === undefined || s === '') return fallback;
    const match = String(s).match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : fallback;
  };

  const loadDefaultsForExercise = async (exercise, currentSessionLogsParam, routineInfo, weekMap) => {
    const exId = exercise.id;
    const targetReps = parseNumFromText(exercise?.target_reps, 10);
    const targetRir = parseNumFromText(exercise?.target_rir, 2);

    const logsThisSession = currentSessionLogsParam.filter(l => l.routine_exercise_id === exId);
    if (logsThisSession.length > 0) {
      const lastLog = logsThisSession[logsThisSession.length - 1];
      setWeight(lastLog.weight);
      setReps(targetReps);
      setRir(targetRir);
      return;
    }

    const effectiveRoutine = routineInfo !== undefined ? routineInfo : activeRoutine;
    const effectiveWeekMap = weekMap !== undefined ? weekMap : activeWeekTargets;
    if (effectiveRoutine?.has_weekly_plan) {
      const plan = effectiveWeekMap?.[exId];
      if (plan && plan.target_weight !== null && plan.target_weight !== undefined) {
        setWeight(Number(plan.target_weight));
        setReps(parseNumFromText(plan.target_reps, targetReps));
        setRir(parseNumFromText(plan.target_rir, targetRir));
        return;
      }
    }

    const { data } = await supabase
      .from('workout_logs')
      .select('weight')
      .eq('routine_exercise_id', exId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setWeight(data ? data.weight : 20);
    setReps(targetReps);
    setRir(targetRir);
  };

  const handleStartTraining = async (routine, exercises) => {
    setLoading(true);
    const sorted = [...exercises].sort((a, b) => a.sort_order - b.sort_order);
    const routineInfo = {
      id: routine.id,
      name: routine.name,
      has_weekly_plan: !!routine.has_weekly_plan,
      current_week: routine.current_week || 1,
      total_weeks: routine.total_weeks || 0,
    };
    setActiveRoutine(routineInfo);

    const exIds = sorted.map(e => e.id);

    let weekMap = {};
    if (routineInfo.has_weekly_plan && exIds.length > 0) {
      const { data } = await supabase
        .from('exercise_week_targets')
        .select('routine_exercise_id, target_weight, target_sets, target_reps, target_rir')
        .in('routine_exercise_id', exIds)
        .eq('week_number', routineInfo.current_week);
      (data || []).forEach(t => { weekMap[t.routine_exercise_id] = t; });
    }
    setActiveWeekTargets(weekMap);

    let todaysLogs = [];
    if (exIds.length > 0) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('workout_logs')
        .select('id, routine_exercise_id, set_number, weight, reps, rir, created_at')
        .in('routine_exercise_id', exIds)
        .gte('created_at', startOfToday.toISOString())
        .order('created_at', { ascending: true });
      todaysLogs = data || [];
    }

    setLoading(false);

    let initialSessionLogs = [];
    let initialExIndex = 0;
    let initialSet = 1;

    if (todaysLogs.length > 0) {
      const n = todaysLogs.length;
      const continueSession = window.confirm(
        `Tienes ${n} serie${n === 1 ? '' : 's'} ya registrada${n === 1 ? '' : 's'} hoy en este día.\n\n¿Continuar desde donde lo dejaste?`
      );
      if (continueSession) {
        initialSessionLogs = todaysLogs;
        const logsByEx = {};
        todaysLogs.forEach(log => {
          if (!logsByEx[log.routine_exercise_id]) logsByEx[log.routine_exercise_id] = [];
          logsByEx[log.routine_exercise_id].push(log);
        });
        let foundIncomplete = false;
        for (let i = 0; i < sorted.length; i++) {
          const ex = sorted[i];
          const exLogs = logsByEx[ex.id] || [];
          const targetSetsStr = (weekMap[ex.id]?.target_sets) || ex.target_sets || "1";
          const maxTargetSets = parseInt(targetSetsStr.split('-').pop()) || 1;
          if (exLogs.length < maxTargetSets) {
            initialExIndex = i;
            initialSet = exLogs.length + 1;
            foundIncomplete = true;
            break;
          }
        }
        if (!foundIncomplete) {
          alert('¡Ya completaste todas las series de hoy en este día! 🏆');
          return;
        }
      }
    }

    setLoading(true);
    setActiveExercises(sorted);
    setCurrentExIndex(initialExIndex);
    setCurrentSet(initialSet);
    setSessionLogs(initialSessionLogs);
    setEditingLogId(null);
    await loadDefaultsForExercise(sorted[initialExIndex], initialSessionLogs, routineInfo, weekMap);
    setView('training');
    setLoading(false);
  };

  const handleSaveSet = async () => {
    const activeEx = activeExercises[currentExIndex]; setLoading(true);
    haptic(12);
    if (editingLogId) {
      const { error } = await supabase.from('workout_logs').update({ weight, reps, rir }).eq('id', editingLogId);
      if (!error) {
        const updatedLogs = sessionLogs.map(log => log.id === editingLogId ? { ...log, weight, reps, rir } : log);
        setSessionLogs(updatedLogs);
        const currentExLogs = updatedLogs.filter(l => l.routine_exercise_id === activeEx.id);
        const maxTargetSets = parseInt(getEffectiveTargetSets(activeEx).split('-').pop());
        if (currentExLogs.length >= maxTargetSets) { handleLoadLogForEdit(currentExLogs[currentExLogs.length - 1]); }
        else { setEditingLogId(null); setCurrentSet(currentExLogs.length + 1); }
      }
    } else {
      const { data, error } = await supabase.from('workout_logs').insert([{ routine_exercise_id: activeEx.id, set_number: currentSet, weight, reps, rir }]).select().single();
      if (!error) {
        const updatedLogs = [...sessionLogs, data]; setSessionLogs(updatedLogs);
        const maxTargetSets = parseInt(getEffectiveTargetSets(activeEx).split('-').pop());
        if (currentSet >= maxTargetSets) { handleNextExercise(updatedLogs); } else { setCurrentSet(prev => prev + 1); }
      }
    }
    setLoading(false);
  };

  const handleLoadLogForEdit = (log) => { setEditingLogId(log.id); setWeight(log.weight); setReps(log.reps); setRir(log.rir); setCurrentSet(log.set_number); };

  const handleNextExercise = async (currentLogs = sessionLogs) => {
    if (currentExIndex < activeExercises.length - 1) {
      setLoading(true); const nextIndex = currentExIndex + 1; const nextEx = activeExercises[nextIndex];
      setCurrentExIndex(nextIndex); const logsForNextEx = currentLogs.filter(l => l.routine_exercise_id === nextEx.id);
      const maxTargetSets = parseInt(getEffectiveTargetSets(nextEx).split('-').pop());
      if (logsForNextEx.length >= maxTargetSets && logsForNextEx.length > 0) { handleLoadLogForEdit(logsForNextEx[logsForNextEx.length - 1]); } 
      else { setCurrentSet(logsForNextEx.length + 1); setEditingLogId(null); await loadDefaultsForExercise(nextEx, currentLogs); }
      setLoading(false);
    } else { alert("¡Entrenamiento finalizado! 🏆"); setView('dashboard'); }
  };

  const handlePrevExercise = async () => {
    if (currentExIndex > 0) {
      setLoading(true); const prevIndex = currentExIndex - 1; const prevEx = activeExercises[prevIndex];
      setCurrentExIndex(prevIndex); const logsForPrevEx = sessionLogs.filter(l => l.routine_exercise_id === prevEx.id);
      const maxTargetSets = parseInt(getEffectiveTargetSets(prevEx).split('-').pop());
      if (logsForPrevEx.length >= maxTargetSets && logsForPrevEx.length > 0) { handleLoadLogForEdit(logsForPrevEx[logsForPrevEx.length - 1]); } 
      else { setCurrentSet(logsForPrevEx.length + 1); setEditingLogId(null); await loadDefaultsForExercise(prevEx, sessionLogs); }
      setLoading(false);
    }
  };

  // --- RENDERS ---
  const haptic = (ms = 8) => {
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch {}
  };

  const handleInstallPWA = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    try {
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === 'accepted') setInstallPromptEvent(null);
    } catch {}
  };

  const handleCopyShareCode = async (routine) => {
    try {
      await navigator.clipboard.writeText(routine.share_code || '');
      setCopiedCodeId(routine.id);
      haptic();
      setTimeout(() => setCopiedCodeId(prev => (prev === routine.id ? null : prev)), 1500);
    } catch {}
  };

  if (loading) return <div className="flex h-[100dvh] items-center justify-center bg-black"><div className="w-8 h-8 border-4 border-gray-800 border-t-green-500 rounded-full animate-spin"></div></div>;

  if (!session) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-black px-6 justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="w-full max-w-sm mx-auto pb-10">
          <h1 className="text-5xl font-black text-white tracking-tighter mb-10">Gym<span className="text-green-500">PWA</span></h1>
          <form className="space-y-4" onSubmit={handleLogin}>
            <input type="email" autoComplete="email" inputMode="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 outline-none text-base" required />
            <input type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 outline-none text-base" required />
            <button type="submit" className="w-full bg-green-600 text-white font-bold text-lg px-5 py-4 rounded-2xl mt-4 active:scale-95 transition-transform">Iniciar Sesión</button>
            <button type="button" onClick={handleSignUp} className="w-full bg-transparent text-gray-500 font-bold text-sm py-2 active:text-white transition-colors">¿No tienes cuenta? Crear cuenta</button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'history') {
    const selectedCount = Object.values(selectedDates).filter(Boolean).length;
    return (
      <div className="flex flex-col h-[100dvh] bg-black px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in fade-in">
        <header className="flex justify-between items-center mb-8 shrink-0">
          <button onClick={() => setView('dashboard')} className="text-gray-400 p-2 -ml-2 text-lg">← Volver</button>
          <span className="text-white font-bold">Historial</span>
          <button onClick={handleCopyHistory} className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${copied ? 'bg-green-600 text-white' : 'bg-gray-800 text-green-400'}`}>
            {copied ? '✅ Copiado' : `📋 Copiar (${selectedCount})`}
          </button>
        </header>
        <div className="flex-1 overflow-y-auto space-y-4 hide-scrollbar pb-10">
          {historyData.length === 0 ? <div className="text-center text-gray-500 mt-20">Sin entrenamientos.</div> :
            historyData.map((dayData, idx) => (
              <div key={idx} className="bg-gray-900 p-5 rounded-3xl border border-gray-800">
                <div className="flex justify-between items-center select-none">
                  <div className="flex items-center gap-4 flex-1">
                    <label className="p-3 -ml-3 cursor-pointer" aria-label="Seleccionar día">
                      <input type="checkbox" checked={!!selectedDates[dayData.date]} onChange={(e) => setSelectedDates(prev => ({...prev, [dayData.date]: e.target.checked}))} className="w-6 h-6 accent-green-500 block" />
                    </label>
                    <h3 className="text-xl font-black text-green-500 cursor-pointer flex-1" onClick={() => setExpandedDates(prev => ({...prev, [dayData.date]: !prev[dayData.date]}))}>{dayData.date}</h3>
                  </div>
                  <div className="text-gray-500 font-bold text-3xl cursor-pointer p-2" onClick={() => setExpandedDates(prev => ({...prev, [dayData.date]: !prev[dayData.date]}))}>{expandedDates[dayData.date] ? '−' : '+'}</div>
                </div>
                {expandedDates[dayData.date] && (
                  <div className="space-y-6 mt-6">
                    {dayData.exercises.map((ex, eIdx) => (
                      <div key={eIdx}><h4 className="text-white font-bold mb-2">{ex.name}</h4>
                        <div className="space-y-2">
                          {ex.logs.map(log => (
                            <div key={log.id} className={`flex flex-col text-sm p-3 rounded-xl border ${editingHistLog?.id === log.id ? 'border-green-500 bg-black' : 'border-gray-800 bg-black'}`}>
                              {editingHistLog?.id === log.id ? (
                                <div className="flex flex-col gap-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-400 font-bold">Serie {log.set_number}</span>
                                    <button onClick={() => deleteHistoryLog(log.id)} className="text-red-500 font-bold text-sm px-2 py-1 -mr-2 active:scale-95">Borrar</button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <label className="flex flex-col gap-1">
                                      <span className="text-[10px] text-gray-500 uppercase font-bold ml-1">Peso</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={editingHistLog.weight}
                                        onChange={(e) => setEditingHistLog({ ...editingHistLog, weight: e.target.value })}
                                        className="w-full min-w-0 bg-gray-900 text-white px-2 py-2 rounded-lg text-base text-center border border-gray-800 focus:border-green-500 outline-none"
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="text-[10px] text-gray-500 uppercase font-bold ml-1">Reps</span>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={editingHistLog.reps}
                                        onChange={(e) => setEditingHistLog({ ...editingHistLog, reps: e.target.value })}
                                        className="w-full min-w-0 bg-gray-900 text-white px-2 py-2 rounded-lg text-base text-center border border-gray-800 focus:border-green-500 outline-none"
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="text-[10px] text-gray-500 uppercase font-bold ml-1">RIR</span>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={editingHistLog.rir}
                                        onChange={(e) => setEditingHistLog({ ...editingHistLog, rir: e.target.value })}
                                        className="w-full min-w-0 bg-gray-900 text-white px-2 py-2 rounded-lg text-base text-center border border-gray-800 focus:border-green-500 outline-none"
                                      />
                                    </label>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => setEditingHistLog(null)} className="flex-1 bg-gray-800 text-white py-2 rounded-lg font-bold text-sm active:scale-95">Cancelar</button>
                                    <button onClick={saveHistoryLog} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-sm active:scale-95">Guardar</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-center"><span className="text-gray-400">Serie {log.set_number}</span><div className="flex items-center gap-3 text-white font-medium">{log.weight}kg | {log.reps}r | RIR {log.rir}<button aria-label="Editar serie" onClick={() => setEditingHistLog({ id: log.id, weight: log.weight, reps: log.reps, rir: log.rir })} className="w-10 h-10 flex items-center justify-center opacity-60 active:opacity-100 active:scale-90">✏️</button></div></div>
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
          }
        </div>
      </div>
    );
  }

  if (view === 'creating') {
    return (
      <div className="flex flex-col h-[100dvh] bg-black px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in fade-in">
        <header className="flex justify-between items-center mb-8 shrink-0"><button onClick={() => setView('dashboard')} className="text-gray-400 p-2 -ml-2 text-lg">← Volver</button><span className="text-white font-bold">{editingRoutineId ? 'Editar' : 'Nueva'}</span><div className="w-10"></div></header>
        <div className="flex-1 overflow-y-auto space-y-8 hide-scrollbar pb-6">
          <input type="text" placeholder="Nombre de la rutina" value={newRoutineName} onChange={(e) => setNewRoutineName(e.target.value)} className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl border border-gray-800 outline-none text-xl font-bold"/>
          <div className="space-y-6">
            {routineDays.map((day, dIdx) => (
              <div key={dIdx} className="bg-gray-900/50 p-4 rounded-3xl border border-gray-800">
                <input type="text" value={day.dayName} onChange={(e) => { const u = [...routineDays]; u[dIdx].dayName = e.target.value; setRoutineDays(u); }} className="bg-transparent text-green-500 font-bold text-xl mb-4 w-full outline-none" placeholder="Día..."/>
                <div className="space-y-4">
                  {day.exercises.map((ex, eIdx) => (
                    <div key={eIdx} className="bg-black p-3 rounded-2xl border border-gray-800 space-y-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          aria-label="Subir ejercicio"
                          onClick={() => moveExercise(dIdx, eIdx, -1)}
                          disabled={eIdx === 0}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 disabled:opacity-25 active:text-white active:scale-90 text-sm"
                        >▲</button>
                        <button
                          type="button"
                          aria-label="Bajar ejercicio"
                          onClick={() => moveExercise(dIdx, eIdx, +1)}
                          disabled={eIdx === day.exercises.length - 1}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 disabled:opacity-25 active:text-white active:scale-90 text-sm"
                        >▼</button>
                        <button
                          type="button"
                          aria-label="Quitar ejercicio"
                          onClick={() => { const u = [...routineDays]; u[dIdx].exercises.splice(eIdx, 1); setRoutineDays(u); }}
                          className="w-8 h-8 flex items-center justify-center text-gray-500 active:text-red-500 active:scale-90"
                        >✕</button>
                      </div>
                      <input type="text" placeholder="Ejercicio" value={ex.name} onChange={(e) => { const u = [...routineDays]; u[dIdx].exercises[eIdx].name = e.target.value; setRoutineDays(u); }} className="w-full bg-transparent text-white px-2 py-1 outline-none text-lg font-bold border-b border-gray-800"/>
                      <div className="flex gap-2">
                        {['Sets', 'Reps', 'Rir'].map(f => (
                          <div key={f} className="flex-1">
                            <label className="text-xs text-gray-500 ml-1">{f} *</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={ex[`target${f}`]}
                              onChange={(e) => { const u = [...routineDays]; u[dIdx].exercises[eIdx][`target${f}`] = e.target.value; setRoutineDays(u); }}
                              className="w-full bg-gray-900 text-white px-2 py-2 rounded-xl outline-none text-base text-center border border-gray-800 focus:border-green-500"
                            />
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
        <button onClick={handleSaveRoutine} className="w-full bg-green-600 text-white font-bold text-xl px-5 py-5 rounded-3xl mt-4 shrink-0">Guardar</button>
      </div>
    );
  }

  if (view === 'programming') {
    const routine = programmingRoutine;
    const daysMap = {};
    (routine?.routine_exercises || []).forEach(ex => {
      const day = ex.day_name || 'Día 1';
      if (!daysMap[day]) daysMap[day] = [];
      daysMap[day].push(ex);
    });
    Object.keys(daysMap).forEach(d => daysMap[d].sort((a, b) => a.sort_order - b.sort_order));
    const hasPlan = programmingTotalWeeks > 0;

    return (
      <div className="flex flex-col h-[100dvh] bg-black px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in fade-in">
        <header className="flex justify-between items-center mb-6 shrink-0">
          <button onClick={() => setView('dashboard')} className="text-gray-400 p-2 -ml-2 text-lg">← Volver</button>
          <span className="text-white font-bold">Programación</span>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 overflow-y-auto space-y-6 hide-scrollbar pb-6">
          <h2 className="text-3xl font-black text-white tracking-tight">{routine?.name}</h2>

          {!hasPlan ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <h3 className="text-white font-bold text-xl mb-3">Sin programación</h3>
              <p className="text-gray-500 text-sm mb-8 px-4">Planifica peso, sets, reps y RIR por semana dentro de un bloque.</p>
              <button onClick={() => handleCreateWeeklyPlan(4)} className="bg-green-600 text-white font-bold px-6 py-4 rounded-2xl active:scale-95 shadow-[0_0_20px_rgba(22,163,74,0.3)]">
                + Crear programación (4 semanas)
              </button>
            </div>
          ) : (
            <>
              <div className="bg-gray-900 p-4 rounded-3xl border border-gray-800 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-bold">Semanas</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleChangeTotalWeeks(-1)} className="w-10 h-10 bg-gray-800 text-white rounded-full text-xl active:scale-90">−</button>
                    <span className="text-white font-black text-2xl w-8 text-center">{programmingTotalWeeks}</span>
                    <button onClick={() => handleChangeTotalWeeks(+1)} className="w-10 h-10 bg-green-600 text-white rounded-full text-xl active:scale-90">+</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: programmingTotalWeeks }, (_, i) => i + 1).map(w => (
                    <button
                      key={w}
                      onClick={() => handleSelectProgrammingWeek(w)}
                      className={`px-4 py-2 rounded-full font-bold text-sm border transition-colors ${programmingWeekActive === w ? 'bg-green-600 border-green-500 text-white' : 'bg-black border-gray-800 text-gray-400'}`}
                    >
                      S{w}
                    </button>
                  ))}
                </div>
                {programmingWeekActive > 1 && (
                  <button
                    onClick={handleCopyFromPrevWeek}
                    className="w-full mt-1 py-2 rounded-xl border border-gray-800 text-gray-400 text-xs font-bold active:scale-95"
                  >
                    📋 Copiar de Semana {programmingWeekActive - 1}
                  </button>
                )}
              </div>

              {Object.entries(daysMap).map(([dayName, exercises]) => (
                <div key={dayName} className="bg-gray-900/50 p-4 rounded-3xl border border-gray-800">
                  <h4 className="text-green-500 font-bold text-xl mb-4">{dayName}</h4>
                  <div className="space-y-3">
                    {exercises.map(ex => {
                      const cell = weekTargets?.[ex.id]?.[programmingWeekActive] || { weight: '', sets: '', reps: '', rir: '' };
                      return (
                        <div key={ex.id} className="bg-black p-3 rounded-2xl border border-gray-800 space-y-3">
                          <div className="text-white font-bold px-1 truncate">{ex.name}</div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { label: 'Peso', key: 'weight', placeholder: 'kg', mode: 'decimal' },
                              { label: 'Sets', key: 'sets', placeholder: '3',    mode: 'numeric' },
                              { label: 'Reps', key: 'reps', placeholder: '8-10', mode: 'numeric' },
                              { label: 'RIR',  key: 'rir',  placeholder: '2',    mode: 'numeric' },
                            ].map(f => (
                              <div key={f.key}>
                                <label className="text-[10px] text-gray-500 ml-1 uppercase font-bold">{f.label}</label>
                                <input
                                  type="text"
                                  inputMode={f.mode}
                                  value={cell[f.key]}
                                  onChange={(e) => handleWeekCellChange(ex.id, programmingWeekActive, f.key, e.target.value)}
                                  placeholder={f.placeholder}
                                  className="w-full bg-gray-900 text-white px-2 py-2 rounded-xl outline-none text-base text-center border border-gray-800 focus:border-green-500"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button onClick={handleTogglePlanOff} className="w-full py-3 rounded-2xl border border-red-900/60 text-red-500 font-bold text-sm active:scale-95">
                Apagar programación
              </button>
            </>
          )}
        </div>

        {hasPlan && (
          <button onClick={handleSaveProgramming} className="w-full bg-green-600 text-white font-bold text-xl px-5 py-5 rounded-3xl mt-4 shrink-0 active:scale-95">
            Guardar
          </button>
        )}
      </div>
    );
  }

  if (view === 'training') {
    const activeEx = activeExercises[currentExIndex];
    const isLastEx = currentExIndex === activeExercises.length - 1;
    const currentExLogs = sessionLogs.filter(log => log.routine_exercise_id === activeEx.id);

    return (
      <div className="flex flex-col h-[100dvh] bg-black px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in fade-in">
        <header className="flex justify-between items-center mb-8 shrink-0">
          <button
            onClick={() => {
              if (sessionLogs.length > 0 && !window.confirm('¿Salir del entrenamiento? Las series ya guardadas no se pierden.')) return;
              setView('dashboard');
            }}
            className="text-gray-400 px-3 py-2 -ml-3 text-lg"
          >← Salir</button>
          <span className="text-white font-bold bg-gray-900 px-4 py-1 rounded-full text-xs border border-gray-800">EJERCICIO {currentExIndex + 1}/{activeExercises.length}</span>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 overflow-y-auto hide-scrollbar pb-10">
          <h2 className="text-4xl font-black text-white mb-1 tracking-tight break-words leading-tight">{activeEx.name}</h2>
          <p className="text-green-500 font-bold mb-1 uppercase tracking-wider">
            {editingLogId ? `EDITANDO SERIE ${currentSet}` : `SERIE ${currentSet}`}
          </p>
          {activeRoutine?.has_weekly_plan ? (
            <p className="text-gray-500 text-sm mb-8">
              <span className="text-green-400 font-bold">Semana {activeRoutine.current_week}</span> · Obj: {activeWeekTargets[activeEx.id]?.target_sets || activeEx.target_sets}s • {activeWeekTargets[activeEx.id]?.target_reps || activeEx.target_reps}r • RIR {activeWeekTargets[activeEx.id]?.target_rir || activeEx.target_rir}
            </p>
          ) : (
            <p className="text-gray-500 text-sm mb-8">Objetivo: {activeEx.target_sets}s • {activeEx.target_reps}r • RIR {activeEx.target_rir}</p>
          )}

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
                  className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${editingLogId === log.id ? 'bg-green-600/20 border-green-500' : 'bg-gray-900 border-gray-800 active:scale-95'}`}
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
    <div className="flex flex-col h-[100dvh] bg-black px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in fade-in">
      <header className="flex justify-between items-start mb-8 shrink-0 gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-black text-white tracking-tight">GymPWA</h1>
          <p className="text-sm font-medium text-gray-500 mt-1 truncate">{session.user.email}</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={handleOpenHistory} className="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold border border-gray-800 active:scale-95">📋 HISTORIAL</button>
          <button onClick={handleLogout} className="bg-transparent text-gray-600 px-4 py-1 rounded-xl text-xs font-bold active:scale-95 text-right">SALIR</button>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto space-y-6 hide-scrollbar pb-10">
        {installPromptEvent && (
          <div className="bg-green-600/10 border border-green-500/30 p-4 rounded-3xl flex items-center gap-3">
            <span className="text-2xl shrink-0" aria-hidden="true">⬇</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Instalar GymPWA</p>
              <p className="text-gray-400 text-xs truncate">Acceso rápido desde tu pantalla de inicio</p>
            </div>
            <button
              onClick={handleInstallPWA}
              className="bg-green-600 text-white font-bold px-4 py-2 rounded-xl text-sm active:scale-95 shrink-0"
            >
              Instalar
            </button>
          </div>
        )}

        <div className="bg-green-600/10 border border-green-500/30 p-4 rounded-3xl flex gap-2 items-center">
          <input
            type="text"
            placeholder="Código de rutina"
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
            className="flex-1 min-w-0 bg-black text-white px-4 py-2 rounded-xl border border-gray-800 outline-none text-base"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            onClick={handleImportRoutine}
            className="shrink-0 bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-sm active:scale-95"
          >
            Importar
          </button>
        </div>

        {routines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h3 className="text-white font-bold text-xl">Sin rutinas</h3>
            <p className="text-gray-500 text-sm mt-2">Crea una o importa la de un amigo.</p>
          </div>
        ) : (
          routines.map((routine) => {
            const daysMap = routine.routine_exercises.reduce((acc, ex) => {
              const day = ex.day_name || 'Día 1';
              if (!acc[day]) acc[day] = []; acc[day].push(ex); return acc;
            }, {});
            Object.keys(daysMap).forEach(d => daysMap[d].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
            
            return (
              <div key={routine.id} className="bg-gray-900 p-5 rounded-3xl border border-gray-800 transition-all overflow-hidden">
                <div
                  className="flex justify-between items-start gap-2 mb-3 cursor-pointer select-none"
                  onClick={() => setExpandedRoutines(prev => ({...prev, [routine.id]: !prev[routine.id]}))}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-2xl font-black text-white break-words leading-tight">{routine.name}</h3>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyShareCode(routine); }}
                      className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 -ml-2 rounded-md active:scale-95 transition-colors max-w-full truncate ${copiedCodeId === routine.id ? 'text-green-400' : 'text-green-500 active:text-green-300'}`}
                      aria-label="Copiar código de rutina"
                    >
                      {copiedCodeId === routine.id ? '✓ Copiado' : <>🔗 {routine.share_code}</>}
                    </button>
                  </div>
                  <div className="flex gap-1 items-center shrink-0">
                    <button aria-label="Programación semanal" onClick={(e) => { e.stopPropagation(); handleOpenProgramming(routine); }} className="bg-gray-800 w-10 h-10 flex items-center justify-center rounded-lg active:scale-90">📅</button>
                    <button aria-label="Editar rutina" onClick={(e) => { e.stopPropagation(); handleEditRoutine(routine); }} className="bg-gray-800 w-10 h-10 flex items-center justify-center rounded-lg active:scale-90">✏️</button>
                    <button aria-label="Borrar rutina" onClick={(e) => { e.stopPropagation(); handleDeleteRoutine(routine.id); }} className="bg-gray-800 w-10 h-10 flex items-center justify-center rounded-lg active:scale-90">🗑️</button>
                    <div className="text-gray-500 font-bold text-2xl w-5 text-center leading-none">
                      {expandedRoutines[routine.id] ? '−' : '+'}
                    </div>
                  </div>
                </div>

                {routine.has_weekly_plan && (() => {
                  const isDone = (routine.completed_weeks || []).includes(routine.current_week);
                  return (
                    <div className="mb-4 flex flex-wrap gap-2 items-center">
                      <div className={`inline-flex items-center gap-1 pl-1 pr-1 rounded-full border ${isDone ? 'bg-green-600 border-green-500 shadow-[0_0_10px_rgba(22,163,74,0.4)]' : 'bg-green-600/10 border-green-500/30'}`}>
                        <button aria-label="Semana anterior" onClick={(e) => { e.stopPropagation(); handleChangeCurrentWeek(routine, -1); }} className={`font-bold w-9 h-9 flex items-center justify-center text-base active:scale-90 ${isDone ? 'text-white' : 'text-green-400'}`}>−</button>
                        <span className={`font-bold text-[11px] px-1 whitespace-nowrap ${isDone ? 'text-white' : 'text-green-300'}`}>
                          {isDone && '✓ '}Semana {routine.current_week}/{routine.total_weeks}
                        </span>
                        <button aria-label="Semana siguiente" onClick={(e) => { e.stopPropagation(); handleChangeCurrentWeek(routine, +1); }} className={`font-bold w-9 h-9 flex items-center justify-center text-base active:scale-90 ${isDone ? 'text-white' : 'text-green-400'}`}>+</button>
                      </div>
                      {!isDone && (
                        <button onClick={(e) => { e.stopPropagation(); handleCompleteWeek(routine); }} className="bg-green-600 text-white text-[11px] font-bold px-3 py-1 rounded-full active:scale-95 shadow-[0_0_10px_rgba(22,163,74,0.25)] whitespace-nowrap">
                          ✓ Completar
                        </button>
                      )}
                    </div>
                  );
                })()}
                
                {expandedRoutines[routine.id] && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    {Object.entries(daysMap).map(([dayName, exercises]) => (
                      <div key={dayName} className="bg-black p-4 rounded-2xl border border-gray-800 flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-green-500 font-bold text-lg">{dayName}</span>
                          <span className="text-gray-600 text-xs font-bold">{exercises.length} ejercicios</span>
                        </div>
                        <div className="space-y-2 mb-4">
                          {exercises.map((ex, i) => {
                            const wt = routine.has_weekly_plan ? dashboardWeekTargets[ex.id] : null;
                            const sets = wt?.target_sets || ex.target_sets;
                            const reps = wt?.target_reps || ex.target_reps;
                            const weight = wt?.target_weight;
                            return (
                              <div key={i} className="flex justify-between items-center text-sm border-b border-gray-900 pb-1 last:border-0 last:pb-0">
                                <span className="text-gray-300 font-medium truncate pr-2">{ex.name}</span>
                                <span className="text-gray-500 text-xs whitespace-nowrap">
                                  {weight !== null && weight !== undefined && (
                                    <><span className="text-green-400 font-bold">{weight}kg</span> <span className="mx-1">·</span> </>
                                  )}
                                  {sets}s <span className="mx-1">x</span> {reps}r
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <button onClick={() => handleStartTraining(routine, exercises)} className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl active:bg-gray-700 transition-colors">
                          Empezar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <button onClick={handleOpenCreate} className="w-full bg-green-600 text-white font-bold text-lg px-5 py-5 rounded-3xl mt-4 shrink-0">+ NUEVA RUTINA</button>
    </div>
  );
}