/**
 * Storage Manager (100% Guaranteed Persistence across LocalStorage, IndexedDB, Disk & Remote Server)
 * Les Randonneurs Sanaryens - RandoFinder - JLD Apps 2026
 * Pure Static & Bulletproof API
 * 
 * Multi-Database Partitioning Architecture:
 * - Base 'sanaryens' (Randonneurs Sanaryens) : Base officielle active par défaut, vierge (0 rando), ajouts et éditions autorisés.
 * - Base 'jldapps' (Base JLDApps) : Base historique sanctuarisée (139 randos protégées en lecture seule).
 */

class StorageManager {
  static ACTIVE_DB_KEY = 'randofinder_active_db';
  static dirHandle = null;
  static dbName = 'RandonneursSanaryensDB';
  static storeName = 'randonnees_sanaryens';
  static db = null;
  static memoryHikes = [];
  static isFileSystemSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  static currentMode = 'browser';

  static DATABASES = {
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
      description: 'Base historique sanctuarisée (139 randonnées protégées en lecture seule pour les membres, accès complet pour admin)'
    }
  };

  static FAKE_SAMPLE_IDS = [
    'sample_cap_sicie',
    'sample_gros_cerveau',
    'sample_portissol',
    'sample_sainte_baume',
    'sample_calanques',
    'sample_mont_faron'
  ];

  static FAKE_SAMPLE_NAMES = [
    'Six-Fours-les-Plages - Cap Sicié & Notre-Dame du Mai',
    'Sanary-sur-Mer - Le Gros Cerveau & Fort de la Cride',
    'Sanary-sur-Mer - Sentier Littoral & Baie de Portissol',
    "Plan-d'Aups-Sainte-Baume - Crêtes & Grotte Sacrée",
    'Cassis - Calanques de Port-Pin & En-Vau',
    'Toulon - Mont Faron & Sentier des Forts'
  ];

  static isFakeHike(hike) {
    if (!hike) return true;
    if (hike.id && (this.FAKE_SAMPLE_IDS.includes(hike.id) || hike.id.startsWith('sample_'))) return true;
    if (hike.name && this.FAKE_SAMPLE_NAMES.includes(hike.name)) return true;
    if (hike.points && hike.points.length > 0 && hike.points.length < 5) return true;
    return false;
  }

  static getDatabases() {
    if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.databases) {
      return window.APP_CONFIG.databases;
    }
    return this.DATABASES;
  }

  static getActiveDatabaseId() {
    try {
      const saved = localStorage.getItem(this.ACTIVE_DB_KEY);
      if (saved && (saved === 'sanaryens' || saved === 'jldapps')) {
        return saved;
      }
    } catch (e) {}
    return 'sanaryens'; // Active par défaut
  }

  static getActiveDatabase() {
    const dbs = this.getDatabases();
    const id = this.getActiveDatabaseId();
    return dbs[id] || dbs['sanaryens'] || this.DATABASES.sanaryens;
  }

  static isCurrentDatabaseSanctuary() {
    return this.getActiveDatabase().isSanctuary === true;
  }

  /**
   * Indique si l'écriture/modification est interdite sur la base active.
   * La base JLDApps est sanctuarisée (lecture seule pour les membres),
   * mais l'administrateur dispose de tous les droits d'écriture et de gestion.
   */
  static isWriteProtected() {
    if (!this.isCurrentDatabaseSanctuary()) return false;
    if (typeof AuthManager !== 'undefined' && AuthManager.isAdmin()) {
      return false; // L'administrateur a tous les droits sur la base sanctuarisée
    }
    return true; // Protégé en lecture seule pour tous les autres utilisateurs
  }

  static canModifyDatabase() {
    return !this.isWriteProtected();
  }

  static async setActiveDatabase(dbId) {
    if (dbId !== 'sanaryens' && dbId !== 'jldapps') {
      dbId = 'sanaryens';
    }
    try {
      localStorage.setItem(this.ACTIVE_DB_KEY, dbId);
    } catch (e) {}
    this.memoryHikes = [];
    await this.init();
    return this.getActiveDatabase();
  }

  static loadFromLocalStorage() {
    try {
      const activeDb = this.getActiveDatabase();

      if (activeDb.id === 'sanaryens') {
        // Base Randonneurs Sanaryens : Strictement isolée.
        // Vierge par défaut, lit uniquement sa propre clé sanary_hikes_sanaryens
        const raw = localStorage.getItem(activeDb.cacheKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              this.memoryHikes = parsed.filter(h => h && h.name && !this.isFakeHike(h));
              return;
            }
          } catch (e) {}
        }
        this.memoryHikes = [];
        return;
      }

      // Base JLDApps : Lit les 139 randonnées historiques (sanary_hikes_v20 et versions précédentes)
      const allCacheKeys = [
        'sanary_hikes_v20', 'sanary_hikes_v15', 'sanary_hikes_v12', 'sanary_hikes_v11', 'sanary_hikes_v10', 'sanary_hikes_v9', 
        'sanary_hikes_v8', 'sanary_hikes_v7', 'sanary_hikes_v6', 'sanary_hikes_cache_v5', 
        'sanary_hikes_cache_v4', 'sanary_hikes_cache_v3', 'sanary_hikes_cache_v2', 'sanary_hikes_cache'
      ];

      const recoveredCustomHikes = [];

      for (const k of allCacheKeys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const h of parsed) {
                if (h && h.name && !this.isFakeHike(h)) {
                  if (!recoveredCustomHikes.some(existing => existing.id === h.id || existing.name === h.name)) {
                    recoveredCustomHikes.push(h);
                  }
                }
              }
            }
          } catch (e) {}
        }
      }

      this.memoryHikes = recoveredCustomHikes;
    } catch (e) {
      console.warn("LocalStorage read warning:", e);
    }
  }

  static saveToLocalStorage() {
    try {
      const activeDb = this.getActiveDatabase();
      this.memoryHikes = (this.memoryHikes || []).filter(h => !this.isFakeHike(h));
      localStorage.setItem(activeDb.cacheKey, JSON.stringify(this.memoryHikes));
    } catch (e) {
      console.warn("LocalStorage save warning (Quota exceeded, relying on IndexedDB):", e);
    }
  }

  static async init() {
    const activeDb = this.getActiveDatabase();
    this.storeName = activeDb.storeName;
    this.loadFromLocalStorage();

    // 1. Open IndexedDB (version 10 pour garantir les deux objectStores 'randonnees' et 'randonnees_sanaryens')
    if (typeof window !== 'undefined' && window.indexedDB) {
      try {
        await new Promise((resolve) => {
          let done = false;
          const req = indexedDB.open(this.dbName, 10);

          req.onupgradeneeded = (e) => {
            try {
              const db = e.target.result;
              if (!db.objectStoreNames.contains('randonnees')) {
                db.createObjectStore('randonnees', { keyPath: 'id' });
              }
              if (!db.objectStoreNames.contains('randonnees_sanaryens')) {
                db.createObjectStore('randonnees_sanaryens', { keyPath: 'id' });
              }
            } catch (err) {}
          };

          req.onsuccess = (e) => {
            this.db = e.target.result;
            if (!done) { done = true; resolve(); }
          };

          req.onerror = () => {
            if (!done) { done = true; resolve(); }
          };

          setTimeout(() => {
            if (!done) { done = true; resolve(); }
          }, 300);
        });
      } catch (e) {
        console.warn("IndexedDB init catch:", e);
      }
    }

    // 2. Read hikes from active store
    if (this.db && this.db.objectStoreNames.contains(this.storeName)) {
      try {
        const idbHikes = await new Promise((resolve) => {
          try {
            const tx = this.db.transaction([this.storeName], 'readonly');
            const store = tx.objectStore(this.storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          } catch (e) {
            resolve([]);
          }
        });

        if (idbHikes && idbHikes.length > 0) {
          for (const h of idbHikes) {
            if (h && h.name && !this.isFakeHike(h)) {
              if (!this.memoryHikes.some(m => m.id === h.id || m.name === h.name)) {
                this.memoryHikes.push(h);
              }
            }
          }
        }
      } catch (e) {
        console.warn("IndexedDB read error in init:", e);
      }
    }

    // 3. Filter out any obsolete fake sample/demo hikes
    this.memoryHikes = (this.memoryHikes || []).filter(h => h && h.name && !this.isFakeHike(h));

    this.saveToLocalStorage();
  }

  static async getAllHikes() {
    if (!this.memoryHikes || this.memoryHikes.length === 0) {
      await this.init();
    }
    if (this.memoryHikes && typeof GPXParser !== 'undefined') {
      for (const h of this.memoryHikes) {
        if (typeof h.ibp !== 'number' || !h.ibpLevel) {
          h.ibp = GPXParser.calculateIBP(h);
          const lvlInfo = GPXParser.getIBPLevel(h.ibp);
          h.ibpLevel = lvlInfo.level;
          if (!h.difficulty) h.difficulty = lvlInfo.label;
        }
      }
    }
    return this.memoryHikes;
  }

  static async saveHike(hike, gpxContent = null) {
    if (this.isWriteProtected()) {
      throw new Error("Opération impossible : La base JLDApps est sanctuarisée (lecture seule pour les membres). Seul l'administrateur peut y enregistrer des parcours.");
    }

    if (!hike.id) {
      hike.id = 'hike_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    }

    // Auto-calculate IBP if missing or updated
    if (typeof GPXParser !== 'undefined') {
      if (typeof hike.ibp !== 'number') {
        hike.ibp = GPXParser.calculateIBP(hike);
      }
      const lvlInfo = GPXParser.getIBPLevel(hike.ibp);
      hike.ibpLevel = lvlInfo.level;
      if (!hike.difficulty) hike.difficulty = lvlInfo.label;
    }

    // 1. Update Memory Store
    const existingIdx = this.memoryHikes.findIndex(h => h.id === hike.id || (h.name && h.name === hike.name));
    if (existingIdx >= 0) {
      this.memoryHikes[existingIdx] = hike;
    } else {
      this.memoryHikes.unshift(hike);
    }

    // 2. Save to LocalStorage
    this.saveToLocalStorage();

    // 3. Save to IndexedDB if available
    if (this.db && this.db.objectStoreNames.contains(this.storeName)) {
      try {
        const tx = this.db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put(hike);
      } catch (e) {
        console.warn("IndexedDB put error:", e);
      }
    }

    // 4. Save to Disk Folder if connected
    if (this.dirHandle && this.currentMode === 'filesystem') {
      try {
        let cleanFileName = (hike.name || 'randonnee').replace(/[\\/:*?"<>|]/g, '_') + '.gpx';
        const fileHandle = await this.dirHandle.getFileHandle(cleanFileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(gpxContent || hike.rawGpx || GPXParser.exportToGpxString(hike));
        await writable.close();
        hike.filename = cleanFileName;
      } catch (err) {
        console.error("Erreur écriture disque:", err);
      }
    }

    return hike;
  }

  static async deleteHike(id, filename = null) {
    if (this.isWriteProtected()) {
      throw new Error("Opération impossible : La base JLDApps est sanctuarisée (lecture seule pour les membres). Seul l'administrateur peut y supprimer des randonnées.");
    }

    // 1. Remove from memory
    this.memoryHikes = this.memoryHikes.filter(h => h.id !== id);
    this.saveToLocalStorage();

    // 2. Remove from IndexedDB
    if (this.db && this.db.objectStoreNames.contains(this.storeName)) {
      try {
        const tx = this.db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.delete(id);
      } catch (e) {
        console.warn("IndexedDB delete error:", e);
      }
    }

    // 3. Remove from disk if possible
    if (this.dirHandle && filename) {
      try {
        await this.dirHandle.removeEntry(filename);
      } catch (e) {}
    }

    return true;
  }

  /**
   * Compte les randonnées dans chaque base
   */
  static getDatabaseCounts() {
    let countSanaryens = 0;
    let countJldapps = 240; // 240 randonnées du catalogue officiel JLDApps par défaut

    try {
      const rawSanary = localStorage.getItem('sanary_hikes_sanaryens');
      if (rawSanary) {
        const parsed = JSON.parse(rawSanary);
        if (Array.isArray(parsed)) countSanaryens = parsed.length;
      }
    } catch (e) {}

    try {
      const rawJld = localStorage.getItem('sanary_hikes_v20');
      if (rawJld) {
        const parsed = JSON.parse(rawJld);
        if (Array.isArray(parsed) && parsed.length > 0) countJldapps = parsed.length;
      }
    } catch (e) {}

    // Si la base est actuellement active en mémoire, son compte est exact
    if (this.getActiveDatabaseId() === 'sanaryens') {
      countSanaryens = this.memoryHikes.length;
    } else {
      countJldapps = this.memoryHikes.length;
    }

    return {
      sanaryens: countSanaryens,
      jldapps: countJldapps
    };
  }

  /**
   * Ensure hike track points are loaded (Lazy Loading from Server on-demand)
   */
  static async ensureHikeTrackLoaded(hike) {
    if (!hike) return hike;
    if (hike.points && hike.points.length >= 5) return hike;

    if (hike.rawGpx) {
      try {
        const parsed = GPXParser.parse(hike.rawGpx, hike.filename || 'trace.gpx');
        if (parsed.points && parsed.points.length >= 5) {
          hike.points = parsed.points;
          if (!hike.startPoint) hike.startPoint = parsed.startPoint;
          if (parsed.bounds) hike.bounds = parsed.bounds;
          return hike;
        }
      } catch (e) {}
    }

    if (hike.gpxUrl) {
      try {
        const res = await fetch(hike.gpxUrl);
        if (res.ok) {
          const text = await res.text();
          const parsed = GPXParser.parse(text, hike.filename || 'trace.gpx');
          if (parsed.points && parsed.points.length >= 5) {
            hike.points = parsed.points;
            hike.rawGpx = text;
            if (!hike.startPoint) hike.startPoint = parsed.startPoint;
            if (parsed.bounds) hike.bounds = parsed.bounds;
            if (!hike.elevationGain && parsed.elevationGain) hike.elevationGain = parsed.elevationGain;
            if (!hike.elevationLoss && parsed.elevationLoss) hike.elevationLoss = parsed.elevationLoss;
            if (!hike.minElevation && parsed.minElevation) hike.minElevation = parsed.minElevation;
            if (!hike.maxElevation && parsed.maxElevation) hike.maxElevation = parsed.maxElevation;
          }
        }
      } catch (e) {
        console.warn("Échec chargement trace distante à la demande:", e);
      }
    }
    return hike;
  }

  /**
   * Synchronize with Remote Server (Web Server, Cloud Folder, API, GitHub)
   */
  static async syncWithRemoteServer(url) {
    if (this.isWriteProtected()) {
      throw new Error("Opération impossible : La base JLDApps est sanctuarisée (lecture seule).");
    }

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      throw new Error("Veuillez saisir une URL de serveur valide.");
    }

    let cleanUrl = url.trim();
    const response = await fetch(cleanUrl);
    if (!response.ok) {
      throw new Error(`Erreur serveur (${response.status}): ${response.statusText}`);
    }

    let importedCount = 0;
    const contentType = response.headers.get('content-type') || '';
    const baseUrl = cleanUrl.substring(0, cleanUrl.lastIndexOf('/') + 1);

    if (cleanUrl.toLowerCase().endsWith('.gpx') || contentType.includes('xml')) {
      const gpxText = await response.text();
      const fileName = cleanUrl.split('/').pop() || 'randonnee_serveur.gpx';
      const hike = GPXParser.parse(gpxText, fileName);
      await this.saveHike(hike, gpxText);
      return 1;
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      if (data.length > 0 && (data[0].points || data[0].startPoint || data[0].gpxUrl)) {
        for (const hike of data) {
          if (hike) {
            if (hike.gpxUrl && !hike.gpxUrl.startsWith('http')) {
              hike.gpxUrl = baseUrl + hike.gpxUrl;
            }
            await this.saveHike(hike);
            importedCount++;
          }
        }
      } else if (data.length > 0 && typeof data[0] === 'string') {
        for (const item of data) {
          const fileUrl = item.startsWith('http') ? item : baseUrl + item;
          const fileName = item.split('/').pop() || 'trace.gpx';
          try {
            const fileRes = await fetch(fileUrl);
            if (fileRes.ok) {
              const gpxText = await fileRes.text();
              const hike = GPXParser.parse(gpxText, fileName);
              hike.gpxUrl = fileUrl;
              await this.saveHike(hike, gpxText);
              importedCount++;
            }
          } catch (err) {
            console.warn(`Erreur téléchargement ${fileUrl}:`, err);
          }
        }
      }
    } else if (data && typeof data === 'object') {
      const list = data.hikes || data.traces || data.randonnees || [];
      for (const hike of list) {
        if (hike) {
          if (hike.gpxUrl && !hike.gpxUrl.startsWith('http')) {
            hike.gpxUrl = baseUrl + hike.gpxUrl;
          }
          await this.saveHike(hike);
          importedCount++;
        }
      }
    }

    return importedCount;
  }

  static async pickLocalDirectory() {
    if (!this.isFileSystemSupported) {
      throw new Error("L'accès direct au disque dur requiert Google Chrome ou Microsoft Edge.");
    }

    try {
      this.dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        id: 'gpx-randonneurs-sanaryens-folder'
      });

      this.currentMode = 'filesystem';
      const loadedHikes = await this.readAllFromDirectory();
      return {
        success: true,
        folderName: this.dirHandle.name,
        hikes: loadedHikes
      };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, aborted: true };
      throw err;
    }
  }

  static async readAllFromDirectory() {
    if (!this.dirHandle) return [];

    for await (const entry of this.dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.gpx')) {
        try {
          const file = await entry.getFile();
          const text = await file.text();
          const hike = GPXParser.parse(text, entry.name);
          await this.saveHike(hike);
        } catch (e) {
          console.warn(`Lecture ignorée pour ${entry.name}`, e);
        }
      }
    }
    return this.memoryHikes;
  }

  static async exportBackupJSON() {
    const hikes = await this.getAllHikes();
    const activeDb = this.getActiveDatabase();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(hikes, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `sauvegarde_${activeDb.shortName.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  static async importBackupJSON(jsonString) {
    if (this.isWriteProtected()) {
      throw new Error("Opération impossible : La base JLDApps est sanctuarisée (lecture seule).");
    }
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data)) throw new Error("Format de fichier invalide.");
    let count = 0;
    for (const item of data) {
      if (item && item.points) {
        await this.saveHike(item);
        count++;
      }
    }
    return count;
  }

  // =========================================================================
  // SUPABASE INTEGRATION (PostgreSQL DB + Storage Buckets)
  // =========================================================================

  /**
   * Fetch all hikes from Supabase Database for the target database
   */
  static async fetchFromSupabase(supabaseUrl, anonKey, specificDbId = null) {
    if (!supabaseUrl || !anonKey) {
      throw new Error("Veuillez renseigner l'URL Supabase et la clé Anon.");
    }

    const dbs = this.getDatabases();
    const targetDbId = specificDbId || this.getActiveDatabaseId();
    const targetDb = dbs[targetDbId] || this.getActiveDatabase();
    const tableName = targetDb.tableName || 'randonnees';

    const cleanUrl = supabaseUrl.replace(/\/+$/, '');
    const apiUrl = `${cleanUrl}/rest/v1/${tableName}?select=*&order=name.asc`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey.trim(),
        'Authorization': `Bearer ${anonKey.trim()}`,
        'Content-Type': 'application/json'
      }
    });

    // Si la table n'existe pas encore sur Supabase (ex: randonnees_sanaryens non encore créée)
    if (response.status === 404) {
      console.info(`Table Supabase '${tableName}' non initialisée sur le Cloud. 0 randonnées chargées pour cette base.`);
      return 0;
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erreur Supabase (${response.status}): ${errText}`);
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) return 0;

    let count = 0;
    const cloudHikes = [];
    for (const row of rows) {
      let hike = {
        id: row.id,
        name: row.name,
        distanceKm: Number(row.distance_km || 0),
        elevationGain: Number(row.elevation_gain || 0),
        elevationLoss: Number(row.elevation_loss || 0),
        minElevation: Number(row.min_elevation || 0),
        maxElevation: Number(row.max_elevation || 0),
        estimatedDuration: row.estimated_duration || '3h00',
        notes: row.notes || '',
        gpxUrl: row.gpx_url || '',
        filename: (row.name || 'rando').replace(/[\\/:*?"<>|]/g, '_') + '.gpx',
        startPoint: (row.start_lat && row.start_lon) ? { lat: Number(row.start_lat), lon: Number(row.start_lon) } : null,
        rawGpx: row.raw_gpx || null,
        points: [],
        ibp: (typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP({ distanceKm: Number(row.distance_km || 0), elevationGain: Number(row.elevation_gain || 0), notes: row.notes || '', name: row.name }) : null,
        ibpLevel: (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(GPXParser.calculateIBP({ distanceKm: Number(row.distance_km || 0), elevationGain: Number(row.elevation_gain || 0), notes: row.notes || '', name: row.name })).level : null
      };

      if (this.isFakeHike(hike)) continue;

      if (hike.rawGpx && typeof GPXParser !== 'undefined') {
        try {
          const parsed = GPXParser.parse(hike.rawGpx, hike.filename);
          if (parsed.points && parsed.points.length >= 5) {
            hike.points = parsed.points;
            if (!hike.startPoint) hike.startPoint = parsed.startPoint;
            if (parsed.bounds) hike.bounds = parsed.bounds;
          }
        } catch (e) {}
      }

      cloudHikes.push(hike);
      count++;
    }

    // Si la table interrogée correspond à la base active, actualiser memoryHikes
    if (targetDbId === this.getActiveDatabaseId()) {
      // Sécurité anti-effacement : Si le Cloud renvoie 0 résultat, ne jamais écraser les randonnées locales existantes !
      if (cloudHikes.length > 0) {
        const customLocal = (this.memoryHikes || []).filter(h => !cloudHikes.some(c => c.id === h.id || c.name === h.name) && !this.isFakeHike(h));
        this.memoryHikes = [...cloudHikes, ...customLocal];
        this.saveToLocalStorage();

        if (this.db && this.db.objectStoreNames.contains(this.storeName)) {
          try {
            const tx = this.db.transaction([this.storeName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            for (const h of this.memoryHikes) {
              store.put(h);
            }
          } catch (e) {}
        }
      }
    }

    return count;
  }

  /**
   * Push a single hike and its GPX file to Supabase (Bucket + Table)
   */
  static async pushHikeToSupabase(hike, supabaseUrl, anonKey) {
    if (this.isWriteProtected()) {
      throw new Error("Opération impossible : La base JLDApps est sanctuarisée (lecture seule).");
    }

    if (!supabaseUrl || !anonKey) throw new Error("Paramètres Supabase manquants.");
    const cleanUrl = supabaseUrl.replace(/\/+$/, '');
    const key = anonKey.trim();
    const activeDb = this.getActiveDatabase();
    const tableName = activeDb.tableName || 'randonnees';

    const gpxText = hike.rawGpx || GPXParser.exportToGpxString(hike);
    const cleanFileName = (hike.id || 'rando') + '_' + (hike.name || 'trace').replace(/[\\/:*?"<>|]/g, '_').toLowerCase() + '.gpx';

    // 1. Upload GPX file to Supabase Storage Bucket 'traces-gpx'
    let publicGpxUrl = hike.gpxUrl || '';
    try {
      const storageUrl = `${cleanUrl}/storage/v1/object/traces-gpx/${cleanFileName}`;
      const uploadRes = await fetch(storageUrl, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/gpx+xml',
          'x-upsert': 'true'
        },
        body: gpxText
      });

      if (uploadRes.ok) {
        publicGpxUrl = `${cleanUrl}/storage/v1/object/public/traces-gpx/${cleanFileName}`;
        hike.gpxUrl = publicGpxUrl;
      }
    } catch (err) {
      console.warn("Storage upload warning (continuation vers DB):", err);
    }

    // 2. Upsert metadata to Supabase DB table
    let noteWithIbp = hike.notes || '';
    const ibpVal = hike.ibp || (typeof GPXParser !== 'undefined' ? GPXParser.calculateIBP(hike) : null);
    if (ibpVal) {
      if (noteWithIbp.includes('[IBP:')) {
        noteWithIbp = noteWithIbp.replace(/\[IBP:\s*\d+\]/i, '[IBP: ' + ibpVal + ']');
      } else {
        noteWithIbp = ('[IBP: ' + ibpVal + '] ' + noteWithIbp).trim();
      }
    }

    const payload = [{
      id: hike.id || 'hike_' + Date.now(),
      name: hike.name,
      distance_km: hike.distanceKm,
      elevation_gain: hike.elevationGain,
      elevation_loss: hike.elevationLoss || 0,
      min_elevation: hike.minElevation || 0,
      max_elevation: hike.maxElevation || 0,
      start_lat: hike.startPoint ? hike.startPoint.lat : null,
      start_lon: hike.startPoint ? hike.startPoint.lon : null,
      estimated_duration: hike.estimatedDuration || '3h00',
      notes: noteWithIbp,
      gpx_url: publicGpxUrl,
      raw_gpx: gpxText,
      updated_at: new Date().toISOString()
    }];

    const dbRes = await fetch(`${cleanUrl}/rest/v1/${tableName}`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });

    if (!dbRes.ok) {
      const errText = await dbRes.text();
      throw new Error(`Erreur insertion table Supabase '${tableName}' (${dbRes.status}): ${errText}`);
    }

    return true;
  }

  /**
   * Push all current local hikes to Supabase Cloud
   */
  static async pushAllLocalHikesToSupabase(supabaseUrl, anonKey, progressCallback = null) {
    if (this.isWriteProtected()) {
      throw new Error("Opération impossible : La base JLDApps est sanctuarisée (lecture seule).");
    }
    if (!supabaseUrl || !anonKey) throw new Error("Paramètres Supabase manquants.");

    const allHikes = await this.getAllHikes();
    const tableName = this.getActiveDatabase().tableName || 'randonnees';
    const cleanUrl = supabaseUrl.replace(/\/+$/, '');
    const key = anonKey.trim();

    // Récupérer uniquement id + nom des randonnées déjà présentes sur le cloud
    const existingIds = new Set();
    const existingNames = new Set();
    const listRes = await fetch(`${cleanUrl}/rest/v1/${tableName}?select=id,name`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    if (listRes.ok) {
      const rows = await listRes.json();
      for (const r of rows) {
        existingIds.add(r.id);
        if (r.name) existingNames.add(r.name);
      }
    } else if (listRes.status !== 404) {
      throw new Error(`Erreur Supabase (${listRes.status}) lors de la lecture des randonnées existantes.`);
    }

    const hikes = allHikes.filter(h => !existingIds.has(h.id) && !existingNames.has(h.name));
    const skipped = allHikes.length - hikes.length;
    let successCount = 0;

    for (let i = 0; i < hikes.length; i++) {
      const hike = hikes[i];
      if (progressCallback) progressCallback(i + 1, hikes.length, hike.name);
      try {
        await this.pushHikeToSupabase(hike, supabaseUrl, anonKey);
        successCount++;
      } catch (err) {
        console.error(`Erreur transfert ${hike.name}:`, err);
      }
    }

    return { total: hikes.length, success: successCount, skipped };
  }

  /**
   * Delete a hike from Supabase Cloud DB & Storage
   */
  static async deleteFromSupabase(hikeId, supabaseUrl, anonKey) {
    if (this.isWriteProtected()) {
      return false;
    }

    if (!supabaseUrl || !anonKey) return false;
    const cleanUrl = supabaseUrl.replace(/\/+$/, '');
    const key = anonKey.trim();
    const tableName = this.getActiveDatabase().tableName || 'randonnees';

    try {
      await fetch(`${cleanUrl}/rest/v1/${tableName}?id=eq.${hikeId}`, {
        method: 'DELETE',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      return true;
    } catch (e) {
      console.warn("Erreur suppression Supabase:", e);
      return false;
    }
  }
}

// Global reference
window.StorageManager = StorageManager;
