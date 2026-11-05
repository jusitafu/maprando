/**
 * Configuration Globale Centralisée - RandoFinder
 * Les Randonneurs Sanaryens - JLD Apps 2026
 * 
 * Identifiants Cloud Supabase & Architecture Multi-Bases
 */

window.APP_CONFIG = {
  // URL de l'instance Cloud Supabase du club
  supabaseUrl: 'https://lotoulcfncyphxarttyk.supabase.co',

  // Clé publique (Publishable Key) autorisée pour les navigateurs
  supabaseKey: 'sb_publishable_JcANA4Rpdo0qI-8PwKWH6w_CUbWQeYp',

  // Bucket de stockage public pour les fichiers GPX
  storageBucket: 'traces-gpx',

  // Synchronisation automatique activée par défaut à l'ouverture
  autoSync: true,

  // Base active par défaut à la première ouverture
  defaultDatabase: 'sanaryens',

  // Définition des bases de données disponibles
  databases: {
    sanaryens: {
      id: 'sanaryens',
      name: 'Randonneurs Sanaryens',
      label: 'Randonneurs Sanaryens (Base active)',
      badge: '🌿 Randonneurs Sanaryens',
      shortName: 'Sanaryens',
      tableName: 'randonnees_sanaryens',
      cacheKey: 'sanary_hikes_sanaryens',
      storeName: 'randonnees_sanaryens',
      isSanctuary: false,
      allowSampleData: false,
      description: 'Base officielle du club (vierge par défaut, ajouts et modifications autorisés)'
    },
    jldapps: {
      id: 'jldapps',
      name: 'Base JLDApps',
      label: 'Base JLDApps (Sanctuarisée)',
      badge: '🔒 Base JLDApps',
      shortName: 'JLDApps',
      tableName: 'randonnees',
      cacheKey: 'sanary_hikes_v20',
      storeName: 'randonnees',
      isSanctuary: true,
      allowSampleData: false,
      description: 'Base historique sanctuarisée (240 randonnées protégées en lecture seule pour les membres, accès complet pour admin)'
    }
  }
};
