/* ============================================================
   EscolaPro — Configuração Supabase
   Preencha com as credenciais do seu projeto:
   https://supabase.com/dashboard/project/wwoasqjidsrplkpwjsro/settings/api
   ============================================================ */
const SUPABASE_URL  = 'https://wwoasqjidsrplkpwjsro.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_1ArtUvOrkSjOgXlDZln2EQ_5gOlLLfo';

/* Modo de armazenamento:
   'local'    → usa localStorage (funciona agora, sem internet)
   'supabase' → usa banco de dados online                      */
const STORAGE_MODE = SUPABASE_KEY === 'COLE_AQUI_O_ANON_KEY' ? 'local' : 'supabase';
