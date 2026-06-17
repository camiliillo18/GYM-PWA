import { createClient, processLock } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Usamos processLock (lock en memoria) en lugar del navigator.locks por
    // defecto. En PWA/móvil, al irte a otra app y volver, el sistema congela
    // la página; el lock de navigator.locks que tenía cogido el contexto
    // anterior no se libera y CUALQUIER llamada a Supabase (getSession,
    // getUser, incluso las queries de datos que adjuntan el token) se queda
    // colgada para siempre → loader infinito hasta recargar. processLock evita
    // ese deadlock entre contextos sin perder la serialización dentro de la app.
    lock: processLock,
  },
});
