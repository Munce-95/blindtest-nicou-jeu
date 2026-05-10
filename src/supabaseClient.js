import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 1. Vérification stricte des variables d'environnement
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "❌ ERREUR SUPABASE : Les variables VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY sont introuvables.\n" +
    "Assure-toi que le fichier .env est à la racine du projet et que tu as redémarré le serveur (npm run dev)."
  );
} else {
  console.log("✅ Supabase : Tentative de connexion avec l'URL :", supabaseUrl);
}

// 2. Création du client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 3. Test de connexion rapide (optionnel mais recommandé pour le debug)
supabase.from('BlindtestPlayer').select('count', { count: 'exact', head: true })
  .then(({ error }) => {
    if (error) console.error("❌ Erreur de liaison avec la table :", error.message);
    else console.log("🚀 Connexion à la base de données opérationnelle !");
  });