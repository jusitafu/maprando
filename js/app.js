/**
 * Main Application Controller
 * Les Randonneurs Sanaryens - RandoFinder - JLD Apps 2026
 * Comprehensive features: Search, Native Upload, Management (Edit ✏️ & Delete 🗑️ with confirmation)
 */

// Échelle de paliers de rayon de recherche (de 10 km à 20 000 km / Monde entier)
const RADIUS_STEPS = [
  10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 2500, 5000, 10000, 20000
];

class AppController {
  constructor() {
    this.allHikes = [];
    this.filteredHikes = [];
    this.selectedHike = null;
    this.isHikePinned = false;
    this.hikeToEdit = null;
    this.hikeToDelete = null;

    this.currentViewMode = 'split';
    this.currentTab = 'explorer';
    
    this.sortColumn = 'distFromOrigin';
    this.sortAsc = true;
    this.searchQuery = '';
    this.manageSearchQuery = '';

    this.pendingUploads = [];
    this.activeDuplicateGroups = [];
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  getRadiusLabel(km) {
    if (km >= 20000) return 'Monde entier 🌍';
    if (km >= 10000) return `${km.toLocaleString('fr-FR')} km (Monde)`;
    if (km >= 1000) return `${km.toLocaleString('fr-FR')} km`;
    return `${km} km`;
  }

  getStepIndexForKm(km) {
    if (!km || km <= RADIUS_STEPS[0]) return 0;
    if (km >= RADIUS_STEPS[RADIUS_STEPS.length - 1]) return RADIUS_STEPS.length - 1;
    let bestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < RADIUS_STEPS.length; i++) {
      const diff = Math.abs(RADIUS_STEPS[i] - km);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  setRadiusStep(stepIndex, autoZoomMap = true) {
    const idx = Math.max(0, Math.min(RADIUS_STEPS.length - 1, Number(stepIndex)));
    const km = RADIUS_STEPS[idx];
    const radiusSlider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-display');

    if (radiusSlider) radiusSlider.value = idx;
    if (radiusDisplay) radiusDisplay.textContent = this.getRadiusLabel(km);

    if (window.MapManagerInstance) {
      window.MapManagerInstance.setSearchRadius(km, autoZoomMap);
    }
    this.applyFiltersAndRender();
  }

  async init() {
    console.log("Démarrage de RandoFinder (v86) - Randonneurs Sanaryens...");
    window.App = this;
    window.app = this;

    // 0. Initialisation de l'authentification et session (Mode B2 - Accès Privé)
    if (typeof AuthManager !== 'undefined') {
      try {
        await AuthManager.init();
      } catch (err) {
        console.warn("Erreur AuthManager init :", err);
      }
    }
    this.checkAuthenticationState();

    // 1. Lancement immédiat de la marche des 3 randonneurs dès l'ouverture de la page
    this.playLogoMarch();

    // 2. Setup UI & Event Listeners
    try {
      this.setupEventListeners();
    } catch (e) {
      console.error("Erreur UI :", e);
    }

    // 2. Initialize Elevation Profile immediately
    try {
      if (typeof ElevationProfile !== 'undefined') {
        this.elevationProfile = new ElevationProfile('elevation-chart-container');
        window.ElevationProfileInstance = this.elevationProfile;
      }
    } catch (e) {
      console.error("Erreur profile init :", e);
    }

    // 3. Initialize Map immediately (never blocked by storage)
    try {
      if (typeof L !== 'undefined' && typeof MapManager !== 'undefined') {
        window.MapManagerInstance = new MapManager('map-view');
        window.MapManagerInstance.init();

        window.MapManagerInstance.onHikeHoverCallback = (hike) => this.handleHikeHover(hike);
        window.MapManagerInstance.onHikeHoverEndCallback = (hike) => this.handleHikeHoverEnd(hike);
        window.MapManagerInstance.onHikeSelectCallback = (hike) => this.handleHikeSelect(hike);
        window.MapManagerInstance.onSearchOriginChangeCallback = (origin) => this.handleOriginChange(origin);
        window.MapManagerInstance.onMapBackgroundClickCallback = () => {
          // Si le panneau a été épinglé au clic, le maintenir jusqu'à fermeture explicite par la croix ✕
          if (this.isHikePinned) return;
          this.deselectHike();
        };
        window.MapManagerInstance.onBaseLayerChangeCallback = (layerKey) => this.handleBaseLayerChange(layerKey);

        // Synchronisation bidirectionnelle : Le zoom/dézoom de la carte à la souris ajuste le curseur de rayon
        window.MapManagerInstance.onMapZoomChangeCallback = (zoom) => {
          if (!window.MapManagerInstance || !window.MapManagerInstance.map) return;
          if (zoom <= 3) {
            // Vue continentale / mondiale : Monde entier (20 000 km)
            const lastStep = RADIUS_STEPS.length - 1;
            const slider = document.getElementById('radius-slider');
            if (slider && parseInt(slider.value, 10) !== lastStep) {
              this.setRadiusStep(lastStep, false);
            }
            return;
          }

          const bounds = window.MapManagerInstance.map.getBounds();
          const center = bounds.getCenter();
          const northEdge = L.latLng(bounds.getNorth(), center.lng);
          const visibleRadiusKm = GPXParser.haversineDistance(center.lat, center.lng, northEdge.lat, northEdge.lng);

          const stepIdx = this.getStepIndexForKm(visibleRadiusKm);
          const slider = document.getElementById('radius-slider');
          if (slider && parseInt(slider.value, 10) !== stepIdx) {
            this.setRadiusStep(stepIdx, false); // autoZoomMap = false pour ne pas contrarier la molette
          }
        };
      }
    } catch (e) {
      console.error("Erreur map init :", e);
    }



    // Storage initialization
    try {
      await StorageManager.init();
    } catch (e) {
      console.warn("Storage init warning :", e);
    }

    // 5. Load Hikes from Storage for the Active Database
    try {
      const hikes = await StorageManager.getAllHikes();
      this.allHikes = hikes || [];
    } catch (e) {
      console.error("Erreur chargement randonnées :", e);
      this.allHikes = [];
    }

    // 6. Update UI & Database Status
    try {
      this.updateDatabaseStatusUI();
      this.applyFiltersAndRender();
      this.renderManagementList();
    } catch (e) {
      console.error("Erreur affichage :", e);
    }

    // 7. Initialize server sync preferences & auto-sync if active
    try {
      const serverUrlInput = document.getElementById('server-sync-url');
      const autoSyncChk = document.getElementById('chk-auto-sync-server');
      const savedServerUrl = localStorage.getItem('sanary_server_url') || '';
      const savedAutoSync = localStorage.getItem('sanary_server_autosync') === 'true';

      if (serverUrlInput && savedServerUrl) {
        serverUrlInput.value = savedServerUrl;
      }
      if (autoSyncChk) {
        autoSyncChk.checked = savedAutoSync;
      }

      if (savedAutoSync && savedServerUrl) {
        this.syncFromServer(savedServerUrl, true);
      }
    } catch (e) {
      console.warn("Erreur auto-sync serveur :", e);
    }

    // 8. Initialize Supabase preferences & auto-sync if active
    try {
      const supaUrlInput = document.getElementById('supabase-url');
      const supaKeyInput = document.getElementById('supabase-key');
      const supaAutoSyncChk = document.getElementById('chk-auto-sync-supabase');

      const defaultSupaUrl = (window.APP_CONFIG && window.APP_CONFIG.supabaseUrl) || 'https://lotoulcfncyphxarttyk.supabase.co';
      const defaultSupaKey = (window.APP_CONFIG && window.APP_CONFIG.supabaseKey) || 'sb_publishable_JcANA4Rpdo0qI-8PwKWH6w_CUbWQeYp';
      const savedSupaUrl = localStorage.getItem('sanary_supabase_url') || defaultSupaUrl;
      const savedSupaKey = localStorage.getItem('sanary_supabase_key') || defaultSupaKey;
      const savedSupaAutoSync = localStorage.getItem('sanary_supabase_autosync') !== 'false'; // true par défaut

      if (supaUrlInput) supaUrlInput.value = savedSupaUrl;
      if (supaKeyInput) supaKeyInput.value = savedSupaKey;
      if (supaAutoSyncChk) supaAutoSyncChk.checked = savedSupaAutoSync;

      this.updateSupabaseBadge();

      if (savedSupaAutoSync && savedSupaUrl && savedSupaKey) {
        this.syncFromSupabase(true);
      }
    } catch (e) {
      console.warn("Erreur auto-sync Supabase :", e);
    }

    console.log(`RandoFinder prêt ! ${this.allHikes.length} randonnées prêtes.`);
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // View mode switching (Map / Table / Split)
    document.querySelectorAll('[data-view-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-view-mode');
        this.setViewMode(mode);
      });
    });

    // Distance Radius Slider with immediate map adaptation and Mouse Wheel support
    const radiusSlider = document.getElementById('radius-slider');
    const radiusContainer = document.getElementById('radius-container');
    const btnWorldView = document.getElementById('btn-world-view');

    if (radiusSlider) {
      radiusSlider.addEventListener('input', (e) => {
        const stepIdx = parseInt(e.target.value, 10);
        this.setRadiusStep(stepIdx, false);
      });
      radiusSlider.addEventListener('change', (e) => {
        const stepIdx = parseInt(e.target.value, 10);
        this.setRadiusStep(stepIdx, true);
      });
    }

    // Support de la molette de la souris sur le conteneur du rayon et le slider :
    // Molette vers le haut = agrandit le rayon jusqu'à 20 000 km (Monde entier)
    // Molette vers le bas = réduit le rayon jusqu'à 10 km
    if (radiusContainer) {
      radiusContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const slider = document.getElementById('radius-slider');
        if (!slider) return;
        let currentStep = parseInt(slider.value, 10);
        if (e.deltaY < 0) {
          currentStep = Math.min(RADIUS_STEPS.length - 1, currentStep + 1);
        } else {
          currentStep = Math.max(0, currentStep - 1);
        }
        this.setRadiusStep(currentStep, true);
      }, { passive: false });
    }

    // Bouton d'accès rapide "Monde entier" (Canada, Chine...)
    if (btnWorldView) {
      btnWorldView.addEventListener('click', (e) => {
        e.preventDefault();
        this.setRadiusStep(RADIUS_STEPS.length - 1, true);
      });
    }

    // Search Location Input (High-Speed Autocomplete + Enter support)
    const locationInput = document.getElementById('location-input');
    if (locationInput) {
      let debounceTimer = null;
      locationInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        const resultsContainer = document.getElementById('location-autocomplete-results');
        if (query.length < 2) {
          if (resultsContainer) resultsContainer.classList.add('hidden');
          return;
        }

        // 1. Réponse instantanée si déjà en cache mémoire (0 ms)
        const normKey = query.toLowerCase();
        if (this.placesCache && this.placesCache.has(normKey)) {
          this.renderPlacesResults(this.placesCache.get(normKey), query);
          return;
        }

        // 2. Pré-suggestions instantanées sur les sentiers GR ou communes locales (0 ms)
        const isGr = (typeof GrManager !== 'undefined') && GrManager.isGrQuery(query);
        const localMatches = isGr ? [] : this.getLocalPlaceMatches(query);
        if (isGr || localMatches.length > 0) {
          this.renderPlacesResults(localMatches, query);
        }

        // 3. Appel réseau ultra-réactif (debounce 120 ms)
        debounceTimer = setTimeout(() => this.searchPlaces(query), 120);
      });

      locationInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const query = e.target.value.trim();
          if (query) {
            await this.searchAndSelectFirstPlace(query);
          }
        }
      });
    }

    // Fermer l'autocomplétion si clic à l'extérieur
    document.addEventListener('click', (e) => {
      const resultsContainer = document.getElementById('location-autocomplete-results');
      if (resultsContainer && locationInput && !locationInput.contains(e.target) && !resultsContainer.contains(e.target)) {
        resultsContainer.classList.add('hidden');
      }
    });

    // Geolocation button "Ma position"
    const geolocBtn = document.getElementById('btn-geoloc');
    if (geolocBtn) {
      geolocBtn.addEventListener('click', () => this.useCurrentLocation());
    }

    // Click map button
    const clickMapBtn = document.getElementById('btn-click-map');
    if (clickMapBtn) {
      clickMapBtn.addEventListener('click', () => {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.setClickMode(true);
          this.showToast("Cliquez sur la carte pour choisir le centre de recherche", "info");
        }
      });
    }

    // Recherche synchronisée dans les randonnées (barre du haut & barre au-dessus du tableau)
    const hikeSearchInput = document.getElementById('hike-search-input');
    const tableFilterInput = document.getElementById('table-filter-input');
    const btnClearTableFilter = document.getElementById('btn-clear-table-filter');

    const handleSearchInput = (val) => {
      this.searchQuery = (val || '').trim().toLowerCase();
      if (hikeSearchInput && hikeSearchInput.value !== val) hikeSearchInput.value = val;
      if (tableFilterInput && tableFilterInput.value !== val) tableFilterInput.value = val;
      if (btnClearTableFilter) {
        if (val) btnClearTableFilter.classList.remove('hidden');
        else btnClearTableFilter.classList.add('hidden');
      }
      this.applyFiltersAndRender(true);
    };

    if (hikeSearchInput) {
      hikeSearchInput.addEventListener('input', (e) => handleSearchInput(e.target.value));
    }
    if (tableFilterInput) {
      tableFilterInput.addEventListener('input', (e) => handleSearchInput(e.target.value));
    }
    if (btnClearTableFilter) {
      btnClearTableFilter.addEventListener('click', () => handleSearchInput(''));
    }

    // Manage tab search input
    const manageSearchInput = document.getElementById('manage-search-input');
    if (manageSearchInput) {
      manageSearchInput.addEventListener('input', (e) => {
        this.manageSearchQuery = e.target.value.trim().toLowerCase();
        this.renderManagementList();
      });
    }

    // Bouton et modale de recherche des doublons dans la bibliothèque
    const btnSearchDuplicates = document.getElementById('btn-search-duplicates');
    if (btnSearchDuplicates) {
      btnSearchDuplicates.addEventListener('click', () => this.handleSearchDuplicatesClick());
    }

    const btnCloseDuplicatesModal = document.getElementById('btn-close-duplicates-modal');
    if (btnCloseDuplicatesModal) {
      btnCloseDuplicatesModal.addEventListener('click', () => this.closeDuplicatesModal());
    }

    const btnCancelDuplicatesModal = document.getElementById('btn-cancel-duplicates-modal');
    if (btnCancelDuplicatesModal) {
      btnCancelDuplicatesModal.addEventListener('click', () => this.closeDuplicatesModal());
    }

    const btnApplyDuplicatesClean = document.getElementById('btn-apply-duplicates-clean');
    if (btnApplyDuplicatesClean) {
      btnApplyDuplicatesClean.addEventListener('click', () => this.executeApplyDuplicatesClean());
    }

    // Pick Local Folder (Chrome / Edge PC)
    const pickFolderBtn = document.getElementById('btn-pick-folder');
    if (pickFolderBtn) {
      pickFolderBtn.addEventListener('click', () => this.handlePickFolder());
    }

    // Storage Badge click -> open Settings
    const storageBadge = document.getElementById('storage-badge');
    if (storageBadge) {
      storageBadge.addEventListener('click', () => this.switchTab('settings'));
    }

    // Close user menu dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const userDropdown = document.getElementById('user-menu-dropdown');
      if (userDropdown && !userDropdown.classList.contains('hidden')) {
        if (!e.target.closest('#btn-user-badge') && !e.target.closest('#user-menu-dropdown')) {
          userDropdown.classList.add('hidden');
        }
      }
    });

    // Native File Input & Dropzone Setup
    const fileInput = document.getElementById('file-input');
    const dropzone = document.getElementById('upload-dropzone');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleFilesUploaded(e.target.files);
          e.target.value = ''; // Reset to allow re-uploading same file if desired
        }
      });
    }

    if (dropzone) {
      const highlightDz = (active) => {
        dropzone.classList.toggle('border-emerald-600', active);
        dropzone.classList.toggle('bg-emerald-100/80', active);
        dropzone.classList.toggle('ring-4', active);
        dropzone.classList.toggle('ring-emerald-400/40', active);
        dropzone.classList.toggle('scale-[1.01]', active);
      };
      dropzone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        highlightDz(true);
      });
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        highlightDz(true);
      });
      dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dropzone.contains(e.relatedTarget)) {
          highlightDz(false);
        }
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        highlightDz(false);
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleFilesUploaded(e.dataTransfer.files);
        }
      });
    }

    // Allow dragging & dropping GPX files directly onto the "Charger une randonnée" tab button
    const uploadTabBtn = document.querySelector('button[data-tab="upload"]');
    if (uploadTabBtn) {
      uploadTabBtn.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadTabBtn.classList.add('ring-2', 'ring-emerald-400');
      });
      uploadTabBtn.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadTabBtn.classList.remove('ring-2', 'ring-emerald-400');
      });
      uploadTabBtn.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadTabBtn.classList.remove('ring-2', 'ring-emerald-400');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.switchTab('upload');
          this.handleFilesUploaded(e.dataTransfer.files);
        }
      });
    }

    // Paste GPX Button
    const parsePasteBtn = document.getElementById('btn-parse-paste-gpx');
    if (parsePasteBtn) {
      parsePasteBtn.addEventListener('click', () => this.handlePasteGPX());
    }

    // Cloud Reload Button
    const loadSamplesBtn = document.getElementById('btn-load-samples');
    if (loadSamplesBtn) {
      loadSamplesBtn.addEventListener('click', async () => {
        await this.syncFromSupabase(false);
      });
    }

    // Server Sync Button & Auto-sync checkbox
    const syncServerBtn = document.getElementById('btn-sync-server');
    if (syncServerBtn) {
      syncServerBtn.addEventListener('click', () => {
        const urlInput = document.getElementById('server-sync-url');
        const url = urlInput ? urlInput.value.trim() : '';
        if (!url) {
          this.showToast("Veuillez saisir une URL de serveur valide", "error");
          return;
        }
        localStorage.setItem('sanary_server_url', url);
        this.syncFromServer(url, false);
      });
    }

    const autoSyncChk = document.getElementById('chk-auto-sync-server');
    if (autoSyncChk) {
      autoSyncChk.addEventListener('change', (e) => {
        localStorage.setItem('sanary_server_autosync', e.target.checked ? 'true' : 'false');
      });
    }

    // Supabase Cloud Buttons & Inputs
    const supaUrlInput = document.getElementById('supabase-url');
    const supaKeyInput = document.getElementById('supabase-key');
    const supaAutoSyncChk = document.getElementById('chk-auto-sync-supabase');

    if (supaUrlInput) {
      supaUrlInput.addEventListener('input', (e) => {
        localStorage.setItem('sanary_supabase_url', e.target.value.trim());
        this.updateSupabaseBadge();
      });
    }

    if (supaKeyInput) {
      supaKeyInput.addEventListener('input', (e) => {
        localStorage.setItem('sanary_supabase_key', e.target.value.trim());
        this.updateSupabaseBadge();
      });
    }

    if (supaAutoSyncChk) {
      supaAutoSyncChk.addEventListener('change', (e) => {
        localStorage.setItem('sanary_supabase_autosync', e.target.checked ? 'true' : 'false');
      });
    }

    const syncSupaBtn = document.getElementById('btn-sync-supabase');
    if (syncSupaBtn) {
      syncSupaBtn.addEventListener('click', () => this.syncFromSupabase(false));
    }

    const pushSupaBtn = document.getElementById('btn-push-supabase');
    if (pushSupaBtn) {
      pushSupaBtn.addEventListener('click', () => this.pushAllToSupabase());
    }

    const testSupaBtn = document.getElementById('btn-test-supabase');
    if (testSupaBtn) {
      testSupaBtn.addEventListener('click', () => this.testSupabaseConnection());
    }

    // Export / Import Backup buttons
    const exportBackupBtn = document.getElementById('btn-export-backup');
    if (exportBackupBtn) {
      exportBackupBtn.addEventListener('click', () => StorageManager.exportBackupJSON());
    }

    const importBackupInput = document.getElementById('import-backup-file');
    if (importBackupInput) {
      importBackupInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          const text = await e.target.files[0].text();
          try {
            const count = await StorageManager.importBackupJSON(text);
            this.allHikes = await StorageManager.getAllHikes();
            this.applyFiltersAndRender();
            this.renderManagementList();
            this.showToast(`${count} randonnées restaurées depuis la sauvegarde !`, "success");
          } catch (err) {
            this.showToast("Fichier de sauvegarde invalide.", "error");
          }
        }
      });
    }

    // Logo click listener (rejouer la marche des randonneurs)
    const logoFrame = document.getElementById('logo-frame');
    if (logoFrame) {
      logoFrame.addEventListener('click', () => {
        if (this._initialMarchTimer) {
          clearTimeout(this._initialMarchTimer);
          this._initialMarchTimer = null;
        }
        this.playLogoMarch();
      });
    }

    // Close preview panel button
    const closePreviewBtn = document.getElementById('btn-close-preview');
    if (closePreviewBtn) {
      closePreviewBtn.addEventListener('click', () => this.deselectHike());
    }

    // Fenêtre d'aperçu déplaçable (Draggable Preview Panel)
    this.setupDraggablePreviewPanel();

    // Stabilisation du survol du panneau d'aperçu (Option A - anti-clignotement)
    const previewPanelEl = document.getElementById('hike-preview-panel');
    if (previewPanelEl) {
      previewPanelEl.addEventListener('mouseenter', () => {
        this.isMouseOverPreview = true;
        this.cancelHoverClear();
      });
      previewPanelEl.addEventListener('mouseleave', () => {
        this.isMouseOverPreview = false;
        this.scheduleHoverClear(200);
      });
      previewPanelEl.addEventListener('mousemove', () => {
        this.isMouseOverPreview = true;
        this.cancelHoverClear();
      });
    }

    // Edit Modal: Save & Close
    const saveEditBtn = document.getElementById('btn-save-edit');
    if (saveEditBtn) {
      saveEditBtn.addEventListener('click', () => this.saveEditModal());
    }
    const closeEditBtn = document.getElementById('btn-close-edit');
    if (closeEditBtn) {
      closeEditBtn.addEventListener('click', () => this.closeEditModal());
    }

    // Delete Modal: Confirm & Close
    const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', () => this.confirmDeleteModal());
    }
    const cancelDeleteBtn = document.getElementById('btn-cancel-delete');
    if (cancelDeleteBtn) {
      cancelDeleteBtn.addEventListener('click', () => this.closeDeleteModal());
    }

    // Download Modal
    const confirmDownloadBtn = document.getElementById('btn-confirm-download');
    if (confirmDownloadBtn) {
      confirmDownloadBtn.addEventListener('click', () => this.executeDownload());
    }
    const closeModalBtn = document.getElementById('btn-close-modal');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => this.closeDownloadModal());
    }

    // Map Area Print Extract (2-click selection mode)
    
    // Mesure de Cap (Azimut) entre 2 points
    
    // Bouton d'ouverture de l'étalonnage écran
    const btnOpenCalib = document.getElementById('btn-open-screen-calib');
    if (btnOpenCalib) {
      btnOpenCalib.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.ScreenCalibManager) {
          window.ScreenCalibManager.openModal();
        }
      });
    }

    const btnMapBearing = document.getElementById('btn-map-bearing');
    if (btnMapBearing) {
      btnMapBearing.addEventListener('click', () => {
        if (!window.MapManagerInstance) return;
        if (window.MapManagerInstance.bearingMeasurementActive) {
          window.MapManagerInstance.cancelBearingMeasurement();
        } else {
          window.MapManagerInstance.startBearingMeasurement();
        }
      });
    }

    const btnCloseMapBearing = document.getElementById('btn-close-map-bearing');
    if (btnCloseMapBearing) {
      btnCloseMapBearing.addEventListener('click', () => {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.cancelBearingMeasurement();
        }
      });
    }

    const btnRestartMapBearing = document.getElementById('btn-restart-map-bearing');
    if (btnRestartMapBearing) {
      btnRestartMapBearing.addEventListener('click', () => {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.startBearingMeasurement();
        }
      });
    }

    const btnCancelMapBearing = document.getElementById('btn-cancel-map-bearing');
    if (btnCancelMapBearing) {
      btnCancelMapBearing.addEventListener('click', () => {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.clearBearingVisuals();
        }
      });
    }

    // Écouteurs pour la mesure de trajet (clics successifs)
    const btnMapMeasure = document.getElementById('btn-map-measure');
    if (btnMapMeasure) {
      btnMapMeasure.addEventListener('click', () => {
        if (!window.MapManagerInstance) return;
        window.MapManagerInstance.toggleMeasurePath();
      });
    }

    const btnCloseMapMeasure = document.getElementById('btn-close-map-measure');
    if (btnCloseMapMeasure) {
      btnCloseMapMeasure.addEventListener('click', () => {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.cancelMeasurePath();
        }
      });
    }

    const btnMeasureUndo = document.getElementById('btn-measure-undo');
    if (btnMeasureUndo) {
      btnMeasureUndo.addEventListener('click', () => {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.undoLastMeasurePoint();
        }
      });
    }

    const btnMeasureReset = document.getElementById('btn-measure-reset');
    if (btnMeasureReset) {
      btnMeasureReset.addEventListener('click', () => {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.resetMeasurePath();
        }
      });
    }

    const btnMeasureFinish = document.getElementById('btn-measure-finish');
    if (btnMeasureFinish) {
      btnMeasureFinish.addEventListener('click', () => {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.finishMeasurePath();
        }
      });
    }

    const btnMapAreaPrint = document.getElementById('btn-map-area-print');
    if (btnMapAreaPrint) {
      btnMapAreaPrint.addEventListener('click', () => {
        if (!window.MapManagerInstance) return;
        if (window.MapManagerInstance.areaSelectionActive) {
          window.MapManagerInstance.cancelAreaSelection();
        } else {
          // Conserver la randonnée affichée : son tracé GPX pourra être imprimé sur l'extrait
          this.areaPrintHike = this.selectedHike || window.MapManagerInstance.selectedHike || null;
          window.MapManagerInstance.startAreaSelection(
            (bounds) => this.openMapAreaModal(bounds),
            () => {}
          );
        }
      });
    }

    const btnCancelMapSelection = document.getElementById('btn-cancel-map-selection');
    if (btnCancelMapSelection) {
      btnCancelMapSelection.addEventListener('click', () => {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.cancelAreaSelection();
        }
      });
    }

    const btnCloseMapAreaModal = document.getElementById('btn-close-map-area-modal');
    if (btnCloseMapAreaModal) {
      btnCloseMapAreaModal.addEventListener('click', () => this.closeMapAreaModal());
    }

    const btnCancelMapArea = document.getElementById('btn-cancel-map-area');
    if (btnCancelMapArea) {
      btnCancelMapArea.addEventListener('click', () => this.closeMapAreaModal());
    }

    const btnConfirmMapAreaDownload = document.getElementById('btn-confirm-map-area-download');
    if (btnConfirmMapAreaDownload) {
      btnConfirmMapAreaDownload.addEventListener('click', () => this.executeMapAreaDownload());
    }

    // Map Legend Modal
    const btnMapLegend = document.getElementById('btn-map-legend');
    if (btnMapLegend) {
      btnMapLegend.addEventListener('click', () => this.openMapLegendModal());
    }

    const btnCloseMapLegend = document.getElementById('btn-close-map-legend-modal');
    if (btnCloseMapLegend) {
      btnCloseMapLegend.addEventListener('click', () => this.closeMapLegendModal());
    }

    // Interception absolue des soumissions de formulaires (anti-rechargement / anti-POST sur Mac et mobiles)
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleLoginSubmit();
        return false;
      });
    }

    const formChangePwd = document.getElementById('form-change-password');
    if (formChangePwd) {
      formChangePwd.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleChangePasswordSubmit();
        return false;
      });
    }

    // Click on empty space in table container deselects
    const tableCol = document.getElementById('table-column');
    if (tableCol) {
      tableCol.addEventListener('click', (e) => {
        if (e.target === tableCol || e.target.tagName === 'TBODY' || e.target.id === 'table-container') {
          this.deselectHike();
        }
      });
    }

    // Escape key closes modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const cguModal = document.getElementById('cgu-modal');
        if (cguModal && !cguModal.classList.contains('hidden')) {
          this.closeCguModal();
        }
        const legendModal = document.getElementById('map-legend-modal');
        if (legendModal && !legendModal.classList.contains('hidden')) {
          this.closeMapLegendModal();
        }
        const areaModal = document.getElementById('map-area-modal');
        if (areaModal && !areaModal.classList.contains('hidden')) {
          this.closeMapAreaModal();
        }
      }
    });
  }

  deselectHike() {
    this.selectedHike = null;
    this.isHikePinned = false;
    this.hoveredHike = null;
    this.isMouseOverPreview = false;
    this.cancelHoverClear();
    if (window.MapManagerInstance) {
      window.MapManagerInstance.hoveredHike = null;
      window.MapManagerInstance.deselectHike();
    }
    this.hideHikePreviewPanel();
    this.updateTableSelection(null);
  }

  switchTab(tabName) {
    if (tabName === 'upload' && typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_upload')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de charger des randonnées.", "error");
      return;
    }

    this.currentTab = tabName;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.classList.remove('bg-emerald-700', 'text-white', 'shadow-sm');
      btn.classList.add('text-slate-300', 'hover:bg-slate-800');
    });

    const activeContent = document.getElementById(`tab-content-${tabName}`);
    if (activeContent) activeContent.classList.remove('hidden');

    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('text-slate-300', 'hover:bg-slate-800');
      activeBtn.classList.add('bg-emerald-700', 'text-white', 'shadow-sm');
    }

    if (tabName === 'explorer') {
      setTimeout(() => {
        if (window.MapManagerInstance && window.MapManagerInstance.map) {
          window.MapManagerInstance.map.invalidateSize();
        }
      }, 100);
      this.applyFiltersAndRender();
    } else if (tabName === 'upload') {
      const authorInput = document.getElementById('upload-author-name');
      if (authorInput) {
        const loggedUser = (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser()) ? AuthManager.getCurrentUser().username : '';
        const savedAuthor = localStorage.getItem('rf_uploader_display_name') || '';
        if (!authorInput.value || authorInput.value === 'admin') {
          authorInput.value = savedAuthor || loggedUser || 'admin';
        }
        if (!authorInput._boundSave) {
          authorInput._boundSave = true;
          authorInput.addEventListener('change', () => {
            if (authorInput.value.trim()) {
              localStorage.setItem('rf_uploader_display_name', authorInput.value.trim());
            }
          });
        }
      }
    } else if (tabName === 'manage') {
      this.renderManagementList();
    }
    this.updateDatabaseStatusUI();
  }

  setViewMode(mode) {
    this.currentViewMode = mode;
    const mapCol = document.getElementById('map-column');
    const tableCol = document.getElementById('table-column');

    document.querySelectorAll('[data-view-mode]').forEach(btn => {
      btn.classList.remove('bg-emerald-600', 'text-white');
      btn.classList.add('bg-slate-100', 'text-slate-700');
    });

    const activeBtn = document.querySelector(`[data-view-mode="${mode}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('bg-slate-100', 'text-slate-700');
      activeBtn.classList.add('bg-emerald-600', 'text-white');
    }

    if (mode === 'map') {
      if (mapCol) {
        mapCol.classList.remove('hidden', 'lg:w-1/2');
        mapCol.classList.add('w-full', 'h-full');
      }
      if (tableCol) tableCol.classList.add('hidden');
    } else if (mode === 'table') {
      if (mapCol) mapCol.classList.add('hidden');
      if (tableCol) {
        tableCol.classList.remove('hidden', 'lg:w-1/2');
        tableCol.classList.add('w-full', 'h-full');
      }
    } else {
      if (mapCol) {
        mapCol.classList.remove('hidden', 'w-full');
        mapCol.classList.add('lg:w-1/2');
      }
      if (tableCol) {
        tableCol.classList.remove('hidden', 'w-full');
        tableCol.classList.add('lg:w-1/2');
      }
    }

    setTimeout(() => {
      if (window.MapManagerInstance && window.MapManagerInstance.map) {
        window.MapManagerInstance.map.invalidateSize();
      }
    }, 150);
  }

  applyFiltersAndRender(autoZoomSearchResults = false) {
    const origin = (window.MapManagerInstance && window.MapManagerInstance.searchOrigin) 
      ? window.MapManagerInstance.searchOrigin 
      : { lat: 43.1189, lon: 5.8033 };

    const radius = (window.MapManagerInstance && window.MapManagerInstance.searchRadiusKm) 
      ? window.MapManagerInstance.searchRadiusKm 
      : 100;

    const isWorldWide = radius >= 20000;

    this.filteredHikes = (this.allHikes || []).map(hike => {
      const distFromOrigin = hike.startPoint
        ? GPXParser.haversineDistance(origin.lat, origin.lon, hike.startPoint.lat, hike.startPoint.lon)
        : 9999;

      return {
        ...hike,
        distFromOrigin: Math.round(distFromOrigin * 10) / 10
      };
    }).filter(hike => {
      const matchesRadius = isWorldWide || (hike.distFromOrigin <= radius);
      const matchesQuery = !this.searchQuery || 
        hike.name.toLowerCase().includes(this.searchQuery) || 
        (hike.notes && hike.notes.toLowerCase().includes(this.searchQuery));

      // Si l'utilisateur saisit un mot-clé (ex: "Canada", "Chine", "Garibaldi"), recherche mondiale prioritaire
      if (this.searchQuery) {
        return matchesQuery;
      }

      return matchesRadius;
    });

    this.sortHikes();
    this.renderHikesTable();

    if (window.MapManagerInstance) {
      window.MapManagerInstance.renderHikeMarkers(this.filteredHikes);

      // Si recherche active par mot-clé et demandé explicitement, centrer la carte sur les résultats
      if (autoZoomSearchResults && this.searchQuery && this.filteredHikes.length > 0) {
        const validHikes = this.filteredHikes.filter(h => h.startPoint);
        if (validHikes.length > 0) {
          try {
            const bounds = L.latLngBounds(validHikes.map(h => [h.startPoint.lat, h.startPoint.lon]));
            window.MapManagerInstance.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
          } catch (e) {}
        }
      }
    }

    const activeDb = StorageManager.getActiveDatabase();
    const countEl = document.getElementById('results-count');
    if (countEl) {
      const dbTag = activeDb.isSanctuary ? ` [🔒 ${activeDb.name}]` : ` [🌿 ${activeDb.name}]`;
      if (this.searchQuery) {
        countEl.textContent = `${this.filteredHikes.length} résultat${this.filteredHikes.length > 1 ? 's' : ''} pour "${this.searchQuery}"${dbTag}`;
      } else if (isWorldWide) {
        countEl.textContent = `${this.filteredHikes.length} randonnée${this.filteredHikes.length > 1 ? 's' : ''} (Monde entier 🌍)${dbTag}`;
      } else if (radius >= 1000) {
        countEl.textContent = `${this.filteredHikes.length} randonnée${this.filteredHikes.length > 1 ? 's' : ''} à moins de ${radius.toLocaleString('fr-FR')} km${dbTag}`;
      } else {
        countEl.textContent = `${this.filteredHikes.length} randonnée${this.filteredHikes.length > 1 ? 's' : ''} à moins de ${radius} km${dbTag}`;
      }
    }

    const tableBadge = document.getElementById('table-filtered-badge');
    if (tableBadge) {
      if (this.searchQuery) {
        tableBadge.textContent = `${this.filteredHikes.length} résultat(s)`;
      } else {
        tableBadge.textContent = `${this.filteredHikes.length} rando(s)`;
      }
    }

    const manageCountBadge = document.getElementById('manage-total-count');
    if (manageCountBadge) {
      manageCountBadge.textContent = `${this.allHikes.length} randonnée(s)`;
    }
  }

  sortHikes() {
    this.filteredHikes.sort((a, b) => {
      let valA = a[this.sortColumn];
      let valB = b[this.sortColumn];

      if (this.sortColumn === 'ajoutee_par') {
        valA = (a.ajoutee_par || 'admin').toString().toLowerCase();
        valB = (b.ajoutee_par || 'admin').toString().toLowerCase();
      }

      if (this.sortColumn === 'ibp') {
        valA = (typeof a.ibp === 'number') ? a.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(a) : 0);
        valB = (typeof b.ibp === 'number') ? b.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(b) : 0);
      }

      if (this.sortColumn === 'lastHikeDate') {
        const parseDate = (d) => {
          if (!d || typeof d !== 'string') return 0;
          const parts = d.trim().split(/[\/\-\.]/);
          if (parts.length === 3) {
            let day = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10);
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            const t = new Date(year, month - 1, day).getTime();
            return isNaN(t) ? 0 : t;
          }
          return 0;
        };
        valA = parseDate(a.lastHikeDate);
        valB = parseDate(b.lastHikeDate);
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  setSort(column) {
    if (this.sortColumn === column) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = column;
      this.sortAsc = true;
    }
    this.sortHikes();
    this.renderHikesTable();
  }

  renderHikesTable() {
    const tableBody = document.getElementById('hikes-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (this.filteredHikes.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="p-8 text-center text-slate-400">
            <div class="text-3xl mb-2">🔍</div>
            <div class="font-medium text-slate-700">Aucune randonnée dans ce rayon (${window.MapManagerInstance ? window.MapManagerInstance.searchRadiusKm : 50} km)</div>
            <div class="text-xs text-slate-500 mt-1">👉 <strong>Augmentez le curseur de rayon</strong> (ex: 200 km) ou tapez une autre ville de départ pour les voir.</div>
          </td>
        </tr>
      `;
      return;
    }

    this.filteredHikes.forEach(hike => {
      const ibpVal = (typeof hike.ibp === 'number') ? hike.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(hike) : 50);
      const ibpInfo = (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(ibpVal) : { level: 3, label: 'Peu difficile', color: '#ea580c' };

      const tr = document.createElement('tr');
      tr.dataset.hikeId = hike.id;
      tr.className = 'border-b border-slate-100 hover:bg-emerald-50/70 transition-colors cursor-pointer text-sm';
      if (this.selectedHike && this.selectedHike.id === hike.id) {
        tr.classList.add('bg-emerald-50', 'border-emerald-300', 'font-semibold');
      }

      tr.innerHTML = `
        <td class="p-3 font-semibold text-slate-900 whitespace-nowrap">
          <div class="flex items-center gap-1.5 text-blue-600">
            <span class="text-xs">📍</span>
            <span>${hike.distFromOrigin} km</span>
          </div>
        </td>
        <td class="p-3">
          <div class="font-bold text-slate-800 hover:text-emerald-700 cursor-pointer group flex items-center gap-1.5 transition-colors" title="Cliquer pour afficher cette randonnée sur la carte">
            <span class="hover:underline">${hike.name}</span>
            <span class="text-xs text-emerald-600 opacity-60 group-hover:opacity-100 group-hover:scale-125 transition-all">🗺️</span>
          </div>
          ${hike.notes ? `<div class="text-xs text-slate-500 line-clamp-1 max-w-xs mt-0.5">${hike.notes}</div>` : ''}
        </td>
        <td class="p-3 text-slate-700 whitespace-nowrap">
          <span class="font-semibold">${hike.distanceKm} km</span>
        </td>
        <td class="p-3 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
            +${hike.elevationGain} m
          </span>
        </td>
        <td class="p-3 whitespace-nowrap">
          <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold shadow-2xs" style="background-color: ${ibpInfo.color}15; color: ${ibpInfo.color}; border: 1px solid ${ibpInfo.color}40;" title="Indice d'effort IBP : ${ibpVal} • Niveau ${ibpInfo.level} (${ibpInfo.label})">
            <span class="w-4 h-4 rounded text-[10px] font-black text-white flex items-center justify-center" style="background-color: ${ibpInfo.color}">${ibpInfo.level}</span>
            <span>IBP ${ibpVal}</span>
          </div>
        </td>
        <td class="p-3 whitespace-nowrap text-xs font-semibold text-slate-700">
          ${hike.lastHikeDate ? `<span class="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md border border-slate-200">${hike.lastHikeDate}</span>` : '<span class="text-slate-300 italic">-</span>'}
        </td>
        <td class="p-3 whitespace-nowrap text-xs">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200 font-bold" title="Trace GPX chargée par ${this.escapeHtml(hike.ajoutee_par || 'admin')}">
            <span>👤</span>
            <span>${this.escapeHtml(hike.ajoutee_par || 'admin')}</span>
          </span>
        </td>
        <td class="p-3 text-slate-600 whitespace-nowrap text-xs">
          ${hike.minElevation}m - ${hike.maxElevation}m
        </td>
        <td class="p-3 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1">
            ${(StorageManager.isWriteProtected() || (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_edit'))) ? '' : `
              <button class="btn-table-edit p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Modifier le nom et les notes">
                ✏️
              </button>
              <button class="btn-table-delete p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Supprimer cette randonnée">
                🗑️
              </button>
            `}
            <button class="btn-download-hike px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm transition flex items-center gap-1 ml-1" title="Télécharger GPX / Fiche PDF">
              <span>📥</span>
              <span class="hidden sm:inline">Télécharger</span>
            </button>
          </div>
        </td>
      `;

      tr.addEventListener('mouseenter', () => {
        if (!this.selectedHike || this.selectedHike.id !== hike.id) {
          this.handleHikeHover(hike);
        }
      });

      tr.addEventListener('mouseleave', () => {
        this.handleHikeHoverEnd();
      });

      tr.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.showHikeOnMap(hike);
        }
      });

      // Edit button click
      const editBtn = tr.querySelector('.btn-table-edit');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEditModal(hike);
        });
      }

      // Delete button click
      const deleteBtn = tr.querySelector('.btn-table-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openDeleteModal(hike);
        });
      }

      // Download button click
      const dlBtn = tr.querySelector('.btn-download-hike');
      if (dlBtn) {
        dlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openDownloadModal(hike);
        });
      }

      tableBody.appendChild(tr);
    });
  }

  showHikeOnMap(hike) {
    if (!hike) return;

    // 1. Si on est en mode tableau seul, basculer vers le mode split pour afficher la carte
    const wasTableMode = (this.currentViewMode === 'table');
    if (wasTableMode) {
      this.setViewMode('split');
    }

    // 2. Si on est sur un autre onglet (ex: Gérer les randos), revenir sur l'explorateur
    if (this.currentTab !== 'explorer') {
      this.switchTab('explorer');
    }

    // 3. Adapter le curseur de rayon si la randonnée est au-delà du rayon actuel
    const origin = (window.MapManagerInstance && window.MapManagerInstance.searchOrigin) 
      ? window.MapManagerInstance.searchOrigin 
      : { lat: 43.1189, lon: 5.8033 };

    if (hike.startPoint) {
      const dist = GPXParser.haversineDistance(origin.lat, origin.lon, hike.startPoint.lat, hike.startPoint.lon);
      const currentRadius = window.MapManagerInstance ? window.MapManagerInstance.searchRadiusKm : 50;
      if (dist > currentRadius) {
        const stepIdx = this.getStepIndexForKm(dist);
        this.setRadiusStep(stepIdx, false);
      }
    }

    // 4. Délai si le conteneur de carte était masqué pour s'assurer que Leaflet a ses dimensions réelles
    const delay = wasTableMode ? 100 : 0;
    setTimeout(() => {
      if (window.MapManagerInstance && window.MapManagerInstance.map) {
        window.MapManagerInstance.map.invalidateSize();
      }
      this.handleHikeSelect(hike);

      // Sur mobile, faire défiler vers la carte
      const mapCol = document.getElementById('map-column');
      if (mapCol && window.innerWidth < 1024) {
        mapCol.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, delay);
  }

  /**
   * Render Management Tab View
   */
  renderManagementList() {
    const listContainer = document.getElementById('manage-hikes-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const query = this.manageSearchQuery || '';
    const filtered = (this.allHikes || []).filter(h => 
      !query || h.name.toLowerCase().includes(query) || (h.notes && h.notes.toLowerCase().includes(query))
    );

    const countBadge = document.getElementById('manage-total-count');
    if (countBadge) {
      if (query) {
        countBadge.textContent = `${filtered.length} sur ${this.allHikes.length} randonnée(s)`;
      } else {
        countBadge.textContent = `${this.allHikes.length} randonnée(s)`;
      }
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-400">
          <div class="text-3xl mb-2">📁</div>
          <div class="font-bold text-slate-700">Aucune randonnée trouvée</div>
          <div class="text-xs text-slate-500 mt-1">Votre bibliothèque est vide ou aucun élément ne correspond à votre recherche.</div>
        </div>
      `;
      return;
    }

    const isSanctuary = StorageManager.isCurrentDatabaseSanctuary();
    const isWriteProtected = StorageManager.isWriteProtected();
    const isAdmin = typeof AuthManager !== 'undefined' && AuthManager.isAdmin();
    const canEdit = !isWriteProtected && (typeof AuthManager === 'undefined' || AuthManager.hasPermission('can_edit'));

    filtered.forEach((hike, idx) => {
      const card = document.createElement('div');
      card.className = 'bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 shadow-sm transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3';

      card.innerHTML = `
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-400">#${idx + 1}</span>
            <h4 class="text-sm sm:text-base font-bold text-slate-900 truncate">${hike.name}</h4>
          </div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
            <span class="font-medium text-emerald-700">📏 ${hike.distanceKm} km</span>
            <span class="font-medium text-emerald-700">↗️ +${hike.elevationGain}m</span>
            <span class="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded text-[11px]" style="background-color:${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).color : '#ea580c')}15; color:${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).color : '#ea580c')}; border: 1px solid ${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).color : '#ea580c')}40;">
              <span class="w-3.5 h-3.5 rounded text-[9px] font-black text-white flex items-center justify-center" style="background-color:${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).color : '#ea580c')}">${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).level : 3)}</span>
              <span>IBP ${(typeof hike.ibp === 'number') ? hike.ibp : (typeof GPXParser !== 'undefined' ? GPXParser.calculateIBP(hike) : 50)}</span>
            </span>
            <span>⛰️ ${hike.minElevation}m - ${hike.maxElevation}m</span>
            <span>⏱️ ${hike.estimatedDuration || '3h30'}</span>
            ${hike.ajoutee_par ? `<span class="text-slate-500 font-medium">👤 Par : <strong class="text-slate-700">${hike.ajoutee_par}</strong></span>` : ''}
          </div>
          ${hike.notes ? `<div class="text-xs text-slate-600 line-clamp-2 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">« ${hike.notes} »</div>` : ''}
        </div>

        <div class="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <button class="btn-manage-view px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1" title="Voir sur la carte">
            <span>🗺️</span> <span>Voir</span>
          </button>
          ${(isSanctuary && isWriteProtected) ? `
            <span class="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1 select-none" title="Base sanctuarisée en lecture seule pour les membres">
              <span>🔒</span> <span>Sanctuarisée</span>
            </span>
          ` : (canEdit ? `
            ${(isSanctuary && isAdmin) ? `
              <span class="hidden sm:inline-flex px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold items-center gap-1" title="Mode Administrateur actif sur base JLDApps">
                <span>👑</span> <span>Admin</span>
              </span>
            ` : ''}
            <button class="btn-manage-edit px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1" title="Modifier nom et notes">
              <span>✏️</span> <span>Modifier</span>
            </button>
            <button class="btn-manage-delete px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1" title="Supprimer">
              <span>🗑️</span> <span>Supprimer</span>
            </button>
          ` : '')}
        </div>
      `;

      card.querySelector('.btn-manage-view').onclick = () => {
        this.showHikeOnMap(hike);
      };

      const editBtn = card.querySelector('.btn-manage-edit');
      if (editBtn) {
        editBtn.onclick = () => this.openEditModal(hike);
      }

      const delBtn = card.querySelector('.btn-manage-delete');
      if (delBtn) {
        delBtn.onclick = () => this.openDeleteModal(hike);
      }

      listContainer.appendChild(card);
    });
  }

  // =========================================================================
  // EDIT MODAL (✏️ Crayon)
  // =========================================================================
  openEditModal(hike) {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule. Seul l'administrateur peut modifier ces parcours.", "warning");
      return;
    }
    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_edit')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de modifier des randonnées.", "error");
      return;
    }
    this.hikeToEdit = hike;
    const modal = document.getElementById('edit-hike-modal');
    if (!modal) return;

    document.getElementById('edit-hike-name').value = hike.name || '';
    document.getElementById('edit-hike-notes').value = hike.notes || '';
    const lastDateInput = document.getElementById('edit-hike-last-date');
    if (lastDateInput) {
      lastDateInput.value = hike.lastHikeDate || '';
    }
    const authorEditInput = document.getElementById('edit-hike-author');
    if (authorEditInput) {
      authorEditInput.value = hike.ajoutee_par || ((typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser()) ? AuthManager.getCurrentUser().username : 'admin');
    }
    
    const ibpInput = document.getElementById('edit-hike-ibp');
    const ibpVal = (typeof hike.ibp === 'number') ? hike.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(hike) : 50);
    if (ibpInput) {
      ibpInput.value = ibpVal;
      this.updateEditIbpBadge(ibpVal);
      ibpInput.oninput = () => this.updateEditIbpBadge(ibpInput.value);
    }
    const recalcBtn = document.getElementById('btn-recalc-ibp');
    if (recalcBtn) {
      recalcBtn.onclick = () => {
        if (typeof GPXParser !== 'undefined') {
          const recalculated = GPXParser.calculateIBP(this.hikeToEdit);
          if (ibpInput) {
            ibpInput.value = recalculated;
            this.updateEditIbpBadge(recalculated);
          }
        }
      };
    }

    modal.classList.remove('hidden');
  }

  closeEditModal() {
    const modal = document.getElementById('edit-hike-modal');
    if (modal) modal.classList.add('hidden');
    this.hikeToEdit = null;
  }

  updateEditIbpBadge(ibp) {
    const val = parseInt(ibp, 10) || 1;
    const lvlInfo = (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(val) : { level: 1, label: 'Facile', color: '#16a34a' };
    const sq = document.getElementById('edit-hike-ibp-square');
    const lbl = document.getElementById('edit-hike-ibp-label');
    if (sq) {
      sq.textContent = lvlInfo.level;
      sq.style.backgroundColor = lvlInfo.color;
    }
    if (lbl) {
      lbl.textContent = `Niveau ${lvlInfo.level} (${lvlInfo.label})`;
      lbl.style.color = lvlInfo.color;
    }
  }

  async saveEditModal() {
    if (!this.hikeToEdit) return;

    const newName = document.getElementById('edit-hike-name').value.trim();
    const newNotes = document.getElementById('edit-hike-notes').value.trim();

    if (!newName) {
      this.showToast("Le nom de la randonnée ne peut pas être vide.", "error");
      return;
    }

    this.hikeToEdit.name = newName;
    this.hikeToEdit.notes = newNotes;
    const lastDateInput = document.getElementById('edit-hike-last-date');
    if (lastDateInput) {
      this.hikeToEdit.lastHikeDate = lastDateInput.value.trim();
    }
    const authorEditInput = document.getElementById('edit-hike-author');
    if (authorEditInput && authorEditInput.value.trim()) {
      this.hikeToEdit.ajoutee_par = authorEditInput.value.trim();
    }

    const ibpInputEl = document.getElementById('edit-hike-ibp');
    if (ibpInputEl) {
      const newIbp = parseInt(ibpInputEl.value, 10);
      if (!isNaN(newIbp) && newIbp > 0) {
        this.hikeToEdit.ibp = newIbp;
        if (typeof GPXParser !== 'undefined') {
          const lvlInfo = GPXParser.getIBPLevel(newIbp);
          this.hikeToEdit.ibpLevel = lvlInfo.level;
          this.hikeToEdit.difficulty = lvlInfo.label;
        }
      }
    }

    const updatedGpx = GPXParser.exportToGpxString(this.hikeToEdit);
    await StorageManager.saveHike(this.hikeToEdit, updatedGpx);

    // Auto-update Supabase Cloud in background
    try {
      const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
      const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
      const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
      if (supaUrl && supaKey) {
        StorageManager.pushHikeToSupabase(this.hikeToEdit, supaUrl, supaKey).catch(e => console.warn("Supabase auto-edit error:", e));
      }
    } catch (e) {}

    this.closeEditModal();
    this.applyFiltersAndRender();
    this.renderManagementList();

    if (this.selectedHike && this.selectedHike.id === this.hikeToEdit.id) {
      this.showHikePreviewPanel(this.hikeToEdit);
    }

    this.showToast("Randonnée modifiée avec succès !", "success");
  }

  // =========================================================================
  // DELETE MODAL (🗑️ Corbeille avec confirmation)
  // =========================================================================
  openDeleteModal(hike) {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule. Seul l'administrateur peut supprimer des parcours de cette base.", "warning");
      return;
    }
    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_edit')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de supprimer des randonnées.", "error");
      return;
    }
    this.hikeToDelete = hike;
    const modal = document.getElementById('delete-hike-modal');
    if (!modal) return;

    const nameEl = document.getElementById('delete-modal-hike-name');
    if (nameEl) nameEl.textContent = hike.name || 'cette randonnée';
    modal.classList.remove('hidden');
  }

  closeDeleteModal() {
    const modal = document.getElementById('delete-hike-modal');
    if (modal) modal.classList.add('hidden');
    this.hikeToDelete = null;
  }

  async confirmDeleteModal() {
    if (!this.hikeToDelete) {
      this.closeDeleteModal();
      return;
    }

    const targetHike = this.hikeToDelete;
    const targetId = targetHike.id;
    const targetName = targetHike.name;
    const targetFilename = targetHike.filename;

    try {
      await StorageManager.deleteHike(targetId, targetFilename);
      this.allHikes = this.allHikes.filter(h => h.id !== targetId && h.name !== targetName);

      // Auto-delete from Supabase Cloud in background
      try {
        const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
        const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
        const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
        if (supaUrl && supaKey) {
          StorageManager.deleteFromSupabase(targetId, supaUrl, supaKey).catch(e => console.warn("Supabase auto-delete error:", e));
        }
      } catch (e) {}

      if (this.selectedHike && (this.selectedHike.id === targetId || this.selectedHike.name === targetName)) {
        this.deselectHike();
      }

      this.showToast(`Randonnée « ${targetName} » supprimée définitivement.`, "info");
    } catch (err) {
      console.error("Erreur suppression:", err);
      this.allHikes = this.allHikes.filter(h => h.id !== targetId && h.name !== targetName);
      this.showToast("Randonnée supprimée.", "info");
    } finally {
      this.closeDeleteModal();
      this.applyFiltersAndRender();
      this.renderManagementList();
    }
  }

  // =========================================================================
  // GESTION DES DOUBLONS DANS LA BIBLIOTHÈQUE
  // (Même trace, même kilométrage, même dénivelé)
  // =========================================================================

  handleSearchDuplicatesClick() {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule. Basculez sur la base Randonneurs Sanaryens pour gérer les doublons.", "warning");
      return;
    }

    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_edit') && !AuthManager.isAdmin()) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de modifier ou supprimer des randonnées.", "error");
      return;
    }

    if (!this.allHikes || this.allHikes.length < 2) {
      this.showToast("Votre bibliothèque ne contient pas assez de randonnées pour rechercher des doublons.", "info");
      return;
    }

    const groups = this.findAllDuplicateGroups();
    if (!groups || groups.length === 0) {
      this.showToast("✅ Aucun doublon détecté ! Toutes vos randonnées ont des caractéristiques ou tracés distincts.", "success");
      return;
    }

    this.activeDuplicateGroups = groups;
    this.renderDuplicatesModal();
    const modal = document.getElementById('duplicates-manager-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeDuplicatesModal() {
    const modal = document.getElementById('duplicates-manager-modal');
    if (modal) modal.classList.add('hidden');
    this.activeDuplicateGroups = [];
  }

  areHikesDuplicates(h1, h2) {
    if (!h1 || !h2 || h1.id === h2.id) return false;

    // 1. Kilométrage similaire (< 0.4 km ou < 5%)
    const d1 = Number(h1.distanceKm || 0);
    const d2 = Number(h2.distanceKm || 0);
    const diffDistKm = Math.abs(d1 - d2);
    const maxDist = Math.max(d1, d2, 1);
    const distPct = diffDistKm / maxDist;
    const isSameDist = (diffDistKm <= 0.4) || (distPct <= 0.05);
    if (!isSameDist) return false;

    // 2. Dénivelé similaire (< 35 m ou < 8%)
    const ele1 = Number(h1.elevationGain || 0);
    const ele2 = Number(h2.elevationGain || 0);
    const diffEle = Math.abs(ele1 - ele2);
    const maxEle = Math.max(ele1, ele2, 1);
    const elePct = diffEle / maxEle;
    const isSameEle = (diffEle <= 35) || (elePct <= 0.08);
    if (!isSameEle) return false;

    // 3. Départ géographique
    let distStartMeters = Infinity;
    if (h1.startPoint && h2.startPoint) {
      distStartMeters = GPXParser.haversineDistance(
        h1.startPoint.lat, h1.startPoint.lon,
        h2.startPoint.lat, h2.startPoint.lon
      ) * 1000;
    }

    // 4. Arrivée géographique (si disponible)
    let distEndMeters = Infinity;
    const p1 = h1.points || [];
    const p2 = h2.points || [];
    const end1 = h1.endPoint || (p1.length > 0 ? p1[p1.length - 1] : null);
    const end2 = h2.endPoint || (p2.length > 0 ? p2[p2.length - 1] : null);
    if (end1 && end2) {
      distEndMeters = GPXParser.haversineDistance(end1.lat, end1.lon, end2.lat, end2.lon) * 1000;
    }

    const startMatches = distStartMeters <= 450;
    const endMatches = (distEndMeters === Infinity) || (distEndMeters <= 450);

    // 5. Comparaison des coordonnées du tracé (si points disponibles)
    let trackMatches = true;
    if (p1.length >= 10 && p2.length >= 10) {
      const sampleFractions = [0.2, 0.4, 0.6, 0.8];
      let totalMinDist = 0;
      for (const frac of sampleFractions) {
        const pt1 = p1[Math.floor((p1.length - 1) * frac)];
        let minD = Infinity;
        const step = Math.max(1, Math.floor(p2.length / 30));
        for (let k = 0; k < p2.length; k += step) {
          const pt2 = p2[k];
          const d = GPXParser.haversineDistance(pt1.lat, pt1.lon, pt2.lat, pt2.lon) * 1000;
          if (d < minD) minD = d;
        }
        totalMinDist += minD;
      }
      const avgDist = totalMinDist / sampleFractions.length;
      trackMatches = avgDist <= 450;
    }

    if (startMatches && endMatches && trackMatches) {
      const dStartStr = distStartMeters !== Infinity ? ` (départ à ${Math.round(distStartMeters)} m)` : '';
      return {
        isDuplicate: true,
        reason: `Même tracé${dStartStr}, longueur équivalente (${d1} km vs ${d2} km) et dénivelé identique (+${ele1}m vs +${ele2}m).`
      };
    }

    // Cas de secours : Même nom exact et départ à moins de 1 km
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
    if (norm(h1.name) && norm(h1.name) === norm(h2.name) && distStartMeters <= 1000) {
      return {
        isDuplicate: true,
        reason: `Nom identique (« ${h1.name} »), départ proche (${Math.round(distStartMeters)} m) et métriques équivalentes.`
      };
    }

    return false;
  }

  findAllDuplicateGroups() {
    const hikes = this.allHikes || [];
    if (hikes.length < 2) return [];

    const adj = new Map();
    hikes.forEach(h => adj.set(h.id, []));
    const edgeReasons = new Map();

    for (let i = 0; i < hikes.length; i++) {
      for (let j = i + 1; j < hikes.length; j++) {
        const h1 = hikes[i];
        const h2 = hikes[j];
        const match = this.areHikesDuplicates(h1, h2);
        if (match) {
          adj.get(h1.id).push(h2.id);
          adj.get(h2.id).push(h1.id);
          const key = [h1.id, h2.id].sort().join('__');
          edgeReasons.set(key, match.reason);
        }
      }
    }

    const visited = new Set();
    const groups = [];

    for (const h of hikes) {
      if (visited.has(h.id)) continue;
      const neighbors = adj.get(h.id) || [];
      if (neighbors.length === 0) continue;

      const groupIds = [];
      const queue = [h.id];
      visited.add(h.id);

      while (queue.length > 0) {
        const currId = queue.shift();
        groupIds.push(currId);
        for (const nxt of (adj.get(currId) || [])) {
          if (!visited.has(nxt)) {
            visited.add(nxt);
            queue.push(nxt);
          }
        }
      }

      if (groupIds.length > 1) {
        const groupHikes = groupIds.map(id => hikes.find(x => x.id === id)).filter(Boolean);

        // Algorithme de pré-sélection de la randonnée la plus complète à conserver :
        const scoreHike = (hk) => {
          let score = 0;
          if (hk.notes && hk.notes.trim().length > 5) score += 50;
          if (hk.points && hk.points.length > 0) score += Math.min(30, hk.points.length / 50);
          if (hk.ajoutee_par) score += 10;
          if (/\b(bis|copie|copy|\(\d+\))\b/i.test(hk.name)) score -= 40;
          if (hk.created_at || hk.date_ajout) score += 5;
          return score;
        };

        groupHikes.sort((a, b) => scoreHike(b) - scoreHike(a));

        const first = groupHikes[0];
        const second = groupHikes[1];
        const key = [first.id, second.id].sort().join('__');
        const reason = edgeReasons.get(key) || 
          `Tracé et caractéristiques identiques (${first.distanceKm} km, +${first.elevationGain}m).`;

        groups.push({
          id: `group_${groups.length + 1}`,
          hikes: groupHikes,
          keepId: groupHikes[0].id,
          reason: reason
        });
      }
    }

    return groups;
  }

  renderDuplicatesModal() {
    const modalBody = document.getElementById('duplicates-modal-body');
    const modalSubtitle = document.getElementById('duplicates-modal-subtitle');
    const modalSummary = document.getElementById('duplicates-modal-summary');
    const applyBtn = document.getElementById('btn-apply-duplicates-clean');
    const applyBtnText = document.getElementById('btn-apply-duplicates-text');

    if (!modalBody) return;
    modalBody.innerHTML = '';

    const groups = this.activeDuplicateGroups || [];
    let totalDuplicatesToDelete = 0;
    groups.forEach(g => {
      totalDuplicatesToDelete += (g.hikes.length - 1);
    });

    if (modalSubtitle) {
      modalSubtitle.textContent = `${groups.length} groupe${groups.length > 1 ? 's' : ''} de doublons détecté${groups.length > 1 ? 's' : ''} (${totalDuplicatesToDelete} randonnée${totalDuplicatesToDelete > 1 ? 's' : ''} en trop).`;
    }

    if (modalSummary) {
      modalSummary.innerHTML = `
        <span class="font-bold text-slate-800">${groups.length}</span> groupe(s) • 
        <span class="font-bold text-rose-600">${totalDuplicatesToDelete}</span> doublon(s) à supprimer • 
        <span class="font-bold text-emerald-700">${groups.length}</span> randonnée(s) conservée(s)
      `;
    }

    if (applyBtn) {
      applyBtn.disabled = totalDuplicatesToDelete === 0;
    }
    if (applyBtnText) {
      applyBtnText.textContent = `Supprimer les ${totalDuplicatesToDelete} doublon(s) sélectionnés`;
    }

    if (groups.length === 0) {
      modalBody.innerHTML = `
        <div class="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-500">
          <div class="text-3xl mb-2">🎉</div>
          <div class="font-bold text-slate-800 text-base">Aucun doublon restant</div>
          <div class="text-xs text-slate-500 mt-1">Toutes vos randonnées sont uniques et conservées.</div>
        </div>
      `;
      return;
    }

    groups.forEach((group, gIdx) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'bg-white border-2 border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4';
      groupEl.dataset.groupId = group.id;

      const hikesHtml = group.hikes.map(hike => {
        const isKept = (hike.id === group.keepId);
        const cardBorder = isKept 
          ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/50' 
          : 'border-slate-200 bg-slate-50/60 opacity-85 hover:border-slate-300';
        
        return `
          <div class="duplicate-hike-card p-3 sm:p-4 rounded-xl border-2 transition cursor-pointer ${cardBorder}" data-hike-id="${hike.id}">
            <div class="flex items-start sm:items-center justify-between gap-3">
              <label class="flex items-start sm:items-center gap-3 cursor-pointer flex-1 min-w-0">
                <input type="radio" name="keep_${group.id}" value="${hike.id}" ${isKept ? 'checked' : ''} class="mt-0.5 sm:mt-0 w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-sm sm:text-base text-slate-900 truncate">${this.escapeHtml(hike.name)}</span>
                    ${isKept ? `
                      <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-extrabold flex items-center gap-1 select-none">
                        <span>✅</span> <span>À CONSERVER</span>
                      </span>
                    ` : `
                      <span class="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold flex items-center gap-1 select-none">
                        <span>🗑️</span> <span>SERA SUPPRIMÉE</span>
                      </span>
                    `}
                  </div>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
                    <span class="font-bold text-emerald-700">📏 ${hike.distanceKm} km</span>
                    <span class="font-bold text-emerald-700">↗️ +${hike.elevationGain}m</span>
                    <span>⛰️ ${hike.minElevation || 0}m - ${hike.maxElevation || 0}m</span>
                    <span>⏱️ ${hike.estimatedDuration || '3h30'}</span>
                    ${hike.points ? `<span>📍 ${hike.points.length} points</span>` : ''}
                    ${hike.ajoutee_par ? `<span class="font-medium text-slate-500">👤 Par : <strong class="text-slate-700">${this.escapeHtml(hike.ajoutee_par)}</strong></span>` : ''}
                  </div>
                  ${hike.notes ? `<div class="text-[11px] text-slate-600 line-clamp-2 mt-1.5 bg-white/80 p-1.5 rounded border border-slate-200/60 italic">« ${this.escapeHtml(hike.notes)} »</div>` : ''}
                </div>
              </label>

              <button type="button" class="btn-preview-dup px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1 flex-shrink-0 cursor-pointer" title="Aperçu sur la carte">
                <span>🗺️</span> <span class="hidden sm:inline">Voir</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      groupEl.innerHTML = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold">Groupe #${gIdx + 1}</span>
              <span class="text-xs sm:text-sm font-bold text-slate-800">${group.hikes.length} randonnées en doublon</span>
            </div>
            <div class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span>📌</span> <span>${this.escapeHtml(group.reason)}</span>
            </div>
          </div>
          <button type="button" class="btn-clean-single-group text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline flex items-center gap-1 self-end sm:self-auto cursor-pointer" title="Supprimer immédiatement les doublons de ce groupe uniquement">
            <span>🗑️</span> <span>Nettoyer ce groupe</span>
          </button>
        </div>

        <div class="space-y-2.5">
          ${hikesHtml}
        </div>
      `;

      // Event listener on radio & cards
      groupEl.querySelectorAll('.duplicate-hike-card').forEach(card => {
        const hikeId = card.dataset.hikeId;
        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-preview-dup')) return;
          this.setGroupKeepHike(group.id, hikeId);
        });

        const previewBtn = card.querySelector('.btn-preview-dup');
        if (previewBtn) {
          previewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const h = group.hikes.find(x => x.id === hikeId);
            if (h) {
              this.closeDuplicatesModal();
              this.showHikeOnMap(h);
              this.showToast(`Affichage du tracé de « ${h.name} » sur la carte`, "info");
            }
          });
        }
      });

      // Single group cleanup button
      const cleanGroupBtn = groupEl.querySelector('.btn-clean-single-group');
      if (cleanGroupBtn) {
        cleanGroupBtn.addEventListener('click', () => {
          this.cleanSingleDuplicateGroup(group.id);
        });
      }

      modalBody.appendChild(groupEl);
    });
  }

  setGroupKeepHike(groupId, hikeId) {
    const grp = (this.activeDuplicateGroups || []).find(g => g.id === groupId);
    if (!grp) return;
    grp.keepId = hikeId;
    this.renderDuplicatesModal();
  }

  async cleanSingleDuplicateGroup(groupId) {
    const grp = (this.activeDuplicateGroups || []).find(g => g.id === groupId);
    if (!grp) return;

    const toDelete = grp.hikes.filter(h => h.id !== grp.keepId);
    if (toDelete.length === 0) return;

    const keptHike = grp.hikes.find(h => h.id === grp.keepId);
    const confirmMsg = `Confirmez-vous la suppression de ${toDelete.length} randonnée(s) en doublon dans ce groupe ?\n\n` +
      `Randonnée conservée : « ${keptHike ? keptHike.name : ''} »\n` +
      `Randonnées supprimées : ${toDelete.map(h => '« ' + h.name + ' »').join(', ')}`;

    if (!confirm(confirmMsg)) return;

    for (const h of toDelete) {
      try {
        await StorageManager.deleteHike(h.id, h.filename);
        this.allHikes = this.allHikes.filter(x => x.id !== h.id);
        
        // Auto-delete Supabase Cloud in background
        try {
          const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
          const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
          const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
          if (supaUrl && supaKey) {
            StorageManager.deleteFromSupabase(h.id, supaUrl, supaKey).catch(e => console.warn(e));
          }
        } catch (e) {}
      } catch (err) {
        console.warn("Erreur suppression doublon :", err);
      }
    }

    this.activeDuplicateGroups = this.activeDuplicateGroups.filter(g => g.id !== groupId);
    this.applyFiltersAndRender();
    this.renderManagementList();
    this.renderDuplicatesModal();

    this.showToast(`Groupe nettoyé : ${toDelete.length} doublon(s) supprimé(s).`, "success");

    if (this.activeDuplicateGroups.length === 0) {
      setTimeout(() => this.closeDuplicatesModal(), 1200);
    }
  }

  async executeApplyDuplicatesClean() {
    const groups = this.activeDuplicateGroups || [];
    if (groups.length === 0) return;

    const allToDelete = [];
    groups.forEach(g => {
      g.hikes.forEach(h => {
        if (h.id !== g.keepId) {
          allToDelete.push(h);
        }
      });
    });

    if (allToDelete.length === 0) {
      this.showToast("Aucun doublon à supprimer.", "info");
      return;
    }

    const confirmMsg = `Confirmez-vous la suppression définitive de ${allToDelete.length} randonnée(s) en doublon ?\n\n` +
      `Les ${groups.length} randonnées choisies seront conservées.\nCette action est irréversible.`;

    if (!confirm(confirmMsg)) return;

    let deletedCount = 0;
    const deleteBtn = document.getElementById('btn-apply-duplicates-clean');
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.innerHTML = `<span>⏳</span> Suppression en cours...`;
    }

    try {
      for (const h of allToDelete) {
        try {
          await StorageManager.deleteHike(h.id, h.filename);
          this.allHikes = this.allHikes.filter(x => x.id !== h.id);
          deletedCount++;

          // Auto-delete Supabase
          try {
            const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
            const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
            const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
            if (supaUrl && supaKey) {
              StorageManager.deleteFromSupabase(h.id, supaUrl, supaKey).catch(e => console.warn(e));
            }
          } catch (e) {}
        } catch (err) {
          console.warn("Erreur suppression doublon :", err);
        }
      }

      this.closeDuplicatesModal();
      this.applyFiltersAndRender();
      this.renderManagementList();
      this.showToast(`✅ Nettoyage terminé : ${deletedCount} doublon(s) supprimé(s) avec succès !`, "success");
    } finally {
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `<span>🗑️</span> <span id="btn-apply-duplicates-text">Supprimer les doublons sélectionnés</span>`;
      }
    }
  }

  // =========================================================================
  // RESTITUTION & PREVIEWS
  // =========================================================================
  handleHikeHover(hike) {
    this.cancelHoverClear();
    if (hike) {
      this.hoveredHike = hike;
      if (window.MapManagerInstance) {
        window.MapManagerInstance.hoveredHike = hike;
        window.MapManagerInstance.displayTrack(hike, false);
      }
      this.showHikePreviewPanel(hike);
    } else {
      this.handleHikeHoverEnd();
    }
  }

  handleHikeHoverEnd() {
    this.scheduleHoverClear();
  }

  scheduleHoverClear(delayMs = 250) {
    if (this.isHikePinned) return;
    this.cancelHoverClear();
    this.hoverClearTimer = setTimeout(() => {
      if (this.isHikePinned) return;
      const previewPanel = document.getElementById('hike-preview-panel');
      const isOver = this.isMouseOverPreview || (previewPanel && previewPanel.matches && previewPanel.matches(':hover'));
      if (isOver) {
        // La souris est sur le panneau d'aperçu : on maintient l'affichage stable sans clignotement
        return;
      }

      this.hoveredHike = null;
      if (window.MapManagerInstance) {
        window.MapManagerInstance.hoveredHike = null;
      }

      if (this.selectedHike) {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.displayTrack(this.selectedHike, true);
        }
        this.showHikePreviewPanel(this.selectedHike);
      } else {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.clearTrack();
        }
        this.hideHikePreviewPanel();
      }
    }, delayMs);
  }

  cancelHoverClear() {
    if (this.hoverClearTimer) {
      clearTimeout(this.hoverClearTimer);
      this.hoverClearTimer = null;
    }
  }

  handleHikeSelect(hike) {
    if (!hike) return;
    this.cancelHoverClear();
    this.selectedHike = hike;
    if (window.MapManagerInstance) {
      window.MapManagerInstance.selectHike(hike, true, false);
    }
    this.showHikePreviewPanel(hike);
    this.updateTableSelection(hike.id);
  }

  updateTableSelection(selectedId) {
    const rows = document.querySelectorAll('#hikes-table-body tr[data-hike-id]');
    rows.forEach(tr => {
      if (selectedId && tr.dataset.hikeId === selectedId) {
        tr.classList.add('bg-emerald-50', 'border-emerald-300', 'font-semibold');
      } else {
        tr.classList.remove('bg-emerald-50', 'border-emerald-300', 'font-semibold');
      }
    });
  }

  async showHikePreviewPanel(hike) {
    const previewPanel = document.getElementById('hike-preview-panel');
    if (!previewPanel || !hike) return;

    if ((!hike.points || hike.points.length === 0) && typeof StorageManager !== 'undefined') {
      await StorageManager.ensureHikeTrackLoaded(hike);
    }

    // Assurer que le tracé a ses distances cumulées calculées
    if (hike.points && hike.points.length > 0 && typeof hike.points[0].dist === 'undefined') {
      let cumulative = 0;
      hike.points[0].dist = 0;
      for (let i = 1; i < hike.points.length; i++) {
        const p1 = hike.points[i - 1];
        const p2 = hike.points[i];
        if (typeof GPXParser !== 'undefined') {
          cumulative += GPXParser.haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
        } else {
          // Haversine direct
          const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
          const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((p1.lat * Math.PI) / 180) * Math.cos((p2.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
          cumulative += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        p2.dist = Math.round(cumulative * 100) / 100;
      }
      if (!hike.distanceKm) {
        hike.distanceKm = Math.round(cumulative * 10) / 10;
      }
    }

    // Min & Max elevation
    if ((!hike.minElevation || !hike.maxElevation) && hike.points && hike.points.length > 0) {
      let minE = Infinity, maxE = -Infinity;
      hike.points.forEach(p => {
        if (p.ele < minE) minE = p.ele;
        if (p.ele > maxE) maxE = p.ele;
      });
      if (minE !== Infinity) {
        hike.minElevation = Math.round(minE);
        hike.maxElevation = Math.round(maxE);
      }
    }

    previewPanel.classList.remove('hidden');

    // Détection immédiate si la souris se trouve déjà sous la zone d'apparition du panneau
    if (previewPanel.matches && previewPanel.matches(':hover')) {
      this.isMouseOverPreview = true;
      this.cancelHoverClear();
    }

    const distDisplay = hike.distanceKm || (hike.distance ? String(hike.distance) : '0');
    const dplusDisplay = (hike.elevationGain !== undefined) ? Math.round(hike.elevationGain) : 0;
    const dmoinsDisplay = (hike.elevationLoss !== undefined) ? Math.round(hike.elevationLoss) : 0;
    const altMin = (hike.minElevation !== undefined) ? hike.minElevation : 0;
    const altMax = (hike.maxElevation !== undefined) ? hike.maxElevation : 0;

    document.getElementById('preview-title').textContent = hike.name || 'Randonnée';
    document.getElementById('preview-dist').textContent = `${distDisplay} km`;
    document.getElementById('preview-dplus').textContent = `+${dplusDisplay}m`;
    document.getElementById('preview-dmoins').textContent = `-${dmoinsDisplay}m`;
    document.getElementById('preview-alt').textContent = `${altMin}m / ${altMax}m`;
    document.getElementById('preview-duration').textContent = hike.estimatedDuration || '3h30';
    document.getElementById('preview-notes').textContent = hike.notes || 'Aucune note enregistrée';

    const ibpVal = (typeof hike.ibp === 'number') ? hike.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(hike) : 50);
    const ibpInfo = (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(ibpVal) : { level: 3, label: 'Peu difficile', color: '#ea580c' };
    const ibpBox = document.getElementById('preview-ibp-box');
    const ibpEl = document.getElementById('preview-ibp');
    if (ibpEl && ibpBox) {
      ibpBox.style.backgroundColor = `${ibpInfo.color}15`;
      ibpBox.style.borderColor = `${ibpInfo.color}40`;
      ibpBox.style.color = ibpInfo.color;
      ibpBox.title = `Indice IBP : ${ibpVal} • Niveau ${ibpInfo.level} (${ibpInfo.label})`;
      ibpEl.innerHTML = `<span class="w-3.5 h-3.5 rounded text-[9px] font-black text-white flex items-center justify-center" style="background-color:${ibpInfo.color}">${ibpInfo.level}</span><span>${ibpVal}</span>`;
    }

    const isCarteMode = window.location.hash.startsWith('#carte') || (window.PortalRouterInstance && window.PortalRouterInstance.currentView === 'carte') || (window.portalRouter && window.portalRouter.currentView === 'carte');
    const btnDl = document.getElementById('preview-btn-download');
    if (btnDl) {
      if (isCarteMode) {
        btnDl.classList.add('hidden');
        btnDl.style.setProperty('display', 'none', 'important');
        btnDl.onclick = null;
      } else {
        btnDl.classList.remove('hidden');
        btnDl.style.removeProperty('display');
        btnDl.onclick = () => this.openDownloadModal(hike);
      }
    }

    // Assurer l'instance ElevationProfile
    if (!this.elevationProfile && typeof ElevationProfile !== 'undefined') {
      this.elevationProfile = new ElevationProfile('elevation-chart-container');
      window.ElevationProfileInstance = this.elevationProfile;
    }

    if (this.elevationProfile) {
      this.elevationProfile.render(hike, 
        (point) => { if (window.MapManagerInstance) window.MapManagerInstance.setCursorPosition(point); },
        () => { if (window.MapManagerInstance) window.MapManagerInstance.clearCursorPosition(); }
      );
    }
  }

  hideHikePreviewPanel() {
    const previewPanel = document.getElementById('hike-preview-panel');
    if (previewPanel && !this.selectedHike && !this.isHikePinned) {
      previewPanel.classList.add('hidden');
      this.isMouseOverPreview = false;
    }
  }

  /**
   * Configuration du déplacement tactile & souris de la petite fenêtre d'aperçu
   */
  setupDraggablePreviewPanel() {
    const panel = document.getElementById('hike-preview-panel');
    const container = document.getElementById('map-column');
    if (!panel || !container) return;

    // Empêcher Leaflet de capter les clics et le défilement sur le panneau
    if (typeof L !== 'undefined' && L.DomEvent) {
      L.DomEvent.disableClickPropagation(panel);
      L.DomEvent.disableScrollPropagation(panel);
    }

    const dragHandle = document.getElementById('preview-drag-handle');
    const titleHeader = panel.querySelector('.flex.items-start');
    const resetBtn = document.getElementById('btn-reset-preview-pos');

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let userMoved = false;

    // Bouton de réinitialisation vers le coin bas-gauche d'origine
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        userMoved = false;
        panel.style.left = '';
        panel.style.top = '';
        panel.style.bottom = '';
        panel.style.right = '';
        panel.style.width = '';
        resetBtn.classList.add('hidden');
      });
    }

    const onStart = (e) => {
      // Ignorer si clic sur un bouton, champ de saisie, canvas ou lien
      if (e.target.closest('button, input, select, a, canvas, #elevation-chart-container')) return;

      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      if (!userMoved) {
        initialLeft = panelRect.left - containerRect.left;
        initialTop = panelRect.top - containerRect.top;
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
        panel.style.left = `${initialLeft}px`;
        panel.style.top = `${initialTop}px`;
        panel.style.width = `${panelRect.width}px`;
      } else {
        initialLeft = panel.offsetLeft;
        initialTop = panel.offsetTop;
      }

      startX = clientX;
      startY = clientY;
      isDragging = true;
      userMoved = true;

      panel.style.transition = 'none';
      panel.classList.add('ring-2', 'ring-emerald-500/70', 'shadow-2xl');
      if (dragHandle) dragHandle.classList.add('cursor-grabbing');
      if (resetBtn) resetBtn.classList.remove('hidden');

      e.stopPropagation();
    };

    const onMove = (e) => {
      if (!isDragging) return;

      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

      const dx = clientX - startX;
      const dy = clientY - startY;

      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      const minX = 4;
      const maxX = Math.max(minX, containerRect.width - panelRect.width - 4);
      const minY = 4;
      const maxY = Math.max(minY, containerRect.height - panelRect.height - 4);

      const targetX = Math.max(minX, Math.min(maxX, initialLeft + dx));
      const targetY = Math.max(minY, Math.min(maxY, initialTop + dy));

      panel.style.left = `${targetX}px`;
      panel.style.top = `${targetY}px`;

      e.preventDefault();
      e.stopPropagation();
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      panel.style.transition = '';
      panel.classList.remove('ring-2', 'ring-emerald-500/70');
      if (dragHandle) dragHandle.classList.remove('cursor-grabbing');
    };

    // Attacher aux poignées de glissement (handle supérieur et barre de titre)
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', onStart);
      dragHandle.addEventListener('touchstart', onStart, { passive: false });
    }
    if (titleHeader) {
      titleHeader.addEventListener('mousedown', onStart);
      titleHeader.addEventListener('touchstart', onStart, { passive: false });
    }

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    // Ajuster si redimensionnement de l'écran pour rester dans la carte
    window.addEventListener('resize', () => {
      if (!userMoved || panel.classList.contains('hidden')) return;
      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const maxX = Math.max(4, containerRect.width - panelRect.width - 4);
      const maxY = Math.max(4, containerRect.height - panelRect.height - 4);
      if (panel.offsetLeft > maxX) panel.style.left = `${maxX}px`;
      if (panel.offsetTop > maxY) panel.style.top = `${maxY}px`;
    });
  }

  getLocalPlaceMatches(query) {
    const q = (query || '').toLowerCase().trim();
    if (q.length < 2) return [];

    const commonPlaces = [
      { title: "Sanary-sur-Mer", subtitle: "83110, Var, Provence-Alpes-Côte d'Azur", lat: 43.1187, lon: 5.8037, typeLabel: "Ville", icon: "🏙️" },
      { title: "Bandol", subtitle: "83150, Var, Provence-Alpes-Côte d'Azur", lat: 43.1364, lon: 5.7533, typeLabel: "Ville", icon: "🏙️" },
      { title: "Ollioules", subtitle: "83190, Var, Provence-Alpes-Côte d'Azur", lat: 43.1397, lon: 5.8481, typeLabel: "Ville", icon: "🏙️" },
      { title: "Six-Fours-les-Plages", subtitle: "83140, Var, Provence-Alpes-Côte d'Azur", lat: 43.1066, lon: 5.8396, typeLabel: "Ville", icon: "🏙️" },
      { title: "Toulon", subtitle: "83000, Var, Provence-Alpes-Côte d'Azur", lat: 43.1242, lon: 5.9280, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Seyne-sur-Mer", subtitle: "83500, Var, Provence-Alpes-Côte d'Azur", lat: 43.1009, lon: 5.8824, typeLabel: "Ville", icon: "🏙️" },
      { title: "Saint-Mandrier-sur-Mer", subtitle: "83430, Var, Provence-Alpes-Côte d'Azur", lat: 43.0789, lon: 5.9288, typeLabel: "Ville", icon: "🏙️" },
      { title: "Le Beausset", subtitle: "83330, Var, Provence-Alpes-Côte d'Azur", lat: 43.1978, lon: 5.8039, typeLabel: "Ville", icon: "🏙️" },
      { title: "Le Castellet", subtitle: "83330, Var, Provence-Alpes-Côte d'Azur", lat: 43.2036, lon: 5.7769, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Cadière-d'Azur", subtitle: "83740, Var, Provence-Alpes-Côte d'Azur", lat: 43.1956, lon: 5.7561, typeLabel: "Ville", icon: "🏙️" },
      { title: "Saint-Cyr-sur-Mer", subtitle: "83270, Var, Provence-Alpes-Côte d'Azur", lat: 43.1819, lon: 5.7142, typeLabel: "Ville", icon: "🏙️" },
      { title: "Évenos / Sainte-Anne", subtitle: "83330, Var, Provence-Alpes-Côte d'Azur", lat: 43.1664, lon: 5.8286, typeLabel: "Village", icon: "📍" },
      { title: "Signes", subtitle: "83870, Var, Provence-Alpes-Côte d'Azur", lat: 43.2922, lon: 5.8631, typeLabel: "Village", icon: "📍" },
      { title: "Cassis", subtitle: "13260, Bouches-du-Rhône", lat: 43.2144, lon: 5.5381, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Ciotat", subtitle: "13600, Bouches-du-Rhône", lat: 43.1748, lon: 5.6047, typeLabel: "Ville", icon: "🏙️" },
      { title: "Roquefort-la-Bédoule", subtitle: "13830, Bouches-du-Rhône", lat: 43.2483, lon: 5.5908, typeLabel: "Village", icon: "📍" },
      { title: "Hyères", subtitle: "83400, Var, Provence-Alpes-Côte d'Azur", lat: 43.1206, lon: 6.1286, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Valette-du-Var", subtitle: "83160, Var, Provence-Alpes-Côte d'Azur", lat: 43.1378, lon: 5.9831, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Garde", subtitle: "83130, Var, Provence-Alpes-Côte d'Azur", lat: 43.1250, lon: 6.0125, typeLabel: "Ville", icon: "🏙️" },
      { title: "Le Pradet", subtitle: "83220, Var, Provence-Alpes-Côte d'Azur", lat: 43.1064, lon: 6.0222, typeLabel: "Ville", icon: "🏙️" },
      { title: "Carqueiranne", subtitle: "83320, Var, Provence-Alpes-Côte d'Azur", lat: 43.0947, lon: 6.0747, typeLabel: "Ville", icon: "🏙️" },
      { title: "Solliès-Pont", subtitle: "83210, Var, Provence-Alpes-Côte d'Azur", lat: 43.1906, lon: 6.0411, typeLabel: "Ville", icon: "🏙️" },
      { title: "Cuers", subtitle: "83390, Var, Provence-Alpes-Côte d'Azur", lat: 43.2375, lon: 6.0717, typeLabel: "Ville", icon: "🏙️" },
      { title: "Marseille", subtitle: "13000, Bouches-du-Rhône", lat: 43.2965, lon: 5.3698, typeLabel: "Ville", icon: "🏙️" },
      { title: "Aubagne", subtitle: "13400, Bouches-du-Rhône", lat: 43.2928, lon: 5.5708, typeLabel: "Ville", icon: "🏙️" },
      { title: "Cap Sicié / Notre-Dame du Mai", subtitle: "Massif côtier, Six-Fours / La Seyne", lat: 43.0578, lon: 5.8569, typeLabel: "Massif", icon: "⛰️" },
      { title: "Mont Faron", subtitle: "Sommet & Belvédère, Toulon", lat: 43.1539, lon: 5.9525, typeLabel: "Sommet", icon: "⛰️" },
      { title: "Le Croupatier", subtitle: "Barre rocheuse, Ollioules / Evenos", lat: 43.1611, lon: 5.8614, typeLabel: "Massif", icon: "⛰️" },
      { title: "Gros Cerveau", subtitle: "Crête panoramique, Ollioules / Sanary", lat: 43.1528, lon: 5.8194, typeLabel: "Massif", icon: "⛰️" }
    ];

    return commonPlaces
      .filter(p => p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q))
      .map(p => ({
        ...p,
        shortName: p.title,
        displayName: `${p.title} (${p.subtitle})`,
        isAddress: false
      }));
  }

  async fetchPlacesList(query, signal) {
    const cleanQuery = (query || '').trim();
    if (cleanQuery.length < 2) return [];

    const normKey = cleanQuery.toLowerCase();
    if (!this.placesCache) this.placesCache = new Map();
    if (this.placesCache.has(normKey)) {
      return this.placesCache.get(normKey);
    }

    const hasDigits = /\d/.test(cleanQuery);

    // Fonction d'aide pour générer l'émoji du drapeau national (ISO 3166-1 alpha-2)
    const getCountryFlag = (code) => {
      if (!code || typeof code !== 'string' || code.length !== 2) return '';
      try {
        const cp = code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
        return String.fromCodePoint(...cp);
      } catch (e) {
        return '';
      }
    };

    // 1. RECHERCHE MONDIALE DE TOUTES LES VILLES DU MONDE (Open-Meteo Geocoding API - 3M+ villes, sans clé, temps de réponse <100ms)
    const openMeteoPromise = (async () => {
      try {
        const omController = new AbortController();
        const omTimer = setTimeout(() => omController.abort(), 2500);
        const onAbort = () => omController.abort();
        if (signal) signal.addEventListener('abort', onAbort, { once: true });

        const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=10&language=fr&format=json`;
        const res = await fetch(u, { signal: omController.signal });
        clearTimeout(omTimer);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (res.ok) {
          const data = await res.json();
          return (data.results || []).map(r => {
            const flag = getCountryFlag(r.country_code);
            const country = r.country || '';
            const admin = r.admin1 || r.admin2 || '';
            const subParts = [admin, country].filter(Boolean);
            const subtitle = subParts.join(', ');
            const isCapital = r.feature_code === 'PPLC';
            const isPeak = ['PK', 'MT', 'HLL', 'VLC'].includes(r.feature_code);

            const icon = isPeak ? '⛰️' : (isCapital ? '🏛️' : '🏙️');
            let typeLabel = 'Ville';
            if (isPeak) typeLabel = 'Sommet';
            else if (isCapital) typeLabel = country ? `Capitale • ${country}` : 'Capitale';
            else if (country) typeLabel = `Ville • ${country}`;

            return {
              lat: r.latitude,
              lon: r.longitude,
              title: r.name,
              subtitle: subtitle,
              shortName: r.name,
              displayName: subtitle ? `${r.name} (${subtitle})` : r.name,
              icon: flag ? `${flag} ${icon}` : icon,
              typeLabel: typeLabel,
              country: country,
              countryCode: r.country_code,
              population: r.population || 0,
              isAddress: false,
              isCity: true,
              isCapital: isCapital,
              score: (isCapital ? 220 : 120) + (r.population ? Math.min(100, Math.log10(r.population) * 15) : 0)
            };
          });
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn("Erreur Open-Meteo Geocoding :", e);
      }
      return [];
    })();

    // 2. BASE ADRESSE NATIONALE (BAN) POUR ADRESSES ET RUES DE FRANCE
    const banPromise = (async () => {
      try {
        const banController = new AbortController();
        const banTimer = setTimeout(() => banController.abort(), 2000);
        const onAbort = () => banController.abort();
        if (signal) signal.addEventListener('abort', onAbort, { once: true });

        const bUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(cleanQuery)}&limit=6`;
        const bRes = await fetch(bUrl, { signal: banController.signal });
        clearTimeout(banTimer);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (bRes.ok) {
          const bData = await bRes.json();
          return (bData.features || [])
            .filter(f => f.properties && (f.properties.score > 0.35 || (hasDigits && f.properties.type === 'housenumber')))
            .map(f => {
              const props = f.properties || {};
              const type = props.type || 'locality';
              let icon = '📍';
              let typeLabel = 'Lieu';
              let score = 50;
              if (type === 'housenumber') {
                icon = '🏠';
                typeLabel = 'Adresse';
                score = hasDigits ? 280 : 70;
              } else if (type === 'street') {
                icon = '🛣️';
                typeLabel = 'Rue';
                score = hasDigits ? 220 : 80;
              } else if (type === 'municipality') {
                icon = '🏙️';
                typeLabel = 'Ville • France';
                score = 130;
              }

              const title = props.name || props.label;
              const subtitle = [props.postcode, props.city, props.context].filter(Boolean).join(', ');

              return {
                lat: f.geometry.coordinates[1],
                lon: f.geometry.coordinates[0],
                title: title,
                subtitle: subtitle,
                shortName: props.label || title,
                displayName: subtitle ? `${title} (${subtitle})` : title,
                icon: `🇫🇷 ${icon}`,
                typeLabel: typeLabel,
                country: 'France',
                countryCode: 'FR',
                isAddress: type === 'housenumber',
                isCity: type === 'municipality',
                isCapital: false,
                score: score
              };
            });
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn("Erreur BAN :", e);
      }
      return [];
    })();

    // 3. PHOTON / KOMOOT (OPENSTREETMAP MONDIAL - Sommets, Parcs, Villes et Lieux mondiaux)
    const photonPromise = (async () => {
      try {
        const phController = new AbortController();
        const phTimer = setTimeout(() => phController.abort(), 2200);
        const onAbort = () => phController.abort();
        if (signal) signal.addEventListener('abort', onAbort, { once: true });

        const pUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=6&lang=fr`;
        const pRes = await fetch(pUrl, { signal: phController.signal });
        clearTimeout(phTimer);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (pRes.ok) {
          const pData = await pRes.json();
          return (pData.features || []).map(f => {
            const p = f.properties || {};
            const flag = getCountryFlag(p.countrycode);
            const isPeak = p.osm_value === 'peak' || p.osm_key === 'natural';
            const isCity = ['city', 'town', 'village', 'capital'].includes(p.osm_value);
            const icon = isPeak ? '⛰️' : (isCity ? '🏙️' : '📍');
            const sub = [p.state, p.country].filter(Boolean).join(', ');

            return {
              lat: f.geometry.coordinates[1],
              lon: f.geometry.coordinates[0],
              title: p.name,
              subtitle: sub,
              shortName: p.name,
              displayName: sub ? `${p.name} (${sub})` : p.name,
              icon: flag ? `${flag} ${icon}` : icon,
              typeLabel: isPeak ? 'Sommet' : (p.country ? `Lieu • ${p.country}` : 'Lieu'),
              country: p.country,
              countryCode: p.countrycode,
              isAddress: Boolean(p.housenumber),
              isCity: isCity,
              isCapital: p.osm_value === 'capital',
              score: isPeak ? 95 : (isCity ? 85 : 45)
            };
          });
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn("Erreur Photon :", e);
      }
      return [];
    })();

    // Exécution parallèle des sources
    const [omSettled, banSettled, phSettled] = await Promise.allSettled([
      openMeteoPromise,
      banPromise,
      photonPromise
    ]);

    const omItems = (omSettled.status === 'fulfilled' && omSettled.value) ? omSettled.value : [];
    const banItems = (banSettled.status === 'fulfilled' && banSettled.value) ? banSettled.value : [];
    const phItems = (phSettled.status === 'fulfilled' && phSettled.value) ? phSettled.value : [];

    const candidates = [...omItems, ...banItems, ...phItems];

    // Attribution des scores de pertinence textuelle
    const qLower = normKey;
    candidates.forEach(item => {
      const tLower = (item.title || '').toLowerCase();
      if (tLower === qLower) {
        item.score += 500; // Correspondance exacte du nom (ex: "Rome" -> Rome, Italie)
      } else if (tLower.startsWith(qLower)) {
        item.score += 250;
      } else if (tLower.includes(qLower)) {
        item.score += 50;
      }
      if (hasDigits && item.isAddress) {
        item.score += 300;
      }
    });

    // Tri par score de pertinence décroissant
    candidates.sort((a, b) => b.score - a.score);

    // Déduplication géographique
    const combined = [];
    candidates.forEach(p => {
      if (!p.title || isNaN(p.lat) || isNaN(p.lon)) return;
      const exists = combined.some(c => {
        const sameTitle = c.title.toLowerCase() === p.title.toLowerCase();
        const distKm = GPXParser.haversineDistance(c.lat, c.lon, p.lat, p.lon);
        return (sameTitle && distKm < 50) || distKm < 8;
      });
      if (!exists) {
        combined.push(p);
      }
    });

    const finalResults = combined.slice(0, 10);
    this.placesCache.set(normKey, finalResults);
    return finalResults;
  }

  renderPlacesResults(places, query) {
    const resultsContainer = document.getElementById('location-autocomplete-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '';

    // Recherche GR : tous les GR via OpenStreetMap (tracé réel)
    if (typeof GrManager !== 'undefined' && GrManager.isGrQuery(query)) {
      GrManager.renderResults(resultsContainer, query, (it) => {
        const locationInput = document.getElementById('location-input');
        if (locationInput) locationInput.value = `${it.ref}${it.name && it.name !== it.ref ? ' - ' + it.name : ''}`;
      });
      return;
    }

    const namedTrails = (typeof GrManager !== 'undefined' && Array.isArray(this._lastNamedTrails))
      ? this._lastNamedTrails
      : [];

    if ((!places || places.length === 0) && namedTrails.length === 0) {
      resultsContainer.innerHTML = `
        <div class="p-3.5 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
          <span>🌍</span> Aucun lieu trouvé dans le monde pour "<b>${this.escapeHtml(query)}</b>"
        </div>`;
      resultsContainer.classList.remove('hidden');
      return;
    }

    resultsContainer.classList.remove('hidden');
    if (namedTrails.length > 0 && typeof GrManager !== 'undefined') {
      GrManager.appendTrailItemsToContainer(resultsContainer, namedTrails, (it) => {
        const locationInput = document.getElementById('location-input');
        if (locationInput) locationInput.value = `${it.ref ? it.ref + ' - ' : ''}${it.name || ''}`;
      });
    }
    (places || []).forEach(place => {
      const item = document.createElement('div');
      item.className = 'px-3.5 py-2.5 hover:bg-emerald-50 cursor-pointer transition border-b border-slate-100 last:border-b-0 flex items-start gap-3 text-left group';
      
      const isCap = place.isCapital || (place.typeLabel && place.typeLabel.includes('Capitale'));
      const isCity = place.isCity || (place.typeLabel && place.typeLabel.includes('Ville'));
      const isPeak = place.typeLabel && (place.typeLabel.includes('Sommet') || place.typeLabel.includes('Massif'));

      const badgeColor = place.isAddress 
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : isCap
        ? 'bg-purple-100 text-purple-800 border-purple-200 font-bold'
        : isCity
        ? 'bg-sky-100 text-sky-800 border-sky-200'
        : isPeak
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold'
        : 'bg-slate-100 text-slate-700 border-slate-200';

      item.innerHTML = `
        <span class="text-base select-none mt-0.5 group-hover:scale-110 transition-transform">${place.icon || '📍'}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-xs sm:text-sm text-slate-800 truncate group-hover:text-emerald-700">${this.escapeHtml(place.title)}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full border ${badgeColor} select-none whitespace-nowrap">${place.typeLabel || 'Lieu'}</span>
          </div>
          ${place.subtitle ? `<div class="text-[11px] text-slate-500 truncate mt-0.5">${this.escapeHtml(place.subtitle)}</div>` : ''}
        </div>
      `;
      
      item.addEventListener('click', () => {
        this.applySelectedPlace(place.lat, place.lon, place.displayName || place.title, place.isAddress);
      });
      resultsContainer.appendChild(item);
    });
  }

  async searchPlaces(query) {
    if (this.placesAbortController) {
      this.placesAbortController.abort();
    }
    this.placesAbortController = new AbortController();
    const signal = this.placesAbortController.signal;

    const iconEl = document.getElementById('location-search-icon');
    if (iconEl) iconEl.innerHTML = '<span class="animate-spin inline-block">⏳</span>';

    try {
      // 1. Afficher d'abord immédiatement les lieux locaux si correspondance (0 ms)
      const localMatches = this.getLocalPlaceMatches(query);
      if (localMatches.length > 0) {
        this.renderPlacesResults(localMatches, query);
      }

      // 2. Recherche mondiale (Open-Meteo + BAN + Photon) + Sentiers réputés (Francigena, WHW, Stevenson...)
      const namedPromise = (typeof GrManager !== 'undefined' && GrManager.searchNamedTrails && query.trim().length >= 3)
        ? GrManager.searchNamedTrails(query).catch(() => [])
        : Promise.resolve([]);
      const [places, namedTrails] = await Promise.all([
        this.fetchPlacesList(query, signal),
        namedPromise
      ]);
      this._lastNamedTrails = namedTrails || [];
      
      // Fusionner avec les suggestions locales si pertinentes
      const combined = [...places];
      (localMatches || []).forEach(local => {
        const exists = combined.some(c => 
          (c.title && c.title.toLowerCase() === local.title.toLowerCase()) ||
          (Math.abs(c.lat - local.lat) < 0.05 && Math.abs(c.lon - local.lon) < 0.05)
        );
        if (!exists) {
          if (local.title.toLowerCase() === query.toLowerCase().trim()) {
            combined.unshift(local);
          } else {
            combined.push(local);
          }
        }
      });

      this.renderPlacesResults(combined, query);
    } catch (e) {
      if (e.name !== 'AbortError') console.warn("Erreur recherche lieu mondial :", e);
    } finally {
      if (iconEl) iconEl.textContent = '📍';
    }
  }

  applySelectedPlace(lat, lon, label, isAddress = false) {
    const locationInput = document.getElementById('location-input');
    const resultsContainer = document.getElementById('location-autocomplete-results');
    if (locationInput) locationInput.value = label;
    if (resultsContainer) resultsContainer.classList.add('hidden');
    if (window.MapManagerInstance) {
      window.MapManagerInstance.setSearchOrigin(lat, lon, label, false);
    }
    this.applyFiltersAndRender(false);
    
    // Zoom sur le lieu : niveau rue pour une adresse (16), niveau ville sinon (12)
    const zoom = (isAddress || /\d/.test(label || '')) ? 16 : 12;
    const zoomToPlace = () => {
      const m = window.MapManagerInstance && window.MapManagerInstance.map;
      if (m) m.setView([lat, lon], zoom);
    };
    zoomToPlace();
    setTimeout(zoomToPlace, 150);
  }

  async searchAndSelectFirstPlace(query) {
    const iconEl = document.getElementById('location-search-icon');
    if (iconEl) iconEl.innerHTML = '<span class="animate-spin inline-block">⏳</span>';
    try {
      if (typeof GrManager !== 'undefined' && (GrManager.isGrQuery(query) || (GrManager.isNamedTrailQuery && GrManager.isNamedTrailQuery(query)))) {
        const trails = GrManager.isGrQuery(query) ? await GrManager.searchRemote(query) : await GrManager.searchNamedTrails(query);
        if (trails && trails.length > 0) {
          const resultsContainer = document.getElementById('location-autocomplete-results');
          if (resultsContainer) resultsContainer.classList.add('hidden');
          await GrManager.displayRemote(trails[0], window.MapManagerInstance ? window.MapManagerInstance.map : null);
          return;
        }
      }
      const places = await this.fetchPlacesList(query);
      if (places && places.length > 0) {
        const p = places[0];
        this.applySelectedPlace(p.lat, p.lon, p.displayName || p.title, p.isAddress);
        this.showToast(`Point de référence défini : ${p.displayName || p.title}`, "success");
      } else {
        this.showToast(`Aucun lieu mondial trouvé pour "${query}"`, "error");
      }
    } finally {
      if (iconEl) iconEl.textContent = '📍';
    }
  }

  useCurrentLocation() {
    if (!navigator.geolocation) {
      this.showToast("La géolocalisation n'est pas supportée par votre navigateur", "error");
      return;
    }

    this.showToast("Recherche de votre position GPS...", "info");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const placeName = await GPXParser.reverseGeocode(lat, lon);
        const locInput = document.getElementById('location-input');
        if (locInput) locInput.value = placeName || 'Ma position';

        // Si le rayon était en mode "Monde entier" (>= 2500 km), rétablir le rayon local par défaut (100 km)
        if (window.MapManagerInstance && window.MapManagerInstance.searchRadiusKm >= 2500) {
          this.setRadiusStep(this.getStepIndexForKm(100), false);
        }

        if (window.MapManagerInstance) {
          window.MapManagerInstance.setSearchOrigin(lat, lon, placeName || 'Ma position', false);
        }

        this.applyFiltersAndRender(false);

        // Afficher immédiatement le lieu où on se trouve avec le zoom maximal
        if (window.MapManagerInstance) {
          window.MapManagerInstance.zoomToLocation(lat, lon);
          setTimeout(() => {
            if (window.MapManagerInstance) {
              window.MapManagerInstance.zoomToLocation(lat, lon);
            }
          }, 150);
        }

        this.showToast(`Position trouvée : ${placeName || 'Ma position'}`, "success");
      },
      (err) => {
        console.warn("Erreur géolocalisation GPS :", err);
        this.showToast("Impossible d'accéder à votre position GPS.", "error");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  handleOriginChange(origin) {
    const locInput = document.getElementById('location-input');
    if (locInput) locInput.value = origin.name;
    this.applyFiltersAndRender();
  }

  async handlePickFolder() {
    try {
      const res = await StorageManager.pickLocalDirectory();
      if (res && res.success) {
        this.allHikes = await StorageManager.getAllHikes();
        this.updateStorageBadge();
        this.applyFiltersAndRender();
        this.renderManagementList();
        this.showToast(`Dossier connecté : ${res.folderName} (${res.hikes.length} randonnées)`, "success");
      }
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  /**
   * Bascule dynamique de la base de données active
   * (Randonneurs Sanaryens / Base JLDApps sanctuarisée)
   */
  async handleDatabaseChange(dbId) {
    if (dbId !== 'sanaryens' && dbId !== 'jldapps') {
      dbId = 'sanaryens';
    }

    this.showToast("Bascule de base de données en cours...", "info");

    try {
      await StorageManager.setActiveDatabase(dbId);

      // Si autoSync Supabase est configuré, tenter de rafraîchir en tâche de fond pour cette base
      try {
        const supaUrl = (document.getElementById('supabase-url')?.value || localStorage.getItem('sanary_supabase_url') || (window.APP_CONFIG && window.APP_CONFIG.supabaseUrl) || '').trim();
        const supaKey = (document.getElementById('supabase-key')?.value || localStorage.getItem('sanary_supabase_key') || (window.APP_CONFIG && window.APP_CONFIG.supabaseKey) || '').trim();
        const supaAutoSync = localStorage.getItem('sanary_supabase_autosync') !== 'false';
        if (supaAutoSync && supaUrl && supaKey) {
          await StorageManager.fetchFromSupabase(supaUrl, supaKey, dbId);
        }
      } catch (syncErr) {
        console.warn("Sync background au changement de base :", syncErr);
      }

      this.allHikes = await StorageManager.getAllHikes();

      // Désélectionner toute randonnée affichée
      this.deselectHike();

      // Nettoyer les marqueurs de la carte
      try {
        if (window.MapManagerInstance) {
          if (typeof window.MapManagerInstance.clearMarkers === 'function') {
            window.MapManagerInstance.clearMarkers();
          } else if (window.MapManagerInstance.markersLayer) {
            window.MapManagerInstance.markersLayer.clearLayers();
          }
        }
      } catch (mapErr) {
        console.warn("Nettoyage marqueurs :", mapErr);
      }

      // Réactualiser tous les affichages
      this.applyPermissionGuards();
      this.applyFiltersAndRender();
      this.renderManagementList();
      this.updateDatabaseStatusUI();

      if (dbId === 'sanaryens') {
        this.showToast(`🌿 Base Randonneurs Sanaryens active (${this.allHikes.length} rando${this.allHikes.length > 1 ? 's' : ''})`, "success");
      } else {
        const isAdmin = typeof AuthManager !== 'undefined' && AuthManager.isAdmin();
        if (isAdmin) {
          this.showToast(`👑 Base JLDApps active (${this.allHikes.length} randos) — Mode Admin : Pleins droits actifs`, "success");
        } else {
          this.showToast(`🔒 Base JLDApps active (${this.allHikes.length} randonnées sanctuarisées en lecture seule)`, "info");
        }
      }
    } catch (err) {
      console.error("Erreur bascule base :", err);
      this.showToast(`Erreur lors de la bascule : ${err.message}`, "error");
    }
  }

  /**
   * Mise à jour de l'ensemble des indicateurs de base de données dans l'interface
   */
  updateDatabaseStatusUI() {
    const activeDbId = StorageManager.getActiveDatabaseId();
    const isSanctuary = StorageManager.isCurrentDatabaseSanctuary();
    const isWriteProtected = StorageManager.isWriteProtected();
    const isAdmin = typeof AuthManager !== 'undefined' && AuthManager.isAdmin();
    const counts = StorageManager.getDatabaseCounts();

    // 1. Synchroniser toutes les listes déroulantes de choix de base
    ['header-db-selector', 'admin-db-selector', 'settings-db-selector'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = activeDbId;
    });

    // 2. Mettre à jour les badges de comptage dans le modal admin
    const sanaryCountEl = document.getElementById('count-db-sanaryens');
    if (sanaryCountEl) {
      sanaryCountEl.textContent = `${counts.sanaryens} rando${counts.sanaryens > 1 ? 's' : ''}`;
    }

    const jldCountEl = document.getElementById('count-db-jldapps');
    if (jldCountEl) {
      jldCountEl.textContent = `${counts.jldapps} rando${counts.jldapps > 1 ? 's' : ''}`;
    }

    // 3. Mettre à jour les styles des cartes dans le modal admin
    const cardSanary = document.getElementById('card-db-sanaryens');
    const badgeSanary = document.getElementById('badge-status-sanaryens');
    const cardJld = document.getElementById('card-db-jldapps');
    const badgeJld = document.getElementById('badge-status-jldapps');

    if (activeDbId === 'sanaryens') {
      if (cardSanary) {
        cardSanary.className = 'p-3.5 rounded-xl border-2 border-emerald-400 bg-emerald-950/60 shadow-md space-y-2 transition ring-2 ring-emerald-500/30';
      }
      if (badgeSanary) {
        badgeSanary.textContent = 'Active 🌿';
        badgeSanary.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950';
      }
      if (cardJld) {
        cardJld.className = 'p-3.5 rounded-xl border border-slate-700 bg-slate-900/50 space-y-2 opacity-80 hover:opacity-100 transition';
      }
      if (badgeJld) {
        badgeJld.textContent = isAdmin ? 'Sanctuarisée (Accès Admin) 👑' : 'Sanctuarisée 🔒';
        badgeJld.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40';
      }
    } else {
      if (cardSanary) {
        cardSanary.className = 'p-3.5 rounded-xl border border-slate-700 bg-slate-900/50 space-y-2 opacity-80 hover:opacity-100 transition';
      }
      if (badgeSanary) {
        badgeSanary.textContent = 'En attente';
        badgeSanary.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300';
      }
      if (cardJld) {
        cardJld.className = isAdmin
          ? 'p-3.5 rounded-xl border-2 border-emerald-400 bg-emerald-950/40 shadow-md space-y-2 transition ring-2 ring-emerald-500/30'
          : 'p-3.5 rounded-xl border-2 border-amber-400 bg-amber-950/40 shadow-md space-y-2 transition ring-2 ring-amber-500/30';
      }
      if (badgeJld) {
        badgeJld.textContent = isAdmin ? 'Active (Admin : Pleins droits) 👑' : 'Active (Sanctuarisée) 🔒';
        badgeJld.className = isAdmin
          ? 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950'
          : 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950';
      }
    }

    // 4. Bannières d'avertissement dans l'upload et la gestion
    const uploadBanner = document.getElementById('sanctuary-upload-banner');
    if (uploadBanner) {
      if (isSanctuary) {
        uploadBanner.classList.remove('hidden');
        if (isAdmin) {
          uploadBanner.className = 'p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-emerald-950 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in';
          uploadBanner.innerHTML = `
            <div class="flex items-start sm:items-center gap-3">
              <span class="text-2xl flex-shrink-0">👑</span>
              <div>
                <div class="font-bold text-xs sm:text-sm text-emerald-900">Base JLDApps — Mode Administrateur (Droits d'écriture complets)</div>
                <div class="text-[11px] sm:text-xs text-emerald-800 mt-0.5">Vous êtes connecté en tant qu'administrateur : vous pouvez importer de nouveaux parcours GPX sur la base JLDApps.</div>
              </div>
            </div>
            <button type="button" onclick="App.handleDatabaseChange('sanaryens')" class="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex-shrink-0 shadow-sm">
              🌿 Basculer sur Sanaryens
            </button>
          `;
        } else {
          uploadBanner.className = 'p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in';
          uploadBanner.innerHTML = `
            <div class="flex items-start sm:items-center gap-3">
              <span class="text-2xl flex-shrink-0">🔒</span>
              <div>
                <div class="font-bold text-xs sm:text-sm">Base JLDApps sanctuarisée (Lecture seule)</div>
                <div class="text-[11px] sm:text-xs text-amber-800 mt-0.5">L'importation de nouveaux fichiers GPX est verrouillée pour protéger l'historique des 139 randonnées. Seul l'administrateur peut y apporter des modifications.</div>
              </div>
            </div>
            <button type="button" onclick="App.handleDatabaseChange('sanaryens')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex-shrink-0 shadow-sm">
              🌿 Basculer sur Randonneurs Sanaryens
            </button>
          `;
        }
      } else {
        uploadBanner.classList.add('hidden');
      }
    }

    const manageBanner = document.getElementById('sanctuary-manage-banner');
    if (manageBanner) {
      if (isSanctuary) {
        manageBanner.classList.remove('hidden');
        if (isAdmin) {
          manageBanner.className = 'p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-emerald-950 shadow-sm flex items-start sm:items-center gap-3 animate-in fade-in';
          manageBanner.innerHTML = `
            <span class="text-2xl flex-shrink-0">👑</span>
            <div>
              <div class="font-bold text-xs sm:text-sm text-emerald-900">Base JLDApps — Mode Administrateur (Droits de gestion complets)</div>
              <div class="text-[11px] sm:text-xs text-emerald-800 mt-0.5">En tant qu'administrateur, vous avez accès à tous les droits d'édition (nom, notes) et de suppression sur la base JLDApps.</div>
            </div>
          `;
        } else {
          manageBanner.className = 'p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 shadow-sm flex items-start sm:items-center gap-3 animate-in fade-in';
          manageBanner.innerHTML = `
            <span class="text-2xl flex-shrink-0">🔒</span>
            <div>
              <div class="font-bold text-xs sm:text-sm">Base JLDApps sanctuarisée (Consultation seule)</div>
              <div class="text-[11px] sm:text-xs text-amber-800 mt-0.5">La modification et la suppression de parcours sont réservées à l'administrateur pour protéger l'intégrité de l'historique des 139 randonnées.</div>
            </div>
          `;
        }
      } else {
        manageBanner.classList.add('hidden');
      }
    }

    // 5. Description dans l'onglet options
    const settingsDesc = document.getElementById('settings-db-description');
    if (settingsDesc) {
      if (activeDbId === 'sanaryens') {
        settingsDesc.innerHTML = `<span class="font-bold text-emerald-700">🌿 Base active : Randonneurs Sanaryens</span> (${counts.sanaryens} randonnée${counts.sanaryens > 1 ? 's' : ''} enregistrée${counts.sanaryens > 1 ? 's' : ''}). Les ajouts de traces GPX et les modifications de parcours sont autorisés.`;
      } else {
        if (isAdmin) {
          settingsDesc.innerHTML = `<span class="font-bold text-amber-700">🔒 Base active : Base JLDApps</span> (${counts.jldapps} randonnées). <span class="text-emerald-700 font-semibold">Mode Administrateur actif : vous disposez de tous les droits d'écriture et de gestion.</span>`;
        } else {
          settingsDesc.innerHTML = `<span class="font-bold text-amber-700">🔒 Base active : Base JLDApps</span> (${counts.jldapps} randonnées). Cette base historique est protégée en lecture seule pour préserver les 139 circuits. Seul l'administrateur peut y apporter des modifications.`;
        }
      }
    }

    // 6. Actualiser le badge de stockage
    this.updateStorageBadge();
  }

  updateStorageBadge() {
    const badge = document.getElementById('storage-badge');
    if (!badge) return;

    if (StorageManager.currentMode === 'filesystem' && StorageManager.dirHandle) {
      badge.innerHTML = `
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="font-bold text-xs text-emerald-300">📁 Disque : ${StorageManager.dirHandle.name}</span>
      `;
      badge.className = "flex items-center gap-2 px-3 py-1.5 bg-emerald-950/80 border border-emerald-500/50 rounded-full text-emerald-300 text-xs cursor-pointer hover:brightness-125 transition shadow-sm";
      badge.title = "Dossier local connecté sur votre disque dur. Cliquez pour modifier ou gérer.";
    } else {
      badge.innerHTML = `
        <span class="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
        <span class="font-semibold text-xs text-slate-200">💾 Stockage Interne</span>
      `;
      badge.className = "flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-300 text-xs cursor-pointer transition shadow-sm";
      badge.title = "Stockage sécurisé dans le navigateur. Cliquez pour choisir un dossier sur votre disque dur.";
    }
  }

  /**
   * Helper to read file as text with encoding fallbacks (UTF-8, ISO-8859-1, Windows-1252)
   */
  async readFileAsText(file) {
    let text = '';
    try {
      text = await file.text();
    } catch (e) {
      text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsText(file, 'utf-8');
      });
    }

    // If text contains ISO-8859-1/Windows-1252 declaration or replacement characters, re-read with iso-8859-1
    if (text && (
      text.includes('encoding="ISO-8859-1"') || 
      text.includes('encoding="windows-1252"') || 
      text.includes('encoding="iso-8859-1"') ||
      text.includes('encoding="latin1"') ||
      text.includes('\uFFFD')
    )) {
      try {
        const isoText = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(err);
          reader.readAsText(file, 'iso-8859-1');
        });
        if (isoText && !isoText.includes('\uFFFD')) {
          return isoText;
        }
      } catch (e) {}
    }

    return text;
  }

  /**
   * Détection de doublon / randonnée aux caractéristiques similaires
   */
  findSimilarHike(newHike, candidateList = null) {
    if (!newHike) return null;
    const candidates = candidateList || this.allHikes || [];
    if (candidates.length === 0) return null;

    const norm = (s) => (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .trim();

    const nameNew = norm(newHike.name);

    for (const existing of candidates) {
      if (existing.id === newHike.id) continue;

      const nameExist = norm(existing.name);
      const isExactName = (nameNew && nameExist && nameNew === nameExist);

      let distStartKm = Infinity;
      if (newHike.startPoint && existing.startPoint) {
        distStartKm = GPXParser.haversineDistance(
          newHike.startPoint.lat, newHike.startPoint.lon,
          existing.startPoint.lat, existing.startPoint.lon
        );
      }

      const d1 = newHike.distanceKm || 0;
      const d2 = existing.distanceKm || 0;
      const diffDistKm = Math.abs(d1 - d2);
      const maxDist = Math.max(d1, d2, 1);
      const distPct = diffDistKm / maxDist;

      const ele1 = newHike.elevationGain || 0;
      const ele2 = existing.elevationGain || 0;
      const diffDPlus = Math.abs(ele1 - ele2);
      const maxEle = Math.max(ele1, ele2, 1);
      const dplusPct = diffDPlus / maxEle;

      // 1. Même lieu de départ (< 400 m) ET distance quasi identique (< 0.5 km ou < 6%) ET D+ quasi identique (< 40 m ou < 10%)
      const sameGeoAndMetrics = (distStartKm <= 0.4) && (diffDistKm <= 0.5 || distPct <= 0.06) && (diffDPlus <= 40 || dplusPct <= 0.10);

      // 2. Même nom exact ET (départ proche < 2 km OU distance proche < 1 km)
      const sameNameAndContext = isExactName && (distStartKm <= 2.0 || diffDistKm <= 1.0);

      // 3. Départ et Arrivée quasi identiques (< 250 m) avec distance identique (< 400 m)
      let distEndKm = Infinity;
      if (newHike.endPoint && existing.endPoint) {
        distEndKm = GPXParser.haversineDistance(
          newHike.endPoint.lat, newHike.endPoint.lon,
          existing.endPoint.lat, existing.endPoint.lon
        );
      }
      const sameTrackEnds = (distStartKm <= 0.25) && (distEndKm <= 0.25) && (diffDistKm <= 0.4);

      if (sameGeoAndMetrics || sameNameAndContext || sameTrackEnds) {
        let reason = "";
        if (sameGeoAndMetrics) {
          reason = `Même lieu de départ (à ${Math.round(distStartKm * 1000)} m), distance quasi identique (${d2} km vs ${d1} km) et dénivelé équivalent (+${ele2}m vs +${ele1}m).`;
        } else if (sameNameAndContext) {
          reason = `Nom identique (« ${existing.name} ») et caractéristiques géographiques très proches.`;
        } else {
          reason = `Mêmes points de départ/arrivée et longueur équivalente (${d2} km vs ${d1} km).`;
        }

        return {
          hike: existing,
          reason: reason,
          distStartMeters: Math.round(distStartKm * 1000),
          diffDistKm: Math.round(diffDistKm * 10) / 10,
          diffDPlus: diffDPlus
        };
      }
    }

    return null;
  }

  /**
   * Affiche la fenêtre modale de détection de doublon et attend le choix de l'utilisateur
   */
  askDuplicateDecision(newHike, existingHike, reason, fileName) {
    return new Promise((resolve) => {
      const modal = document.getElementById('duplicate-hike-modal');
      if (!modal) {
        const proceed = confirm(
          `⚠️ Une randonnée aux mêmes caractéristiques existe déjà dans la base :\n\n` +
          `• Randonnée existante : « ${existingHike.name} » (${existingHike.distanceKm} km, D+ ${existingHike.elevationGain}m)\n` +
          `• Nouvelle trace : « ${newHike.name} » (${newHike.distanceKm} km, D+ ${newHike.elevationGain}m)\n\n` +
          `${reason}\n\n` +
          `Souhaitez-vous quand même l'ajouter ?\n` +
          `• [OK] = Ajouter quand même\n• [Annuler] = Ignorer le doublon`
        );
        resolve(proceed ? 'add' : 'skip');
        return;
      }

      const reasonEl = document.getElementById('duplicate-modal-reason');
      if (reasonEl) reasonEl.textContent = reason;

      // Infos rando existante
      const existNameEl = document.getElementById('duplicate-exist-name');
      if (existNameEl) existNameEl.textContent = existingHike.name;

      const existDistEl = document.getElementById('duplicate-exist-dist');
      if (existDistEl) existDistEl.textContent = `${existingHike.distanceKm} km`;

      const existDplusEl = document.getElementById('duplicate-exist-dplus');
      if (existDplusEl) existDplusEl.textContent = `+${existingHike.elevationGain}m`;

      const existAuthorEl = document.getElementById('duplicate-exist-author');
      if (existAuthorEl) existAuthorEl.textContent = existingHike.ajoutee_par ? `Par ${existingHike.ajoutee_par}` : '';

      // Infos nouvelle trace
      const newNameEl = document.getElementById('duplicate-new-name');
      if (newNameEl) newNameEl.textContent = newHike.name;

      const newDistEl = document.getElementById('duplicate-new-dist');
      if (newDistEl) newDistEl.textContent = `${newHike.distanceKm} km`;

      const newDplusEl = document.getElementById('duplicate-new-dplus');
      if (newDplusEl) newDplusEl.textContent = `+${newHike.elevationGain}m`;

      const newFileEl = document.getElementById('duplicate-new-file');
      if (newFileEl) newFileEl.textContent = fileName || '';

      const btnSkip = document.getElementById('btn-duplicate-skip');
      const btnReplace = document.getElementById('btn-duplicate-replace');
      const btnAdd = document.getElementById('btn-duplicate-add');

      const cleanup = (choice) => {
        modal.classList.add('hidden');
        if (btnSkip) btnSkip.onclick = null;
        if (btnReplace) btnReplace.onclick = null;
        if (btnAdd) btnAdd.onclick = null;
        modal.onclick = null;
        resolve(choice);
      };

      if (btnSkip) btnSkip.onclick = () => cleanup('skip');
      if (btnReplace) btnReplace.onclick = () => cleanup('replace');
      if (btnAdd) btnAdd.onclick = () => cleanup('add');

      modal.onclick = (e) => {
        if (e.target === modal) cleanup('skip');
      };

      modal.classList.remove('hidden');
    });
  }

  /**
   * Handle Multi-file Upload (Instant Parse + Auto-Save + Auto-Radius Expansion)
   */
  async handleFilesUploaded(files) {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule pour les membres. Seul l'administrateur peut y charger des parcours.", "warning");
      return;
    }
    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_upload')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de charger des randonnées.", "error");
      return;
    }

    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    this.showToast(`Analyse de ${fileList.length} fichier(s)...`, "info");

    const origin = (window.MapManagerInstance && window.MapManagerInstance.searchOrigin) 
      ? window.MapManagerInstance.searchOrigin 
      : { lat: 43.1189, lon: 5.8033 };

    let maxDistFound = 0;
    const newHikes = [];
    const errors = [];
    let skippedCount = 0;

    for (const file of fileList) {
      try {
        const text = await this.readFileAsText(file);
        const hike = GPXParser.parse(text, file.name);
        const proposedName = await GPXParser.generateProposedName(hike);
        hike.name = proposedName;
        hike.proposedName = proposedName;
        const authorEl = document.getElementById('upload-author-name');
        const customAuthor = authorEl && authorEl.value ? authorEl.value.trim() : '';
        if (customAuthor) localStorage.setItem('rf_uploader_display_name', customAuthor);
        hike.ajoutee_par = customAuthor || localStorage.getItem('rf_uploader_display_name') || ((typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser()) ? AuthManager.getCurrentUser().username : 'admin');
        
        // Extraction de la date de derniere rando depuis le GPX si presente
        if (!hike.lastHikeDate && hike.points && hike.points.length > 0) {
          const ptWithTime = hike.points.find(p => p.time);
          if (ptWithTime && ptWithTime.time) {
            try {
              const d = new Date(ptWithTime.time);
              if (!isNaN(d.getTime())) {
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yy = String(d.getFullYear()).slice(-2);
                hike.lastHikeDate = `${dd}/${mm}/${yy}`;
              }
            } catch (e) {}
          }
        }

        // Détection de randonnée ayant les mêmes caractéristiques
        const duplicateMatch = this.findSimilarHike(hike);
        if (duplicateMatch) {
          const decision = await this.askDuplicateDecision(
            hike, 
            duplicateMatch.hike, 
            duplicateMatch.reason, 
            file.name
          );

          if (decision === 'skip') {
            skippedCount++;
            this.showToast(`Doublon ignoré : « ${file.name} »`, "info");
            continue;
          } else if (decision === 'replace') {
            hike.id = duplicateMatch.hike.id;
            if (!hike.name || hike.name === proposedName) {
              hike.name = duplicateMatch.hike.name;
            }
          } else if (decision === 'add') {
            if (hike.name === duplicateMatch.hike.name) {
              hike.name = `${hike.name} (Bis)`;
            }
          }
        }

        // Calcul IBP officiel via l'API ibpindex.com si possible
        try {
          const officialIbp = await GPXParser.fetchOfficialIBP(text, file.name);
          if (officialIbp !== null) {
            hike.ibp = officialIbp;
            const lvl = GPXParser.getIBPLevel(officialIbp);
            hike.ibpLevel = lvl.level;
            hike.difficulty = lvl.label;
            if (hike.notes && /\[IBP:\s*\d+\]/i.test(hike.notes)) {
              hike.notes = hike.notes.replace(/\[IBP:\s*\d+\]/i, `[IBP: ${officialIbp}]`);
            } else {
              hike.notes = `[IBP: ${officialIbp}] ${hike.notes || ''}`.trim();
            }
          }
        } catch (e) {
          console.warn("IBP API call error in upload:", e);
        }

        // Auto-save immediately to persistent storage
        await StorageManager.saveHike(hike, text);

        // Auto-push to Supabase Cloud in background if configured
        try {
          const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
          const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
          const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
          if (supaUrl && supaKey) {
            StorageManager.pushHikeToSupabase(hike, supaUrl, supaKey).catch(e => console.warn("Supabase auto-upload error:", e));
          }
        } catch (e) {}

        // Add to main collection
        const existingIdx = this.allHikes.findIndex(h => h.id === hike.id || (h.name && h.name === hike.name));
        if (existingIdx >= 0) {
          this.allHikes[existingIdx] = hike;
        } else {
          this.allHikes.unshift(hike);
        }

        if (hike.startPoint) {
          const dist = GPXParser.haversineDistance(origin.lat, origin.lon, hike.startPoint.lat, hike.startPoint.lon);
          if (dist > maxDistFound) maxDistFound = dist;
        }

        newHikes.push(hike);
      } catch (err) {
        console.error(`Erreur lecture ${file.name} :`, err);
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    if (newHikes.length === 0) {
      if (skippedCount > 0) {
        this.showToast(`Opération terminée : ${skippedCount} doublon(s) ignoré(s).`, "info");
      } else {
        const errorDetail = errors.length > 0 ? errors.join("\n") : "Format de fichier non reconnu.";
        this.showToast(`Échec du chargement : ${errorDetail}`, "error");
      }
      return;
    }

    // Auto expand radius if newly added hikes are outside current radius
    const currentRadius = window.MapManagerInstance ? window.MapManagerInstance.searchRadiusKm : 50;
    if (maxDistFound > currentRadius) {
      const stepIdx = this.getStepIndexForKm(maxDistFound);
      this.setRadiusStep(stepIdx, true);
    }

    // Automatically switch to Explorer view and select the first new hike!
    this.switchTab('explorer');
    this.applyFiltersAndRender();
    this.renderManagementList();

    if (newHikes.length > 0) {
      this.handleHikeSelect(newHikes[0]);
    }

    let toastMsg = (newHikes.length === 1) 
      ? `🎉 « ${newHikes[0].name} » ajoutée ! (${newHikes[0].distanceKm} km, +${newHikes[0].elevationGain}m, IBP : ${newHikes[0].ibp} - Niveau ${newHikes[0].ibpLevel})`
      : `🎉 ${newHikes.length} randonnée(s) ajoutée(s) avec calcul de l'Indice IBP Index !`;
    if (skippedCount > 0) {
      toastMsg += ` (${skippedCount} doublon(s) ignoré(s))`;
    }
    this.showToast(toastMsg, "success");
  }

  /**
   * Handle Direct GPX Text Paste
   */
  async handlePasteGPX() {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule pour les membres. Seul l'administrateur peut y coller des parcours.", "warning");
      return;
    }
    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_upload')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de charger des randonnées.", "error");
      return;
    }

    const textarea = document.getElementById('paste-gpx-text');
    const nameInput = document.getElementById('paste-gpx-name');
    if (!textarea) return;

    const rawText = textarea.value.trim();
    if (!rawText) {
      this.showToast("Veuillez d'abord coller le texte de votre trace GPX.", "error");
      return;
    }

    const customName = nameInput ? nameInput.value.trim() : '';

    try {
      this.showToast("Analyse de la trace collée...", "info");
      const hike = GPXParser.parse(rawText, customName ? customName + '.gpx' : 'Randonnee_Collee.gpx');
      if (customName) {
        hike.name = GPXParser.ensureForeignCountryPrefix(
          customName,
          null,
          hike.startPoint ? hike.startPoint.lat : null,
          hike.startPoint ? hike.startPoint.lon : null
        );
      } else {
        const proposedName = await GPXParser.generateProposedName(hike);
        hike.name = proposedName;
        hike.proposedName = proposedName;
      }

      const authorEl = document.getElementById('upload-author-name');
      const customAuthor = authorEl && authorEl.value ? authorEl.value.trim() : '';
      if (customAuthor) localStorage.setItem('rf_uploader_display_name', customAuthor);
      hike.ajoutee_par = customAuthor || localStorage.getItem('rf_uploader_display_name') || ((typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser()) ? AuthManager.getCurrentUser().username : 'admin');

      // Détection de randonnée ayant les mêmes caractéristiques
      const duplicateMatch = this.findSimilarHike(hike);
      if (duplicateMatch) {
        const decision = await this.askDuplicateDecision(
          hike, 
          duplicateMatch.hike, 
          duplicateMatch.reason, 
          'Trace GPX collée'
        );

        if (decision === 'skip') {
          this.showToast("Importation annulée : doublon ignoré.", "info");
          return;
        } else if (decision === 'replace') {
          hike.id = duplicateMatch.hike.id;
          if (!customName) {
            hike.name = duplicateMatch.hike.name;
          }
        } else if (decision === 'add') {
          if (hike.name === duplicateMatch.hike.name) {
            hike.name = `${hike.name} (Bis)`;
          }
        }
      }

      // Calcul IBP officiel via l'API ibpindex.com si possible
      try {
        const officialIbp = await GPXParser.fetchOfficialIBP(rawText, (customName || 'trace') + '.gpx');
        if (officialIbp !== null) {
          hike.ibp = officialIbp;
          const lvl = GPXParser.getIBPLevel(officialIbp);
          hike.ibpLevel = lvl.level;
          hike.difficulty = lvl.label;
          if (hike.notes && /\[IBP:\s*\d+\]/i.test(hike.notes)) {
            hike.notes = hike.notes.replace(/\[IBP:\s*\d+\]/i, `[IBP: ${officialIbp}]`);
          } else {
            hike.notes = `[IBP: ${officialIbp}] ${hike.notes || ''}`.trim();
          }
        }
      } catch (e) {
        console.warn("IBP API call error in paste:", e);
      }

      await StorageManager.saveHike(hike, rawText);

      // Auto-push to Supabase Cloud in background if configured
      try {
        const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
        const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
        const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
        if (supaUrl && supaKey) {
          StorageManager.pushHikeToSupabase(hike, supaUrl, supaKey).catch(e => console.warn("Supabase auto-upload error:", e));
        }
      } catch (e) {}

      const existingIdx = this.allHikes.findIndex(h => h.id === hike.id || (h.name && h.name === hike.name));
      if (existingIdx >= 0) {
        this.allHikes[existingIdx] = hike;
      } else {
        this.allHikes.unshift(hike);
      }

      // Clear input
      textarea.value = '';
      if (nameInput) nameInput.value = '';

      // Auto expand radius if needed
      const origin = (window.MapManagerInstance && window.MapManagerInstance.searchOrigin) 
        ? window.MapManagerInstance.searchOrigin 
        : { lat: 43.1189, lon: 5.8033 };

      if (hike.startPoint) {
        const dist = GPXParser.haversineDistance(origin.lat, origin.lon, hike.startPoint.lat, hike.startPoint.lon);
        const currentRadius = window.MapManagerInstance ? window.MapManagerInstance.searchRadiusKm : 50;
        if (dist > currentRadius) {
          const stepIdx = this.getStepIndexForKm(dist);
          this.setRadiusStep(stepIdx, true);
        }
      }

      this.switchTab('explorer');
      this.applyFiltersAndRender();
      this.renderManagementList();
      this.handleHikeSelect(hike);

      this.showToast(`🎉 Randonnée « ${hike.name} » ajoutée avec succès !`, "success");
    } catch (err) {
      console.error("Erreur paste GPX :", err);
      this.showToast(`Erreur d'analyse : ${err.message}`, "error");
    }
  }

  // =========================================================================
  // MAP AREA PRINT MODAL (2-CLICK RECTANGLE EXTRACTION)
  // =========================================================================
  openMapAreaModal(bounds) {
    this.selectedAreaBounds = bounds;
    const modal = document.getElementById('map-area-modal');
    if (!modal) return;

    const minLat = bounds[0][0];
    const minLon = bounds[0][1];
    const maxLat = bounds[1][0];
    const maxLon = bounds[1][1];

    const dKmWidth = GPXParser.haversineDistance(minLat, minLon, minLat, maxLon);
    const dKmHeight = GPXParser.haversineDistance(minLat, minLon, maxLat, minLon);

    const infoEl = document.getElementById('modal-map-area-info');
    if (infoEl) {
      infoEl.textContent = `Zone sélectionnée : ~${dKmWidth.toFixed(1)} km × ${dKmHeight.toFixed(1)} km (2 clics)`;
    }

    // Déterminer la (ou les) trace(s) active(s) (jusqu'à 3 traces GPX libres ou randonnée club)
    const standaloneTracks = (window.MapManagerInstance && window.MapManagerInstance.standaloneTracks) || [];
    const activeHike = this.areaPrintHike || this.selectedHike || 
                       (window.MapManagerInstance && window.MapManagerInstance.selectedHike) || 
                       (window.MapManagerInstance && window.MapManagerInstance.standaloneHike) || null;

    // Remplir le sélecteur de tracé GPX (accessible et visible en permanence)
    const gpxSelect = document.getElementById('map-area-gpx-select');
    const titleEl = document.getElementById('map-area-title');

    if (gpxSelect) {
      gpxSelect.innerHTML = '<option value="">🚫 Aucun tracé (fond de carte vierge)</option>';

      // Si plusieurs traces GPX libres sont affichées (ex: 2 ou 3 traces simultanées)
      if (standaloneTracks.length > 1) {
        const optAll = document.createElement('option');
        optAll.value = '__all_standalone__';
        optAll.textContent = `📍 Toutes les traces affichées (${standaloneTracks.length} traces GPX simultanées)`;
        optAll.selected = true;
        gpxSelect.appendChild(optAll);

        standaloneTracks.forEach((trk, idx) => {
          const optTrk = document.createElement('option');
          optTrk.value = `__standalone_${trk.id || idx}__`;
          optTrk.textContent = `  ↳ Trace ${idx + 1} : ${trk.name} (${trk.distance || '?'} km)`;
          gpxSelect.appendChild(optTrk);
        });
      } else if (activeHike) {
        // Une seule trace active
        const optActive = document.createElement('option');
        optActive.value = String(activeHike.id);
        optActive.textContent = `📍 ${activeHike.name} (${activeHike.distance || activeHike.distanceKm || '?'} km)`;
        optActive.selected = true;
        gpxSelect.appendChild(optActive);
      }

      // En mode Randonner uniquement (protégé), lister les autres randonnées du club
      const isRandoMode = window.location.hash.startsWith('#randonner');
      if (isRandoMode) {
        const hikesList = (this.allHikes && this.allHikes.length > 0) ? this.allHikes : (this.hikes || []);
        const sortedHikes = [...hikesList].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        sortedHikes.forEach(h => {
          if (activeHike && String(h.id) === String(activeHike.id)) return;
          const opt = document.createElement('option');
          opt.value = h.id;
          opt.textContent = `📍 ${h.name} (${h.distanceKm ? h.distanceKm + ' km' : 'GPX'})`;
          gpxSelect.appendChild(opt);
        });
      }

      // Adapter automatiquement le titre en cas de changement de sélection
      gpxSelect.onchange = () => {
        const selectedId = gpxSelect.value;
        if (titleEl) {
          if (selectedId === '__all_standalone__') {
            titleEl.value = standaloneTracks.map(t => t.name).join(' • ') + ' - Extrait de carte';
          } else if (selectedId && selectedId.startsWith('__standalone_')) {
            const trkId = selectedId.replace('__standalone_', '').replace(/__$/, '');
            const chosenTrk = standaloneTracks.find((t, i) => String(t.id) === trkId || String(i) === trkId);
            titleEl.value = chosenTrk ? `${chosenTrk.name} - Extrait de carte` : `Extrait Cartographique`;
          } else if (activeHike && String(activeHike.id) === String(selectedId)) {
            titleEl.value = `${activeHike.name} - Extrait de carte`;
          } else {
            const hikesList = (this.allHikes && this.allHikes.length > 0) ? this.allHikes : (this.hikes || []);
            const chosen = hikesList.find(h => String(h.id) === String(selectedId));
            if (chosen) {
              titleEl.value = `${chosen.name} - Extrait de carte`;
            } else {
              titleEl.value = `Extrait Cartographique (${dKmWidth.toFixed(1)} × ${dKmHeight.toFixed(1)} km)`;
            }
          }
        }
      };
    }

    // Default title
    if (titleEl) {
      if (standaloneTracks.length > 1) {
        titleEl.value = standaloneTracks.map(t => t.name).join(' • ') + ' - Extrait de carte';
      } else if (activeHike) {
        titleEl.value = `${activeHike.name} - Extrait de carte`;
      } else {
        titleEl.value = `Extrait Cartographique (${dKmWidth.toFixed(1)} × ${dKmHeight.toFixed(1)} km)`;
      }
    }

    // Default layer matching currently active map layer
    const layerSelect = document.getElementById('map-area-layer');
    if (layerSelect && window.MapManagerInstance) {
      layerSelect.value = window.MapManagerInstance.getCurrentBaseLayerKey();
    }

    // Gestion de l'échelle vraie physique (1/XXXXXX)
    const formatEl = document.getElementById('map-area-format');
    const orientEl = document.getElementById('map-area-orientation');
    const scaleModeEl = document.getElementById('map-area-scale-mode');
    const scaleDenomEl = document.getElementById('map-area-scale-denom');
    const scalePreviewEl = document.getElementById('map-area-scale-preview');
    const scaleInputBox = document.getElementById('box-map-area-scale-input');
    const scalePresetsBox = document.getElementById('map-area-scale-presets');

    const updateScalePreview = () => {
      const fmt = (formatEl ? formatEl.value : 'a4').toLowerCase();
      const ori = (orientEl ? orientEl.value : 'landscape').toLowerCase();
      const mode = scaleModeEl ? scaleModeEl.value : 'fit';
      const denom = parseInt(scaleDenomEl ? scaleDenomEl.value : '25000', 10) || 25000;

      const pageDims = {
        a4: { w: 297, h: 210 },
        a3: { w: 420, h: 297 }
      };
      const dims = pageDims[fmt] || pageDims.a4;
      const sheetW = ori === 'landscape' ? Math.max(dims.w, dims.h) : Math.min(dims.w, dims.h);
      const sheetH = ori === 'landscape' ? Math.min(dims.w, dims.h) : Math.max(dims.w, dims.h);

      const marginX = 12;
      const marginY = 12;
      const topBannerH = 14;
      const botLegendH = 12;
      const mapBoxW_mm = sheetW - (2 * marginX);
      const mapBoxH_mm = sheetH - marginY - topBannerH - botLegendH - marginY;

      if (scaleInputBox) scaleInputBox.style.display = (mode === 'custom') ? 'block' : 'none';
      if (scalePresetsBox) scalePresetsBox.style.display = (mode === 'custom') ? 'flex' : 'none';

      if (scalePreviewEl) {
        if (mode === 'fit') {
          scalePreviewEl.innerHTML = `Mode <strong>Cadrage exact</strong> : la zone sélectionnée (~${dKmWidth.toFixed(1)} × ${dKmHeight.toFixed(1)} km) occupera 100% de la feuille ${fmt.toUpperCase()}.`;
        } else {
          const mapBoxW_m = (mapBoxW_mm / 1000) * denom;
          const mapBoxH_m = (mapBoxH_mm / 1000) * denom;
          const mapBoxW_km = mapBoxW_m / 1000;
          const mapBoxH_km = mapBoxH_m / 1000;
          const denomFmt = denom.toLocaleString('fr-FR');
          scalePreviewEl.innerHTML = `Échelle <strong>1 : ${denomFmt}</strong> sur ${fmt.toUpperCase()} (${mapBoxW_mm} × ${Math.round(mapBoxH_mm)} mm utiles) : cadre de <strong>~${mapBoxW_km.toFixed(2)} km × ${mapBoxH_km.toFixed(2)} km</strong> centré sur votre sélection (1 cm papier = ${denom < 100000 ? Math.round(denom / 100) + ' m' : (denom / 100000).toFixed(1) + ' km'} terrain).`;
        }
      }
    };

    if (formatEl) formatEl.onchange = updateScalePreview;
    if (orientEl) orientEl.onchange = updateScalePreview;
    if (scaleModeEl) scaleModeEl.onchange = updateScalePreview;
    if (scaleDenomEl) scaleDenomEl.oninput = updateScalePreview;

    const presetBtns = document.querySelectorAll('.btn-scale-preset');
    presetBtns.forEach(btn => {
      btn.onclick = () => {
        const sc = btn.dataset.scale;
        if (sc && scaleDenomEl) {
          scaleDenomEl.value = sc;
          presetBtns.forEach(b => {
            b.classList.remove('bg-emerald-600', 'text-white');
            b.classList.add('bg-white', 'text-slate-700', 'border', 'border-slate-300');
          });
          btn.classList.remove('bg-white', 'text-slate-700', 'border', 'border-slate-300');
          btn.classList.add('bg-emerald-600', 'text-white');
          updateScalePreview();
        }
      };
    });

    updateScalePreview();

    modal.classList.remove('hidden');
  }

  closeMapAreaModal() {
    const modal = document.getElementById('map-area-modal');
    if (modal) modal.classList.add('hidden');
    if (window.MapManagerInstance) {
      window.MapManagerInstance.clearAreaSelectionVisuals();
    }
  }

  async executeMapAreaDownload() {
    if (!this.selectedAreaBounds) return;

    const formatEl = document.getElementById('map-area-format');
    const format = formatEl ? formatEl.value : 'a4';
    const orientationEl = document.getElementById('map-area-orientation');
    const orientation = orientationEl ? orientationEl.value : 'landscape';
    const layerEl = document.getElementById('map-area-layer');
    const mapLayer = layerEl ? layerEl.value : 'igntop25';
    const titleEl = document.getElementById('map-area-title');
    const title = titleEl && titleEl.value.trim() ? titleEl.value.trim() : 'EXTRAIT DE CARTE TOPOGRAPHIQUE';
    const showCoordsEl = document.getElementById('map-area-opt-coords');
    const showCoords = showCoordsEl ? showCoordsEl.checked : true;
    const trackColorEl = document.getElementById('map-area-track-color');
    const trackColor = trackColorEl ? trackColorEl.value : '#1d4ed8';

    // Récupérer le tracé ou multi-tracés choisis dans le sélecteur GPX
    const gpxSelect = document.getElementById('map-area-gpx-select');
    const selectedHikeId = gpxSelect ? gpxSelect.value : '';
    let hikeForTrack = null;
    let tracksForExport = null;

    const standaloneTracks = (window.MapManagerInstance && window.MapManagerInstance.standaloneTracks) || [];

    if (selectedHikeId === '__all_standalone__') {
      tracksForExport = standaloneTracks;
    } else if (selectedHikeId && selectedHikeId.startsWith('__standalone_')) {
      const trkId = selectedHikeId.replace('__standalone_', '').replace(/__$/, '');
      hikeForTrack = standaloneTracks.find((t, i) => String(t.id) === trkId || String(i) === trkId) || null;
    } else if (selectedHikeId) {
      if (this.areaPrintHike && String(this.areaPrintHike.id) === String(selectedHikeId)) {
        hikeForTrack = this.areaPrintHike;
      } else if (window.MapManagerInstance && window.MapManagerInstance.standaloneHike && String(window.MapManagerInstance.standaloneHike.id) === String(selectedHikeId)) {
        hikeForTrack = window.MapManagerInstance.standaloneHike;
      } else {
        const hikesList = (this.allHikes && this.allHikes.length > 0) ? this.allHikes : (this.hikes || []);
        hikeForTrack = hikesList.find(h => String(h.id) === String(selectedHikeId)) || null;
      }
    } else if (standaloneTracks.length > 1 && (!selectedHikeId || selectedHikeId === '')) {
      // Choix explicite : aucun tracé
      tracksForExport = null;
      hikeForTrack = null;
    }

    this.closeMapAreaModal();

    this.showToast("Génération de l'extrait de carte en haute définition...", "info");
    try {
      if (hikeForTrack && typeof StorageManager !== 'undefined') {
        try { await StorageManager.ensureHikeTrackLoaded(hikeForTrack); } catch (e) {}
      }
      const showUtm = document.getElementById('map-area-opt-utm') ? document.getElementById('map-area-opt-utm').checked : true;
      const scaleModeEl = document.getElementById('map-area-scale-mode');
      const scaleMode = scaleModeEl ? scaleModeEl.value : 'fit';
      const scaleDenomEl = document.getElementById('map-area-scale-denom');
      const scaleDenom = scaleDenomEl ? (parseInt(scaleDenomEl.value, 10) || 25000) : 25000;

      await PDFExporter.exportMapAreaPDF(this.selectedAreaBounds, {
        title: title,
        format: format,
        orientation: orientation,
        mapLayer: mapLayer,
        showCoords: showCoords,
        showUtmGrid: showUtm,
        scaleMode: scaleMode,
        scaleDenom: scaleDenom,
        trackColor: trackColor,
        hike: hikeForTrack,
        tracks: tracksForExport,
        bearings: (window.MapManagerInstance && window.MapManagerInstance.bearingMeasurements) ? window.MapManagerInstance.bearingMeasurements : []
      });
      let trackNotice = ' (fond vierge)';
      if (tracksForExport && tracksForExport.length > 0) {
        trackNotice = ` avec ${tracksForExport.length} tracés GPX`;
      } else if (hikeForTrack) {
        trackNotice = ` avec tracé « ${hikeForTrack.name} »`;
      }
      this.showToast(`Extrait de carte (${format.toUpperCase()} ${orientation === 'landscape' ? 'Paysage' : 'Portrait'})${trackNotice} téléchargé !`, "success");
    } catch (err) {
      console.error("Erreur export carte zone :", err);
      this.showToast("Erreur lors de la génération de la carte PDF", "error");
    }
  }

  

    deselectHike() {
    this.selectedHike = null;
    this.isHikePinned = false;
    this.hoveredHike = null;
    this.isMouseOverPreview = false;
    this.cancelHoverClear();
    if (window.MapManagerInstance) {
      window.MapManagerInstance.hoveredHike = null;
      window.MapManagerInstance.deselectHike();
    }
    this.hideHikePreviewPanel();
    this.updateTableSelection(null);
  }

  switchTab(tabName) {
    if (tabName === 'upload' && typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_upload')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de charger des randonnées.", "error");
      return;
    }

    this.currentTab = tabName;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.classList.remove('bg-emerald-700', 'text-white', 'shadow-sm');
      btn.classList.add('text-slate-300', 'hover:bg-slate-800');
    });

    const activeContent = document.getElementById(`tab-content-${tabName}`);
    if (activeContent) activeContent.classList.remove('hidden');

    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('text-slate-300', 'hover:bg-slate-800');
      activeBtn.classList.add('bg-emerald-700', 'text-white', 'shadow-sm');
    }

    if (tabName === 'explorer') {
      setTimeout(() => {
        if (window.MapManagerInstance && window.MapManagerInstance.map) {
          window.MapManagerInstance.map.invalidateSize();
        }
      }, 100);
      this.applyFiltersAndRender();
    } else if (tabName === 'upload') {
      const authorInput = document.getElementById('upload-author-name');
      if (authorInput) {
        const loggedUser = (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser()) ? AuthManager.getCurrentUser().username : '';
        const savedAuthor = localStorage.getItem('rf_uploader_display_name') || '';
        if (!authorInput.value || authorInput.value === 'admin') {
          authorInput.value = savedAuthor || loggedUser || 'admin';
        }
        if (!authorInput._boundSave) {
          authorInput._boundSave = true;
          authorInput.addEventListener('change', () => {
            if (authorInput.value.trim()) {
              localStorage.setItem('rf_uploader_display_name', authorInput.value.trim());
            }
          });
        }
      }
    } else if (tabName === 'manage') {
      this.renderManagementList();
    }
    this.updateDatabaseStatusUI();
  }

  setViewMode(mode) {
    this.currentViewMode = mode;
    const mapCol = document.getElementById('map-column');
    const tableCol = document.getElementById('table-column');

    document.querySelectorAll('[data-view-mode]').forEach(btn => {
      btn.classList.remove('bg-emerald-600', 'text-white');
      btn.classList.add('bg-slate-100', 'text-slate-700');
    });

    const activeBtn = document.querySelector(`[data-view-mode="${mode}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('bg-slate-100', 'text-slate-700');
      activeBtn.classList.add('bg-emerald-600', 'text-white');
    }

    if (mode === 'map') {
      if (mapCol) {
        mapCol.classList.remove('hidden', 'lg:w-1/2');
        mapCol.classList.add('w-full', 'h-full');
      }
      if (tableCol) tableCol.classList.add('hidden');
    } else if (mode === 'table') {
      if (mapCol) mapCol.classList.add('hidden');
      if (tableCol) {
        tableCol.classList.remove('hidden', 'lg:w-1/2');
        tableCol.classList.add('w-full', 'h-full');
      }
    } else {
      if (mapCol) {
        mapCol.classList.remove('hidden', 'w-full');
        mapCol.classList.add('lg:w-1/2');
      }
      if (tableCol) {
        tableCol.classList.remove('hidden', 'w-full');
        tableCol.classList.add('lg:w-1/2');
      }
    }

    setTimeout(() => {
      if (window.MapManagerInstance && window.MapManagerInstance.map) {
        window.MapManagerInstance.map.invalidateSize();
      }
    }, 150);
  }

  applyFiltersAndRender(autoZoomSearchResults = false) {
    const origin = (window.MapManagerInstance && window.MapManagerInstance.searchOrigin) 
      ? window.MapManagerInstance.searchOrigin 
      : { lat: 43.1189, lon: 5.8033 };

    const radius = (window.MapManagerInstance && window.MapManagerInstance.searchRadiusKm) 
      ? window.MapManagerInstance.searchRadiusKm 
      : 100;

    const isWorldWide = radius >= 20000;

    this.filteredHikes = (this.allHikes || []).map(hike => {
      const distFromOrigin = hike.startPoint
        ? GPXParser.haversineDistance(origin.lat, origin.lon, hike.startPoint.lat, hike.startPoint.lon)
        : 9999;

      return {
        ...hike,
        distFromOrigin: Math.round(distFromOrigin * 10) / 10
      };
    }).filter(hike => {
      const matchesRadius = isWorldWide || (hike.distFromOrigin <= radius);
      const matchesQuery = !this.searchQuery || 
        hike.name.toLowerCase().includes(this.searchQuery) || 
        (hike.notes && hike.notes.toLowerCase().includes(this.searchQuery));

      // Si l'utilisateur saisit un mot-clé (ex: "Canada", "Chine", "Garibaldi"), recherche mondiale prioritaire
      if (this.searchQuery) {
        return matchesQuery;
      }

      return matchesRadius;
    });

    this.sortHikes();
    this.renderHikesTable();

    if (window.MapManagerInstance) {
      window.MapManagerInstance.renderHikeMarkers(this.filteredHikes);

      // Si recherche active par mot-clé et demandé explicitement, centrer la carte sur les résultats
      if (autoZoomSearchResults && this.searchQuery && this.filteredHikes.length > 0) {
        const validHikes = this.filteredHikes.filter(h => h.startPoint);
        if (validHikes.length > 0) {
          try {
            const bounds = L.latLngBounds(validHikes.map(h => [h.startPoint.lat, h.startPoint.lon]));
            window.MapManagerInstance.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
          } catch (e) {}
        }
      }
    }

    const activeDb = StorageManager.getActiveDatabase();
    const countEl = document.getElementById('results-count');
    if (countEl) {
      const dbTag = activeDb.isSanctuary ? ` [🔒 ${activeDb.name}]` : ` [🌿 ${activeDb.name}]`;
      if (this.searchQuery) {
        countEl.textContent = `${this.filteredHikes.length} résultat${this.filteredHikes.length > 1 ? 's' : ''} pour "${this.searchQuery}"${dbTag}`;
      } else if (isWorldWide) {
        countEl.textContent = `${this.filteredHikes.length} randonnée${this.filteredHikes.length > 1 ? 's' : ''} (Monde entier 🌍)${dbTag}`;
      } else if (radius >= 1000) {
        countEl.textContent = `${this.filteredHikes.length} randonnée${this.filteredHikes.length > 1 ? 's' : ''} à moins de ${radius.toLocaleString('fr-FR')} km${dbTag}`;
      } else {
        countEl.textContent = `${this.filteredHikes.length} randonnée${this.filteredHikes.length > 1 ? 's' : ''} à moins de ${radius} km${dbTag}`;
      }
    }

    const tableBadge = document.getElementById('table-filtered-badge');
    if (tableBadge) {
      if (this.searchQuery) {
        tableBadge.textContent = `${this.filteredHikes.length} résultat(s)`;
      } else {
        tableBadge.textContent = `${this.filteredHikes.length} rando(s)`;
      }
    }

    const manageCountBadge = document.getElementById('manage-total-count');
    if (manageCountBadge) {
      manageCountBadge.textContent = `${this.allHikes.length} randonnée(s)`;
    }
  }

  sortHikes() {
    this.filteredHikes.sort((a, b) => {
      let valA = a[this.sortColumn];
      let valB = b[this.sortColumn];

      if (this.sortColumn === 'ajoutee_par') {
        valA = (a.ajoutee_par || 'admin').toString().toLowerCase();
        valB = (b.ajoutee_par || 'admin').toString().toLowerCase();
      }

      if (this.sortColumn === 'ibp') {
        valA = (typeof a.ibp === 'number') ? a.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(a) : 0);
        valB = (typeof b.ibp === 'number') ? b.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(b) : 0);
      }

      if (this.sortColumn === 'lastHikeDate') {
        const parseDate = (d) => {
          if (!d || typeof d !== 'string') return 0;
          const parts = d.trim().split(/[\/\-\.]/);
          if (parts.length === 3) {
            let day = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10);
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            const t = new Date(year, month - 1, day).getTime();
            return isNaN(t) ? 0 : t;
          }
          return 0;
        };
        valA = parseDate(a.lastHikeDate);
        valB = parseDate(b.lastHikeDate);
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  setSort(column) {
    if (this.sortColumn === column) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = column;
      this.sortAsc = true;
    }
    this.sortHikes();
    this.renderHikesTable();
  }

  renderHikesTable() {
    const tableBody = document.getElementById('hikes-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (this.filteredHikes.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="p-8 text-center text-slate-400">
            <div class="text-3xl mb-2">🔍</div>
            <div class="font-medium text-slate-700">Aucune randonnée dans ce rayon (${window.MapManagerInstance ? window.MapManagerInstance.searchRadiusKm : 50} km)</div>
            <div class="text-xs text-slate-500 mt-1">👉 <strong>Augmentez le curseur de rayon</strong> (ex: 200 km) ou tapez une autre ville de départ pour les voir.</div>
          </td>
        </tr>
      `;
      return;
    }

    this.filteredHikes.forEach(hike => {
      const ibpVal = (typeof hike.ibp === 'number') ? hike.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(hike) : 50);
      const ibpInfo = (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(ibpVal) : { level: 3, label: 'Peu difficile', color: '#ea580c' };

      const tr = document.createElement('tr');
      tr.dataset.hikeId = hike.id;
      tr.className = 'border-b border-slate-100 hover:bg-emerald-50/70 transition-colors cursor-pointer text-sm';
      if (this.selectedHike && this.selectedHike.id === hike.id) {
        tr.classList.add('bg-emerald-50', 'border-emerald-300', 'font-semibold');
      }

      tr.innerHTML = `
        <td class="p-3 font-semibold text-slate-900 whitespace-nowrap">
          <div class="flex items-center gap-1.5 text-blue-600">
            <span class="text-xs">📍</span>
            <span>${hike.distFromOrigin} km</span>
          </div>
        </td>
        <td class="p-3">
          <div class="font-bold text-slate-800 hover:text-emerald-700 cursor-pointer group flex items-center gap-1.5 transition-colors" title="Cliquer pour afficher cette randonnée sur la carte">
            <span class="hover:underline">${hike.name}</span>
            <span class="text-xs text-emerald-600 opacity-60 group-hover:opacity-100 group-hover:scale-125 transition-all">🗺️</span>
          </div>
          ${hike.notes ? `<div class="text-xs text-slate-500 line-clamp-1 max-w-xs mt-0.5">${hike.notes}</div>` : ''}
        </td>
        <td class="p-3 text-slate-700 whitespace-nowrap">
          <span class="font-semibold">${hike.distanceKm} km</span>
        </td>
        <td class="p-3 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
            +${hike.elevationGain} m
          </span>
        </td>
        <td class="p-3 whitespace-nowrap">
          <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold shadow-2xs" style="background-color: ${ibpInfo.color}15; color: ${ibpInfo.color}; border: 1px solid ${ibpInfo.color}40;" title="Indice d'effort IBP : ${ibpVal} • Niveau ${ibpInfo.level} (${ibpInfo.label})">
            <span class="w-4 h-4 rounded text-[10px] font-black text-white flex items-center justify-center" style="background-color: ${ibpInfo.color}">${ibpInfo.level}</span>
            <span>IBP ${ibpVal}</span>
          </div>
        </td>
        <td class="p-3 whitespace-nowrap text-xs font-semibold text-slate-700">
          ${hike.lastHikeDate ? `<span class="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md border border-slate-200">${hike.lastHikeDate}</span>` : '<span class="text-slate-300 italic">-</span>'}
        </td>
        <td class="p-3 whitespace-nowrap text-xs">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200 font-bold" title="Trace GPX chargée par ${this.escapeHtml(hike.ajoutee_par || 'admin')}">
            <span>👤</span>
            <span>${this.escapeHtml(hike.ajoutee_par || 'admin')}</span>
          </span>
        </td>
        <td class="p-3 text-slate-600 whitespace-nowrap text-xs">
          ${hike.minElevation}m - ${hike.maxElevation}m
        </td>
        <td class="p-3 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1">
            ${(StorageManager.isWriteProtected() || (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_edit'))) ? '' : `
              <button class="btn-table-edit p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Modifier le nom et les notes">
                ✏️
              </button>
              <button class="btn-table-delete p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Supprimer cette randonnée">
                🗑️
              </button>
            `}
            <button class="btn-download-hike px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm transition flex items-center gap-1 ml-1" title="Télécharger GPX / Fiche PDF">
              <span>📥</span>
              <span class="hidden sm:inline">Télécharger</span>
            </button>
          </div>
        </td>
      `;

      tr.addEventListener('mouseenter', () => {
        if (!this.selectedHike || this.selectedHike.id !== hike.id) {
          this.handleHikeHover(hike);
        }
      });

      tr.addEventListener('mouseleave', () => {
        this.handleHikeHoverEnd();
      });

      tr.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.showHikeOnMap(hike);
        }
      });

      // Edit button click
      const editBtn = tr.querySelector('.btn-table-edit');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEditModal(hike);
        });
      }

      // Delete button click
      const deleteBtn = tr.querySelector('.btn-table-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openDeleteModal(hike);
        });
      }

      // Download button click
      const dlBtn = tr.querySelector('.btn-download-hike');
      if (dlBtn) {
        dlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openDownloadModal(hike);
        });
      }

      tableBody.appendChild(tr);
    });
  }

  showHikeOnMap(hike) {
    if (!hike) return;

    // 1. Si on est en mode tableau seul, basculer vers le mode split pour afficher la carte
    const wasTableMode = (this.currentViewMode === 'table');
    if (wasTableMode) {
      this.setViewMode('split');
    }

    // 2. Si on est sur un autre onglet (ex: Gérer les randos), revenir sur l'explorateur
    if (this.currentTab !== 'explorer') {
      this.switchTab('explorer');
    }

    // 3. Adapter le curseur de rayon si la randonnée est au-delà du rayon actuel
    const origin = (window.MapManagerInstance && window.MapManagerInstance.searchOrigin) 
      ? window.MapManagerInstance.searchOrigin 
      : { lat: 43.1189, lon: 5.8033 };

    if (hike.startPoint) {
      const dist = GPXParser.haversineDistance(origin.lat, origin.lon, hike.startPoint.lat, hike.startPoint.lon);
      const currentRadius = window.MapManagerInstance ? window.MapManagerInstance.searchRadiusKm : 50;
      if (dist > currentRadius) {
        const stepIdx = this.getStepIndexForKm(dist);
        this.setRadiusStep(stepIdx, false);
      }
    }

    // 4. Délai si le conteneur de carte était masqué pour s'assurer que Leaflet a ses dimensions réelles
    const delay = wasTableMode ? 100 : 0;
    setTimeout(() => {
      if (window.MapManagerInstance && window.MapManagerInstance.map) {
        window.MapManagerInstance.map.invalidateSize();
      }
      this.handleHikeSelect(hike);

      // Sur mobile, faire défiler vers la carte
      const mapCol = document.getElementById('map-column');
      if (mapCol && window.innerWidth < 1024) {
        mapCol.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, delay);
  }

  /**
   * Render Management Tab View
   */
  renderManagementList() {
    const listContainer = document.getElementById('manage-hikes-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const query = this.manageSearchQuery || '';
    const filtered = (this.allHikes || []).filter(h => 
      !query || h.name.toLowerCase().includes(query) || (h.notes && h.notes.toLowerCase().includes(query))
    );

    const countBadge = document.getElementById('manage-total-count');
    if (countBadge) {
      if (query) {
        countBadge.textContent = `${filtered.length} sur ${this.allHikes.length} randonnée(s)`;
      } else {
        countBadge.textContent = `${this.allHikes.length} randonnée(s)`;
      }
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-400">
          <div class="text-3xl mb-2">📁</div>
          <div class="font-bold text-slate-700">Aucune randonnée trouvée</div>
          <div class="text-xs text-slate-500 mt-1">Votre bibliothèque est vide ou aucun élément ne correspond à votre recherche.</div>
        </div>
      `;
      return;
    }

    const isSanctuary = StorageManager.isCurrentDatabaseSanctuary();
    const isWriteProtected = StorageManager.isWriteProtected();
    const isAdmin = typeof AuthManager !== 'undefined' && AuthManager.isAdmin();
    const canEdit = !isWriteProtected && (typeof AuthManager === 'undefined' || AuthManager.hasPermission('can_edit'));

    filtered.forEach((hike, idx) => {
      const card = document.createElement('div');
      card.className = 'bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 shadow-sm transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3';

      card.innerHTML = `
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-400">#${idx + 1}</span>
            <h4 class="text-sm sm:text-base font-bold text-slate-900 truncate">${hike.name}</h4>
          </div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
            <span class="font-medium text-emerald-700">📏 ${hike.distanceKm} km</span>
            <span class="font-medium text-emerald-700">↗️ +${hike.elevationGain}m</span>
            <span class="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded text-[11px]" style="background-color:${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).color : '#ea580c')}15; color:${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).color : '#ea580c')}; border: 1px solid ${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).color : '#ea580c')}40;">
              <span class="w-3.5 h-3.5 rounded text-[9px] font-black text-white flex items-center justify-center" style="background-color:${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).color : '#ea580c')}">${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).level : 3)}</span>
              <span>IBP ${(typeof hike.ibp === 'number') ? hike.ibp : (typeof GPXParser !== 'undefined' ? GPXParser.calculateIBP(hike) : 50)}</span>
            </span>
            <span>⛰️ ${hike.minElevation}m - ${hike.maxElevation}m</span>
            <span>⏱️ ${hike.estimatedDuration || '3h30'}</span>
            ${hike.ajoutee_par ? `<span class="text-slate-500 font-medium">👤 Par : <strong class="text-slate-700">${hike.ajoutee_par}</strong></span>` : ''}
          </div>
          ${hike.notes ? `<div class="text-xs text-slate-600 line-clamp-2 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">« ${hike.notes} »</div>` : ''}
        </div>

        <div class="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <button class="btn-manage-view px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1" title="Voir sur la carte">
            <span>🗺️</span> <span>Voir</span>
          </button>
          ${(isSanctuary && isWriteProtected) ? `
            <span class="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1 select-none" title="Base sanctuarisée en lecture seule pour les membres">
              <span>🔒</span> <span>Sanctuarisée</span>
            </span>
          ` : (canEdit ? `
            ${(isSanctuary && isAdmin) ? `
              <span class="hidden sm:inline-flex px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold items-center gap-1" title="Mode Administrateur actif sur base JLDApps">
                <span>👑</span> <span>Admin</span>
              </span>
            ` : ''}
            <button class="btn-manage-edit px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1" title="Modifier nom et notes">
              <span>✏️</span> <span>Modifier</span>
            </button>
            <button class="btn-manage-delete px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1" title="Supprimer">
              <span>🗑️</span> <span>Supprimer</span>
            </button>
          ` : '')}
        </div>
      `;

      card.querySelector('.btn-manage-view').onclick = () => {
        this.showHikeOnMap(hike);
      };

      const editBtn = card.querySelector('.btn-manage-edit');
      if (editBtn) {
        editBtn.onclick = () => this.openEditModal(hike);
      }

      const delBtn = card.querySelector('.btn-manage-delete');
      if (delBtn) {
        delBtn.onclick = () => this.openDeleteModal(hike);
      }

      listContainer.appendChild(card);
    });
  }

  // =========================================================================
  // EDIT MODAL (✏️ Crayon)
  // =========================================================================
  openEditModal(hike) {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule. Seul l'administrateur peut modifier ces parcours.", "warning");
      return;
    }
    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_edit')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de modifier des randonnées.", "error");
      return;
    }
    this.hikeToEdit = hike;
    const modal = document.getElementById('edit-hike-modal');
    if (!modal) return;

    document.getElementById('edit-hike-name').value = hike.name || '';
    document.getElementById('edit-hike-notes').value = hike.notes || '';
    const lastDateInput = document.getElementById('edit-hike-last-date');
    if (lastDateInput) {
      lastDateInput.value = hike.lastHikeDate || '';
    }
    const authorEditInput = document.getElementById('edit-hike-author');
    if (authorEditInput) {
      authorEditInput.value = hike.ajoutee_par || ((typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser()) ? AuthManager.getCurrentUser().username : 'admin');
    }
    
    const ibpInput = document.getElementById('edit-hike-ibp');
    const ibpVal = (typeof hike.ibp === 'number') ? hike.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(hike) : 50);
    if (ibpInput) {
      ibpInput.value = ibpVal;
      this.updateEditIbpBadge(ibpVal);
      ibpInput.oninput = () => this.updateEditIbpBadge(ibpInput.value);
    }
    const recalcBtn = document.getElementById('btn-recalc-ibp');
    if (recalcBtn) {
      recalcBtn.onclick = () => {
        if (typeof GPXParser !== 'undefined') {
          const recalculated = GPXParser.calculateIBP(this.hikeToEdit);
          if (ibpInput) {
            ibpInput.value = recalculated;
            this.updateEditIbpBadge(recalculated);
          }
        }
      };
    }

    modal.classList.remove('hidden');
  }

  closeEditModal() {
    const modal = document.getElementById('edit-hike-modal');
    if (modal) modal.classList.add('hidden');
    this.hikeToEdit = null;
  }

  updateEditIbpBadge(ibp) {
    const val = parseInt(ibp, 10) || 1;
    const lvlInfo = (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(val) : { level: 1, label: 'Facile', color: '#16a34a' };
    const sq = document.getElementById('edit-hike-ibp-square');
    const lbl = document.getElementById('edit-hike-ibp-label');
    if (sq) {
      sq.textContent = lvlInfo.level;
      sq.style.backgroundColor = lvlInfo.color;
    }
    if (lbl) {
      lbl.textContent = `Niveau ${lvlInfo.level} (${lvlInfo.label})`;
      lbl.style.color = lvlInfo.color;
    }
  }

  async saveEditModal() {
    if (!this.hikeToEdit) return;

    const newName = document.getElementById('edit-hike-name').value.trim();
    const newNotes = document.getElementById('edit-hike-notes').value.trim();

    if (!newName) {
      this.showToast("Le nom de la randonnée ne peut pas être vide.", "error");
      return;
    }

    this.hikeToEdit.name = newName;
    this.hikeToEdit.notes = newNotes;
    const lastDateInput = document.getElementById('edit-hike-last-date');
    if (lastDateInput) {
      this.hikeToEdit.lastHikeDate = lastDateInput.value.trim();
    }
    const authorEditInput = document.getElementById('edit-hike-author');
    if (authorEditInput && authorEditInput.value.trim()) {
      this.hikeToEdit.ajoutee_par = authorEditInput.value.trim();
    }

    const ibpInputEl = document.getElementById('edit-hike-ibp');
    if (ibpInputEl) {
      const newIbp = parseInt(ibpInputEl.value, 10);
      if (!isNaN(newIbp) && newIbp > 0) {
        this.hikeToEdit.ibp = newIbp;
        if (typeof GPXParser !== 'undefined') {
          const lvlInfo = GPXParser.getIBPLevel(newIbp);
          this.hikeToEdit.ibpLevel = lvlInfo.level;
          this.hikeToEdit.difficulty = lvlInfo.label;
        }
      }
    }

    const updatedGpx = GPXParser.exportToGpxString(this.hikeToEdit);
    await StorageManager.saveHike(this.hikeToEdit, updatedGpx);

    // Auto-update Supabase Cloud in background
    try {
      const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
      const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
      const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
      if (supaUrl && supaKey) {
        StorageManager.pushHikeToSupabase(this.hikeToEdit, supaUrl, supaKey).catch(e => console.warn("Supabase auto-edit error:", e));
      }
    } catch (e) {}

    this.closeEditModal();
    this.applyFiltersAndRender();
    this.renderManagementList();

    if (this.selectedHike && this.selectedHike.id === this.hikeToEdit.id) {
      this.showHikePreviewPanel(this.hikeToEdit);
    }

    this.showToast("Randonnée modifiée avec succès !", "success");
  }

  // =========================================================================
  // DELETE MODAL (🗑️ Corbeille avec confirmation)
  // =========================================================================
  openDeleteModal(hike) {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule. Seul l'administrateur peut supprimer des parcours de cette base.", "warning");
      return;
    }
    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_edit')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de supprimer des randonnées.", "error");
      return;
    }
    this.hikeToDelete = hike;
    const modal = document.getElementById('delete-hike-modal');
    if (!modal) return;

    const nameEl = document.getElementById('delete-modal-hike-name');
    if (nameEl) nameEl.textContent = hike.name || 'cette randonnée';
    modal.classList.remove('hidden');
  }

  closeDeleteModal() {
    const modal = document.getElementById('delete-hike-modal');
    if (modal) modal.classList.add('hidden');
    this.hikeToDelete = null;
  }

  async confirmDeleteModal() {
    if (!this.hikeToDelete) {
      this.closeDeleteModal();
      return;
    }

    const targetHike = this.hikeToDelete;
    const targetId = targetHike.id;
    const targetName = targetHike.name;
    const targetFilename = targetHike.filename;

    try {
      await StorageManager.deleteHike(targetId, targetFilename);
      this.allHikes = this.allHikes.filter(h => h.id !== targetId && h.name !== targetName);

      // Auto-delete from Supabase Cloud in background
      try {
        const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
        const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
        const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
        if (supaUrl && supaKey) {
          StorageManager.deleteFromSupabase(targetId, supaUrl, supaKey).catch(e => console.warn("Supabase auto-delete error:", e));
        }
      } catch (e) {}

      if (this.selectedHike && (this.selectedHike.id === targetId || this.selectedHike.name === targetName)) {
        this.deselectHike();
      }

      this.showToast(`Randonnée « ${targetName} » supprimée définitivement.`, "info");
    } catch (err) {
      console.error("Erreur suppression:", err);
      this.allHikes = this.allHikes.filter(h => h.id !== targetId && h.name !== targetName);
      this.showToast("Randonnée supprimée.", "info");
    } finally {
      this.closeDeleteModal();
      this.applyFiltersAndRender();
      this.renderManagementList();
    }
  }

  // =========================================================================
  // GESTION DES DOUBLONS DANS LA BIBLIOTHÈQUE
  // (Même trace, même kilométrage, même dénivelé)
  // =========================================================================

  handleSearchDuplicatesClick() {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule. Basculez sur la base Randonneurs Sanaryens pour gérer les doublons.", "warning");
      return;
    }

    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_edit') && !AuthManager.isAdmin()) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de modifier ou supprimer des randonnées.", "error");
      return;
    }

    if (!this.allHikes || this.allHikes.length < 2) {
      this.showToast("Votre bibliothèque ne contient pas assez de randonnées pour rechercher des doublons.", "info");
      return;
    }

    const groups = this.findAllDuplicateGroups();
    if (!groups || groups.length === 0) {
      this.showToast("✅ Aucun doublon détecté ! Toutes vos randonnées ont des caractéristiques ou tracés distincts.", "success");
      return;
    }

    this.activeDuplicateGroups = groups;
    this.renderDuplicatesModal();
    const modal = document.getElementById('duplicates-manager-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeDuplicatesModal() {
    const modal = document.getElementById('duplicates-manager-modal');
    if (modal) modal.classList.add('hidden');
    this.activeDuplicateGroups = [];
  }

  areHikesDuplicates(h1, h2) {
    if (!h1 || !h2 || h1.id === h2.id) return false;

    // 1. Kilométrage similaire (< 0.4 km ou < 5%)
    const d1 = Number(h1.distanceKm || 0);
    const d2 = Number(h2.distanceKm || 0);
    const diffDistKm = Math.abs(d1 - d2);
    const maxDist = Math.max(d1, d2, 1);
    const distPct = diffDistKm / maxDist;
    const isSameDist = (diffDistKm <= 0.4) || (distPct <= 0.05);
    if (!isSameDist) return false;

    // 2. Dénivelé similaire (< 35 m ou < 8%)
    const ele1 = Number(h1.elevationGain || 0);
    const ele2 = Number(h2.elevationGain || 0);
    const diffEle = Math.abs(ele1 - ele2);
    const maxEle = Math.max(ele1, ele2, 1);
    const elePct = diffEle / maxEle;
    const isSameEle = (diffEle <= 35) || (elePct <= 0.08);
    if (!isSameEle) return false;

    // 3. Départ géographique
    let distStartMeters = Infinity;
    if (h1.startPoint && h2.startPoint) {
      distStartMeters = GPXParser.haversineDistance(
        h1.startPoint.lat, h1.startPoint.lon,
        h2.startPoint.lat, h2.startPoint.lon
      ) * 1000;
    }

    // 4. Arrivée géographique (si disponible)
    let distEndMeters = Infinity;
    const p1 = h1.points || [];
    const p2 = h2.points || [];
    const end1 = h1.endPoint || (p1.length > 0 ? p1[p1.length - 1] : null);
    const end2 = h2.endPoint || (p2.length > 0 ? p2[p2.length - 1] : null);
    if (end1 && end2) {
      distEndMeters = GPXParser.haversineDistance(end1.lat, end1.lon, end2.lat, end2.lon) * 1000;
    }

    const startMatches = distStartMeters <= 450;
    const endMatches = (distEndMeters === Infinity) || (distEndMeters <= 450);

    // 5. Comparaison des coordonnées du tracé (si points disponibles)
    let trackMatches = true;
    if (p1.length >= 10 && p2.length >= 10) {
      const sampleFractions = [0.2, 0.4, 0.6, 0.8];
      let totalMinDist = 0;
      for (const frac of sampleFractions) {
        const pt1 = p1[Math.floor((p1.length - 1) * frac)];
        let minD = Infinity;
        const step = Math.max(1, Math.floor(p2.length / 30));
        for (let k = 0; k < p2.length; k += step) {
          const pt2 = p2[k];
          const d = GPXParser.haversineDistance(pt1.lat, pt1.lon, pt2.lat, pt2.lon) * 1000;
          if (d < minD) minD = d;
        }
        totalMinDist += minD;
      }
      const avgDist = totalMinDist / sampleFractions.length;
      trackMatches = avgDist <= 450;
    }

    if (startMatches && endMatches && trackMatches) {
      const dStartStr = distStartMeters !== Infinity ? ` (départ à ${Math.round(distStartMeters)} m)` : '';
      return {
        isDuplicate: true,
        reason: `Même tracé${dStartStr}, longueur équivalente (${d1} km vs ${d2} km) et dénivelé identique (+${ele1}m vs +${ele2}m).`
      };
    }

    // Cas de secours : Même nom exact et départ à moins de 1 km
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
    if (norm(h1.name) && norm(h1.name) === norm(h2.name) && distStartMeters <= 1000) {
      return {
        isDuplicate: true,
        reason: `Nom identique (« ${h1.name} »), départ proche (${Math.round(distStartMeters)} m) et métriques équivalentes.`
      };
    }

    return false;
  }

  findAllDuplicateGroups() {
    const hikes = this.allHikes || [];
    if (hikes.length < 2) return [];

    const adj = new Map();
    hikes.forEach(h => adj.set(h.id, []));
    const edgeReasons = new Map();

    for (let i = 0; i < hikes.length; i++) {
      for (let j = i + 1; j < hikes.length; j++) {
        const h1 = hikes[i];
        const h2 = hikes[j];
        const match = this.areHikesDuplicates(h1, h2);
        if (match) {
          adj.get(h1.id).push(h2.id);
          adj.get(h2.id).push(h1.id);
          const key = [h1.id, h2.id].sort().join('__');
          edgeReasons.set(key, match.reason);
        }
      }
    }

    const visited = new Set();
    const groups = [];

    for (const h of hikes) {
      if (visited.has(h.id)) continue;
      const neighbors = adj.get(h.id) || [];
      if (neighbors.length === 0) continue;

      const groupIds = [];
      const queue = [h.id];
      visited.add(h.id);

      while (queue.length > 0) {
        const currId = queue.shift();
        groupIds.push(currId);
        for (const nxt of (adj.get(currId) || [])) {
          if (!visited.has(nxt)) {
            visited.add(nxt);
            queue.push(nxt);
          }
        }
      }

      if (groupIds.length > 1) {
        const groupHikes = groupIds.map(id => hikes.find(x => x.id === id)).filter(Boolean);

        // Algorithme de pré-sélection de la randonnée la plus complète à conserver :
        const scoreHike = (hk) => {
          let score = 0;
          if (hk.notes && hk.notes.trim().length > 5) score += 50;
          if (hk.points && hk.points.length > 0) score += Math.min(30, hk.points.length / 50);
          if (hk.ajoutee_par) score += 10;
          if (/\b(bis|copie|copy|\(\d+\))\b/i.test(hk.name)) score -= 40;
          if (hk.created_at || hk.date_ajout) score += 5;
          return score;
        };

        groupHikes.sort((a, b) => scoreHike(b) - scoreHike(a));

        const first = groupHikes[0];
        const second = groupHikes[1];
        const key = [first.id, second.id].sort().join('__');
        const reason = edgeReasons.get(key) || 
          `Tracé et caractéristiques identiques (${first.distanceKm} km, +${first.elevationGain}m).`;

        groups.push({
          id: `group_${groups.length + 1}`,
          hikes: groupHikes,
          keepId: groupHikes[0].id,
          reason: reason
        });
      }
    }

    return groups;
  }

  renderDuplicatesModal() {
    const modalBody = document.getElementById('duplicates-modal-body');
    const modalSubtitle = document.getElementById('duplicates-modal-subtitle');
    const modalSummary = document.getElementById('duplicates-modal-summary');
    const applyBtn = document.getElementById('btn-apply-duplicates-clean');
    const applyBtnText = document.getElementById('btn-apply-duplicates-text');

    if (!modalBody) return;
    modalBody.innerHTML = '';

    const groups = this.activeDuplicateGroups || [];
    let totalDuplicatesToDelete = 0;
    groups.forEach(g => {
      totalDuplicatesToDelete += (g.hikes.length - 1);
    });

    if (modalSubtitle) {
      modalSubtitle.textContent = `${groups.length} groupe${groups.length > 1 ? 's' : ''} de doublons détecté${groups.length > 1 ? 's' : ''} (${totalDuplicatesToDelete} randonnée${totalDuplicatesToDelete > 1 ? 's' : ''} en trop).`;
    }

    if (modalSummary) {
      modalSummary.innerHTML = `
        <span class="font-bold text-slate-800">${groups.length}</span> groupe(s) • 
        <span class="font-bold text-rose-600">${totalDuplicatesToDelete}</span> doublon(s) à supprimer • 
        <span class="font-bold text-emerald-700">${groups.length}</span> randonnée(s) conservée(s)
      `;
    }

    if (applyBtn) {
      applyBtn.disabled = totalDuplicatesToDelete === 0;
    }
    if (applyBtnText) {
      applyBtnText.textContent = `Supprimer les ${totalDuplicatesToDelete} doublon(s) sélectionnés`;
    }

    if (groups.length === 0) {
      modalBody.innerHTML = `
        <div class="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-500">
          <div class="text-3xl mb-2">🎉</div>
          <div class="font-bold text-slate-800 text-base">Aucun doublon restant</div>
          <div class="text-xs text-slate-500 mt-1">Toutes vos randonnées sont uniques et conservées.</div>
        </div>
      `;
      return;
    }

    groups.forEach((group, gIdx) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'bg-white border-2 border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4';
      groupEl.dataset.groupId = group.id;

      const hikesHtml = group.hikes.map(hike => {
        const isKept = (hike.id === group.keepId);
        const cardBorder = isKept 
          ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/50' 
          : 'border-slate-200 bg-slate-50/60 opacity-85 hover:border-slate-300';
        
        return `
          <div class="duplicate-hike-card p-3 sm:p-4 rounded-xl border-2 transition cursor-pointer ${cardBorder}" data-hike-id="${hike.id}">
            <div class="flex items-start sm:items-center justify-between gap-3">
              <label class="flex items-start sm:items-center gap-3 cursor-pointer flex-1 min-w-0">
                <input type="radio" name="keep_${group.id}" value="${hike.id}" ${isKept ? 'checked' : ''} class="mt-0.5 sm:mt-0 w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-sm sm:text-base text-slate-900 truncate">${this.escapeHtml(hike.name)}</span>
                    ${isKept ? `
                      <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-extrabold flex items-center gap-1 select-none">
                        <span>✅</span> <span>À CONSERVER</span>
                      </span>
                    ` : `
                      <span class="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold flex items-center gap-1 select-none">
                        <span>🗑️</span> <span>SERA SUPPRIMÉE</span>
                      </span>
                    `}
                  </div>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
                    <span class="font-bold text-emerald-700">📏 ${hike.distanceKm} km</span>
                    <span class="font-bold text-emerald-700">↗️ +${hike.elevationGain}m</span>
                    <span>⛰️ ${hike.minElevation || 0}m - ${hike.maxElevation || 0}m</span>
                    <span>⏱️ ${hike.estimatedDuration || '3h30'}</span>
                    ${hike.points ? `<span>📍 ${hike.points.length} points</span>` : ''}
                    ${hike.ajoutee_par ? `<span class="font-medium text-slate-500">👤 Par : <strong class="text-slate-700">${this.escapeHtml(hike.ajoutee_par)}</strong></span>` : ''}
                  </div>
                  ${hike.notes ? `<div class="text-[11px] text-slate-600 line-clamp-2 mt-1.5 bg-white/80 p-1.5 rounded border border-slate-200/60 italic">« ${this.escapeHtml(hike.notes)} »</div>` : ''}
                </div>
              </label>

              <button type="button" class="btn-preview-dup px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1 flex-shrink-0 cursor-pointer" title="Aperçu sur la carte">
                <span>🗺️</span> <span class="hidden sm:inline">Voir</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      groupEl.innerHTML = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold">Groupe #${gIdx + 1}</span>
              <span class="text-xs sm:text-sm font-bold text-slate-800">${group.hikes.length} randonnées en doublon</span>
            </div>
            <div class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span>📌</span> <span>${this.escapeHtml(group.reason)}</span>
            </div>
          </div>
          <button type="button" class="btn-clean-single-group text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline flex items-center gap-1 self-end sm:self-auto cursor-pointer" title="Supprimer immédiatement les doublons de ce groupe uniquement">
            <span>🗑️</span> <span>Nettoyer ce groupe</span>
          </button>
        </div>

        <div class="space-y-2.5">
          ${hikesHtml}
        </div>
      `;

      // Event listener on radio & cards
      groupEl.querySelectorAll('.duplicate-hike-card').forEach(card => {
        const hikeId = card.dataset.hikeId;
        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-preview-dup')) return;
          this.setGroupKeepHike(group.id, hikeId);
        });

        const previewBtn = card.querySelector('.btn-preview-dup');
        if (previewBtn) {
          previewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const h = group.hikes.find(x => x.id === hikeId);
            if (h) {
              this.closeDuplicatesModal();
              this.showHikeOnMap(h);
              this.showToast(`Affichage du tracé de « ${h.name} » sur la carte`, "info");
            }
          });
        }
      });

      // Single group cleanup button
      const cleanGroupBtn = groupEl.querySelector('.btn-clean-single-group');
      if (cleanGroupBtn) {
        cleanGroupBtn.addEventListener('click', () => {
          this.cleanSingleDuplicateGroup(group.id);
        });
      }

      modalBody.appendChild(groupEl);
    });
  }

  setGroupKeepHike(groupId, hikeId) {
    const grp = (this.activeDuplicateGroups || []).find(g => g.id === groupId);
    if (!grp) return;
    grp.keepId = hikeId;
    this.renderDuplicatesModal();
  }

  async cleanSingleDuplicateGroup(groupId) {
    const grp = (this.activeDuplicateGroups || []).find(g => g.id === groupId);
    if (!grp) return;

    const toDelete = grp.hikes.filter(h => h.id !== grp.keepId);
    if (toDelete.length === 0) return;

    const keptHike = grp.hikes.find(h => h.id === grp.keepId);
    const confirmMsg = `Confirmez-vous la suppression de ${toDelete.length} randonnée(s) en doublon dans ce groupe ?\n\n` +
      `Randonnée conservée : « ${keptHike ? keptHike.name : ''} »\n` +
      `Randonnées supprimées : ${toDelete.map(h => '« ' + h.name + ' »').join(', ')}`;

    if (!confirm(confirmMsg)) return;

    for (const h of toDelete) {
      try {
        await StorageManager.deleteHike(h.id, h.filename);
        this.allHikes = this.allHikes.filter(x => x.id !== h.id);
        
        // Auto-delete Supabase Cloud in background
        try {
          const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
          const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
          const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
          if (supaUrl && supaKey) {
            StorageManager.deleteFromSupabase(h.id, supaUrl, supaKey).catch(e => console.warn(e));
          }
        } catch (e) {}
      } catch (err) {
        console.warn("Erreur suppression doublon :", err);
      }
    }

    this.activeDuplicateGroups = this.activeDuplicateGroups.filter(g => g.id !== groupId);
    this.applyFiltersAndRender();
    this.renderManagementList();
    this.renderDuplicatesModal();

    this.showToast(`Groupe nettoyé : ${toDelete.length} doublon(s) supprimé(s).`, "success");

    if (this.activeDuplicateGroups.length === 0) {
      setTimeout(() => this.closeDuplicatesModal(), 1200);
    }
  }

  async executeApplyDuplicatesClean() {
    const groups = this.activeDuplicateGroups || [];
    if (groups.length === 0) return;

    const allToDelete = [];
    groups.forEach(g => {
      g.hikes.forEach(h => {
        if (h.id !== g.keepId) {
          allToDelete.push(h);
        }
      });
    });

    if (allToDelete.length === 0) {
      this.showToast("Aucun doublon à supprimer.", "info");
      return;
    }

    const confirmMsg = `Confirmez-vous la suppression définitive de ${allToDelete.length} randonnée(s) en doublon ?\n\n` +
      `Les ${groups.length} randonnées choisies seront conservées.\nCette action est irréversible.`;

    if (!confirm(confirmMsg)) return;

    let deletedCount = 0;
    const deleteBtn = document.getElementById('btn-apply-duplicates-clean');
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.innerHTML = `<span>⏳</span> Suppression en cours...`;
    }

    try {
      for (const h of allToDelete) {
        try {
          await StorageManager.deleteHike(h.id, h.filename);
          this.allHikes = this.allHikes.filter(x => x.id !== h.id);
          deletedCount++;

          // Auto-delete Supabase
          try {
            const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
            const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
            const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
            if (supaUrl && supaKey) {
              StorageManager.deleteFromSupabase(h.id, supaUrl, supaKey).catch(e => console.warn(e));
            }
          } catch (e) {}
        } catch (err) {
          console.warn("Erreur suppression doublon :", err);
        }
      }

      this.closeDuplicatesModal();
      this.applyFiltersAndRender();
      this.renderManagementList();
      this.showToast(`✅ Nettoyage terminé : ${deletedCount} doublon(s) supprimé(s) avec succès !`, "success");
    } finally {
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `<span>🗑️</span> <span id="btn-apply-duplicates-text">Supprimer les doublons sélectionnés</span>`;
      }
    }
  }

  // =========================================================================
  // RESTITUTION & PREVIEWS
  // =========================================================================
  handleHikeHover(hike) {
    this.cancelHoverClear();
    if (hike) {
      this.hoveredHike = hike;
      if (window.MapManagerInstance) {
        window.MapManagerInstance.hoveredHike = hike;
        window.MapManagerInstance.displayTrack(hike, false);
      }
      this.showHikePreviewPanel(hike);
    } else {
      this.handleHikeHoverEnd();
    }
  }

  handleHikeHoverEnd() {
    this.scheduleHoverClear();
  }

  scheduleHoverClear(delayMs = 250) {
    if (this.isHikePinned) return;
    this.cancelHoverClear();
    this.hoverClearTimer = setTimeout(() => {
      if (this.isHikePinned) return;
      const previewPanel = document.getElementById('hike-preview-panel');
      const isOver = this.isMouseOverPreview || (previewPanel && previewPanel.matches && previewPanel.matches(':hover'));
      if (isOver) {
        // La souris est sur le panneau d'aperçu : on maintient l'affichage stable sans clignotement
        return;
      }

      this.hoveredHike = null;
      if (window.MapManagerInstance) {
        window.MapManagerInstance.hoveredHike = null;
      }

      if (this.selectedHike) {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.displayTrack(this.selectedHike, true);
        }
        this.showHikePreviewPanel(this.selectedHike);
      } else {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.clearTrack();
        }
        this.hideHikePreviewPanel();
      }
    }, delayMs);
  }

  cancelHoverClear() {
    if (this.hoverClearTimer) {
      clearTimeout(this.hoverClearTimer);
      this.hoverClearTimer = null;
    }
  }

  handleHikeSelect(hike) {
    if (!hike) return;
    this.cancelHoverClear();
    this.selectedHike = hike;
    if (window.MapManagerInstance) {
      window.MapManagerInstance.selectHike(hike, true, false);
    }
    this.showHikePreviewPanel(hike);
    this.updateTableSelection(hike.id);
  }

  updateTableSelection(selectedId) {
    const rows = document.querySelectorAll('#hikes-table-body tr[data-hike-id]');
    rows.forEach(tr => {
      if (selectedId && tr.dataset.hikeId === selectedId) {
        tr.classList.add('bg-emerald-50', 'border-emerald-300', 'font-semibold');
      } else {
        tr.classList.remove('bg-emerald-50', 'border-emerald-300', 'font-semibold');
      }
    });
  }

  async showHikePreviewPanel(hike) {
    const previewPanel = document.getElementById('hike-preview-panel');
    if (!previewPanel || !hike) return;

    if ((!hike.points || hike.points.length === 0) && typeof StorageManager !== 'undefined') {
      await StorageManager.ensureHikeTrackLoaded(hike);
    }

    // Assurer que le tracé a ses distances cumulées calculées
    if (hike.points && hike.points.length > 0 && typeof hike.points[0].dist === 'undefined') {
      let cumulative = 0;
      hike.points[0].dist = 0;
      for (let i = 1; i < hike.points.length; i++) {
        const p1 = hike.points[i - 1];
        const p2 = hike.points[i];
        if (typeof GPXParser !== 'undefined') {
          cumulative += GPXParser.haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
        } else {
          // Haversine direct
          const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
          const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((p1.lat * Math.PI) / 180) * Math.cos((p2.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
          cumulative += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        p2.dist = Math.round(cumulative * 100) / 100;
      }
      if (!hike.distanceKm) {
        hike.distanceKm = Math.round(cumulative * 10) / 10;
      }
    }

    // Min & Max elevation
    if ((!hike.minElevation || !hike.maxElevation) && hike.points && hike.points.length > 0) {
      let minE = Infinity, maxE = -Infinity;
      hike.points.forEach(p => {
        if (p.ele < minE) minE = p.ele;
        if (p.ele > maxE) maxE = p.ele;
      });
      if (minE !== Infinity) {
        hike.minElevation = Math.round(minE);
        hike.maxElevation = Math.round(maxE);
      }
    }

    previewPanel.classList.remove('hidden');

    // Détection immédiate si la souris se trouve déjà sous la zone d'apparition du panneau
    if (previewPanel.matches && previewPanel.matches(':hover')) {
      this.isMouseOverPreview = true;
      this.cancelHoverClear();
    }

    const distDisplay = hike.distanceKm || (hike.distance ? String(hike.distance) : '0');
    const dplusDisplay = (hike.elevationGain !== undefined) ? Math.round(hike.elevationGain) : 0;
    const dmoinsDisplay = (hike.elevationLoss !== undefined) ? Math.round(hike.elevationLoss) : 0;
    const altMin = (hike.minElevation !== undefined) ? hike.minElevation : 0;
    const altMax = (hike.maxElevation !== undefined) ? hike.maxElevation : 0;

    document.getElementById('preview-title').textContent = hike.name || 'Randonnée';
    document.getElementById('preview-dist').textContent = `${distDisplay} km`;
    document.getElementById('preview-dplus').textContent = `+${dplusDisplay}m`;
    document.getElementById('preview-dmoins').textContent = `-${dmoinsDisplay}m`;
    document.getElementById('preview-alt').textContent = `${altMin}m / ${altMax}m`;
    document.getElementById('preview-duration').textContent = hike.estimatedDuration || '3h30';
    document.getElementById('preview-notes').textContent = hike.notes || 'Aucune note enregistrée';

    const ibpVal = (typeof hike.ibp === 'number') ? hike.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(hike) : 50);
    const ibpInfo = (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(ibpVal) : { level: 3, label: 'Peu difficile', color: '#ea580c' };
    const ibpBox = document.getElementById('preview-ibp-box');
    const ibpEl = document.getElementById('preview-ibp');
    if (ibpEl && ibpBox) {
      ibpBox.style.backgroundColor = `${ibpInfo.color}15`;
      ibpBox.style.borderColor = `${ibpInfo.color}40`;
      ibpBox.style.color = ibpInfo.color;
      ibpBox.title = `Indice IBP : ${ibpVal} • Niveau ${ibpInfo.level} (${ibpInfo.label})`;
      ibpEl.innerHTML = `<span class="w-3.5 h-3.5 rounded text-[9px] font-black text-white flex items-center justify-center" style="background-color:${ibpInfo.color}">${ibpInfo.level}</span><span>${ibpVal}</span>`;
    }

    const isCarteMode = window.location.hash.startsWith('#carte') || (window.PortalRouterInstance && window.PortalRouterInstance.currentView === 'carte') || (window.portalRouter && window.portalRouter.currentView === 'carte');
    const btnDl = document.getElementById('preview-btn-download');
    if (btnDl) {
      if (isCarteMode) {
        btnDl.classList.add('hidden');
        btnDl.style.setProperty('display', 'none', 'important');
        btnDl.onclick = null;
      } else {
        btnDl.classList.remove('hidden');
        btnDl.style.removeProperty('display');
        btnDl.onclick = () => this.openDownloadModal(hike);
      }
    }

    // Assurer l'instance ElevationProfile
    if (!this.elevationProfile && typeof ElevationProfile !== 'undefined') {
      this.elevationProfile = new ElevationProfile('elevation-chart-container');
      window.ElevationProfileInstance = this.elevationProfile;
    }

    if (this.elevationProfile) {
      this.elevationProfile.render(hike, 
        (point) => { if (window.MapManagerInstance) window.MapManagerInstance.setCursorPosition(point); },
        () => { if (window.MapManagerInstance) window.MapManagerInstance.clearCursorPosition(); }
      );
    }
  }

  hideHikePreviewPanel() {
    const previewPanel = document.getElementById('hike-preview-panel');
    if (previewPanel && !this.selectedHike && !this.isHikePinned) {
      previewPanel.classList.add('hidden');
      this.isMouseOverPreview = false;
    }
  }

  /**
   * Configuration du déplacement tactile & souris de la petite fenêtre d'aperçu
   */
  setupDraggablePreviewPanel() {
    const panel = document.getElementById('hike-preview-panel');
    const container = document.getElementById('map-column');
    if (!panel || !container) return;

    // Empêcher Leaflet de capter les clics et le défilement sur le panneau
    if (typeof L !== 'undefined' && L.DomEvent) {
      L.DomEvent.disableClickPropagation(panel);
      L.DomEvent.disableScrollPropagation(panel);
    }

    const dragHandle = document.getElementById('preview-drag-handle');
    const titleHeader = panel.querySelector('.flex.items-start');
    const resetBtn = document.getElementById('btn-reset-preview-pos');

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let userMoved = false;

    // Bouton de réinitialisation vers le coin bas-gauche d'origine
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        userMoved = false;
        panel.style.left = '';
        panel.style.top = '';
        panel.style.bottom = '';
        panel.style.right = '';
        panel.style.width = '';
        resetBtn.classList.add('hidden');
      });
    }

    const onStart = (e) => {
      // Ignorer si clic sur un bouton, champ de saisie, canvas ou lien
      if (e.target.closest('button, input, select, a, canvas, #elevation-chart-container')) return;

      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      if (!userMoved) {
        initialLeft = panelRect.left - containerRect.left;
        initialTop = panelRect.top - containerRect.top;
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
        panel.style.left = `${initialLeft}px`;
        panel.style.top = `${initialTop}px`;
        panel.style.width = `${panelRect.width}px`;
      } else {
        initialLeft = panel.offsetLeft;
        initialTop = panel.offsetTop;
      }

      startX = clientX;
      startY = clientY;
      isDragging = true;
      userMoved = true;

      panel.style.transition = 'none';
      panel.classList.add('ring-2', 'ring-emerald-500/70', 'shadow-2xl');
      if (dragHandle) dragHandle.classList.add('cursor-grabbing');
      if (resetBtn) resetBtn.classList.remove('hidden');

      e.stopPropagation();
    };

    const onMove = (e) => {
      if (!isDragging) return;

      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

      const dx = clientX - startX;
      const dy = clientY - startY;

      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      const minX = 4;
      const maxX = Math.max(minX, containerRect.width - panelRect.width - 4);
      const minY = 4;
      const maxY = Math.max(minY, containerRect.height - panelRect.height - 4);

      const targetX = Math.max(minX, Math.min(maxX, initialLeft + dx));
      const targetY = Math.max(minY, Math.min(maxY, initialTop + dy));

      panel.style.left = `${targetX}px`;
      panel.style.top = `${targetY}px`;

      e.preventDefault();
      e.stopPropagation();
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      panel.style.transition = '';
      panel.classList.remove('ring-2', 'ring-emerald-500/70');
      if (dragHandle) dragHandle.classList.remove('cursor-grabbing');
    };

    // Attacher aux poignées de glissement (handle supérieur et barre de titre)
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', onStart);
      dragHandle.addEventListener('touchstart', onStart, { passive: false });
    }
    if (titleHeader) {
      titleHeader.addEventListener('mousedown', onStart);
      titleHeader.addEventListener('touchstart', onStart, { passive: false });
    }

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    // Ajuster si redimensionnement de l'écran pour rester dans la carte
    window.addEventListener('resize', () => {
      if (!userMoved || panel.classList.contains('hidden')) return;
      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const maxX = Math.max(4, containerRect.width - panelRect.width - 4);
      const maxY = Math.max(4, containerRect.height - panelRect.height - 4);
      if (panel.offsetLeft > maxX) panel.style.left = `${maxX}px`;
      if (panel.offsetTop > maxY) panel.style.top = `${maxY}px`;
    });
  }

  getLocalPlaceMatches(query) {
    const q = (query || '').toLowerCase().trim();
    if (q.length < 2) return [];

    const commonPlaces = [
      { title: "Sanary-sur-Mer", subtitle: "83110, Var, Provence-Alpes-Côte d'Azur", lat: 43.1187, lon: 5.8037, typeLabel: "Ville", icon: "🏙️" },
      { title: "Bandol", subtitle: "83150, Var, Provence-Alpes-Côte d'Azur", lat: 43.1364, lon: 5.7533, typeLabel: "Ville", icon: "🏙️" },
      { title: "Ollioules", subtitle: "83190, Var, Provence-Alpes-Côte d'Azur", lat: 43.1397, lon: 5.8481, typeLabel: "Ville", icon: "🏙️" },
      { title: "Six-Fours-les-Plages", subtitle: "83140, Var, Provence-Alpes-Côte d'Azur", lat: 43.1066, lon: 5.8396, typeLabel: "Ville", icon: "🏙️" },
      { title: "Toulon", subtitle: "83000, Var, Provence-Alpes-Côte d'Azur", lat: 43.1242, lon: 5.9280, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Seyne-sur-Mer", subtitle: "83500, Var, Provence-Alpes-Côte d'Azur", lat: 43.1009, lon: 5.8824, typeLabel: "Ville", icon: "🏙️" },
      { title: "Saint-Mandrier-sur-Mer", subtitle: "83430, Var, Provence-Alpes-Côte d'Azur", lat: 43.0789, lon: 5.9288, typeLabel: "Ville", icon: "🏙️" },
      { title: "Le Beausset", subtitle: "83330, Var, Provence-Alpes-Côte d'Azur", lat: 43.1978, lon: 5.8039, typeLabel: "Ville", icon: "🏙️" },
      { title: "Le Castellet", subtitle: "83330, Var, Provence-Alpes-Côte d'Azur", lat: 43.2036, lon: 5.7769, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Cadière-d'Azur", subtitle: "83740, Var, Provence-Alpes-Côte d'Azur", lat: 43.1956, lon: 5.7561, typeLabel: "Ville", icon: "🏙️" },
      { title: "Saint-Cyr-sur-Mer", subtitle: "83270, Var, Provence-Alpes-Côte d'Azur", lat: 43.1819, lon: 5.7142, typeLabel: "Ville", icon: "🏙️" },
      { title: "Évenos / Sainte-Anne", subtitle: "83330, Var, Provence-Alpes-Côte d'Azur", lat: 43.1664, lon: 5.8286, typeLabel: "Village", icon: "📍" },
      { title: "Signes", subtitle: "83870, Var, Provence-Alpes-Côte d'Azur", lat: 43.2922, lon: 5.8631, typeLabel: "Village", icon: "📍" },
      { title: "Cassis", subtitle: "13260, Bouches-du-Rhône", lat: 43.2144, lon: 5.5381, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Ciotat", subtitle: "13600, Bouches-du-Rhône", lat: 43.1748, lon: 5.6047, typeLabel: "Ville", icon: "🏙️" },
      { title: "Roquefort-la-Bédoule", subtitle: "13830, Bouches-du-Rhône", lat: 43.2483, lon: 5.5908, typeLabel: "Village", icon: "📍" },
      { title: "Hyères", subtitle: "83400, Var, Provence-Alpes-Côte d'Azur", lat: 43.1206, lon: 6.1286, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Valette-du-Var", subtitle: "83160, Var, Provence-Alpes-Côte d'Azur", lat: 43.1378, lon: 5.9831, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Garde", subtitle: "83130, Var, Provence-Alpes-Côte d'Azur", lat: 43.1250, lon: 6.0125, typeLabel: "Ville", icon: "🏙️" },
      { title: "Le Pradet", subtitle: "83220, Var, Provence-Alpes-Côte d'Azur", lat: 43.1064, lon: 6.0222, typeLabel: "Ville", icon: "🏙️" },
      { title: "Carqueiranne", subtitle: "83320, Var, Provence-Alpes-Côte d'Azur", lat: 43.0947, lon: 6.0747, typeLabel: "Ville", icon: "🏙️" },
      { title: "Solliès-Pont", subtitle: "83210, Var, Provence-Alpes-Côte d'Azur", lat: 43.1906, lon: 6.0411, typeLabel: "Ville", icon: "🏙️" },
      { title: "Cuers", subtitle: "83390, Var, Provence-Alpes-Côte d'Azur", lat: 43.2375, lon: 6.0717, typeLabel: "Ville", icon: "🏙️" },
      { title: "Marseille", subtitle: "13000, Bouches-du-Rhône", lat: 43.2965, lon: 5.3698, typeLabel: "Ville", icon: "🏙️" },
      { title: "Aubagne", subtitle: "13400, Bouches-du-Rhône", lat: 43.2928, lon: 5.5708, typeLabel: "Ville", icon: "🏙️" },
      { title: "Cap Sicié / Notre-Dame du Mai", subtitle: "Massif côtier, Six-Fours / La Seyne", lat: 43.0578, lon: 5.8569, typeLabel: "Massif", icon: "⛰️" },
      { title: "Mont Faron", subtitle: "Sommet & Belvédère, Toulon", lat: 43.1539, lon: 5.9525, typeLabel: "Sommet", icon: "⛰️" },
      { title: "Le Croupatier", subtitle: "Barre rocheuse, Ollioules / Evenos", lat: 43.1611, lon: 5.8614, typeLabel: "Massif", icon: "⛰️" },
      { title: "Gros Cerveau", subtitle: "Crête panoramique, Ollioules / Sanary", lat: 43.1528, lon: 5.8194, typeLabel: "Massif", icon: "⛰️" }
    ];

    return commonPlaces
      .filter(p => p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q))
      .map(p => ({
        ...p,
        shortName: p.title,
        displayName: `${p.title} (${p.subtitle})`,
        isAddress: false
      }));
  }

  async fetchPlacesList(query, signal) {
    const cleanQuery = (query || '').trim();
    if (cleanQuery.length < 2) return [];

    const normKey = cleanQuery.toLowerCase();
    if (!this.placesCache) this.placesCache = new Map();
    if (this.placesCache.has(normKey)) {
      return this.placesCache.get(normKey);
    }

    const hasDigits = /\d/.test(cleanQuery);

    // Fonction d'aide pour générer l'émoji du drapeau national (ISO 3166-1 alpha-2)
    const getCountryFlag = (code) => {
      if (!code || typeof code !== 'string' || code.length !== 2) return '';
      try {
        const cp = code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
        return String.fromCodePoint(...cp);
      } catch (e) {
        return '';
      }
    };

    // 1. RECHERCHE MONDIALE DE TOUTES LES VILLES DU MONDE (Open-Meteo Geocoding API - 3M+ villes, sans clé, temps de réponse <100ms)
    const openMeteoPromise = (async () => {
      try {
        const omController = new AbortController();
        const omTimer = setTimeout(() => omController.abort(), 2500);
        const onAbort = () => omController.abort();
        if (signal) signal.addEventListener('abort', onAbort, { once: true });

        const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=10&language=fr&format=json`;
        const res = await fetch(u, { signal: omController.signal });
        clearTimeout(omTimer);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (res.ok) {
          const data = await res.json();
          return (data.results || []).map(r => {
            const flag = getCountryFlag(r.country_code);
            const country = r.country || '';
            const admin = r.admin1 || r.admin2 || '';
            const subParts = [admin, country].filter(Boolean);
            const subtitle = subParts.join(', ');
            const isCapital = r.feature_code === 'PPLC';
            const isPeak = ['PK', 'MT', 'HLL', 'VLC'].includes(r.feature_code);

            const icon = isPeak ? '⛰️' : (isCapital ? '🏛️' : '🏙️');
            let typeLabel = 'Ville';
            if (isPeak) typeLabel = 'Sommet';
            else if (isCapital) typeLabel = country ? `Capitale • ${country}` : 'Capitale';
            else if (country) typeLabel = `Ville • ${country}`;

            return {
              lat: r.latitude,
              lon: r.longitude,
              title: r.name,
              subtitle: subtitle,
              shortName: r.name,
              displayName: subtitle ? `${r.name} (${subtitle})` : r.name,
              icon: flag ? `${flag} ${icon}` : icon,
              typeLabel: typeLabel,
              country: country,
              countryCode: r.country_code,
              population: r.population || 0,
              isAddress: false,
              isCity: true,
              isCapital: isCapital,
              score: (isCapital ? 220 : 120) + (r.population ? Math.min(100, Math.log10(r.population) * 15) : 0)
            };
          });
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn("Erreur Open-Meteo Geocoding :", e);
      }
      return [];
    })();

    // 2. BASE ADRESSE NATIONALE (BAN) POUR ADRESSES ET RUES DE FRANCE
    const banPromise = (async () => {
      try {
        const banController = new AbortController();
        const banTimer = setTimeout(() => banController.abort(), 2000);
        const onAbort = () => banController.abort();
        if (signal) signal.addEventListener('abort', onAbort, { once: true });

        const bUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(cleanQuery)}&limit=6`;
        const bRes = await fetch(bUrl, { signal: banController.signal });
        clearTimeout(banTimer);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (bRes.ok) {
          const bData = await bRes.json();
          return (bData.features || [])
            .filter(f => f.properties && (f.properties.score > 0.35 || (hasDigits && f.properties.type === 'housenumber')))
            .map(f => {
              const props = f.properties || {};
              const type = props.type || 'locality';
              let icon = '📍';
              let typeLabel = 'Lieu';
              let score = 50;
              if (type === 'housenumber') {
                icon = '🏠';
                typeLabel = 'Adresse';
                score = hasDigits ? 280 : 70;
              } else if (type === 'street') {
                icon = '🛣️';
                typeLabel = 'Rue';
                score = hasDigits ? 220 : 80;
              } else if (type === 'municipality') {
                icon = '🏙️';
                typeLabel = 'Ville • France';
                score = 130;
              }

              const title = props.name || props.label;
              const subtitle = [props.postcode, props.city, props.context].filter(Boolean).join(', ');

              return {
                lat: f.geometry.coordinates[1],
                lon: f.geometry.coordinates[0],
                title: title,
                subtitle: subtitle,
                shortName: props.label || title,
                displayName: subtitle ? `${title} (${subtitle})` : title,
                icon: `🇫🇷 ${icon}`,
                typeLabel: typeLabel,
                country: 'France',
                countryCode: 'FR',
                isAddress: type === 'housenumber',
                isCity: type === 'municipality',
                isCapital: false,
                score: score
              };
            });
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn("Erreur BAN :", e);
      }
      return [];
    })();

    // 3. PHOTON / KOMOOT (OPENSTREETMAP MONDIAL - Sommets, Parcs, Villes et Lieux mondiaux)
    const photonPromise = (async () => {
      try {
        const phController = new AbortController();
        const phTimer = setTimeout(() => phController.abort(), 2200);
        const onAbort = () => phController.abort();
        if (signal) signal.addEventListener('abort', onAbort, { once: true });

        const pUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=6&lang=fr`;
        const pRes = await fetch(pUrl, { signal: phController.signal });
        clearTimeout(phTimer);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (pRes.ok) {
          const pData = await pRes.json();
          return (pData.features || []).map(f => {
            const p = f.properties || {};
            const flag = getCountryFlag(p.countrycode);
            const isPeak = p.osm_value === 'peak' || p.osm_key === 'natural';
            const isCity = ['city', 'town', 'village', 'capital'].includes(p.osm_value);
            const icon = isPeak ? '⛰️' : (isCity ? '🏙️' : '📍');
            const sub = [p.state, p.country].filter(Boolean).join(', ');

            return {
              lat: f.geometry.coordinates[1],
              lon: f.geometry.coordinates[0],
              title: p.name,
              subtitle: sub,
              shortName: p.name,
              displayName: sub ? `${p.name} (${sub})` : p.name,
              icon: flag ? `${flag} ${icon}` : icon,
              typeLabel: isPeak ? 'Sommet' : (p.country ? `Lieu • ${p.country}` : 'Lieu'),
              country: p.country,
              countryCode: p.countrycode,
              isAddress: Boolean(p.housenumber),
              isCity: isCity,
              isCapital: p.osm_value === 'capital',
              score: isPeak ? 95 : (isCity ? 85 : 45)
            };
          });
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn("Erreur Photon :", e);
      }
      return [];
    })();

    // Exécution parallèle des sources
    const [omSettled, banSettled, phSettled] = await Promise.allSettled([
      openMeteoPromise,
      banPromise,
      photonPromise
    ]);

    const omItems = (omSettled.status === 'fulfilled' && omSettled.value) ? omSettled.value : [];
    const banItems = (banSettled.status === 'fulfilled' && banSettled.value) ? banSettled.value : [];
    const phItems = (phSettled.status === 'fulfilled' && phSettled.value) ? phSettled.value : [];

    const candidates = [...omItems, ...banItems, ...phItems];

    // Attribution des scores de pertinence textuelle
    const qLower = normKey;
    candidates.forEach(item => {
      const tLower = (item.title || '').toLowerCase();
      if (tLower === qLower) {
        item.score += 500; // Correspondance exacte du nom (ex: "Rome" -> Rome, Italie)
      } else if (tLower.startsWith(qLower)) {
        item.score += 250;
      } else if (tLower.includes(qLower)) {
        item.score += 50;
      }
      if (hasDigits && item.isAddress) {
        item.score += 300;
      }
    });

    // Tri par score de pertinence décroissant
    candidates.sort((a, b) => b.score - a.score);

    // Déduplication géographique
    const combined = [];
    candidates.forEach(p => {
      if (!p.title || isNaN(p.lat) || isNaN(p.lon)) return;
      const exists = combined.some(c => {
        const sameTitle = c.title.toLowerCase() === p.title.toLowerCase();
        const distKm = GPXParser.haversineDistance(c.lat, c.lon, p.lat, p.lon);
        return (sameTitle && distKm < 50) || distKm < 8;
      });
      if (!exists) {
        combined.push(p);
      }
    });

    const finalResults = combined.slice(0, 10);
    this.placesCache.set(normKey, finalResults);
    return finalResults;
  }

  renderPlacesResults(places, query) {
    const resultsContainer = document.getElementById('location-autocomplete-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '';

    // Recherche GR : tous les GR via OpenStreetMap (tracé réel)
    if (typeof GrManager !== 'undefined' && GrManager.isGrQuery(query)) {
      GrManager.renderResults(resultsContainer, query, (it) => {
        const locationInput = document.getElementById('location-input');
        if (locationInput) locationInput.value = `${it.ref}${it.name && it.name !== it.ref ? ' - ' + it.name : ''}`;
      });
      return;
    }

    const namedTrails = (typeof GrManager !== 'undefined' && Array.isArray(this._lastNamedTrails))
      ? this._lastNamedTrails
      : [];

    if ((!places || places.length === 0) && namedTrails.length === 0) {
      resultsContainer.innerHTML = `
        <div class="p-3.5 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
          <span>🌍</span> Aucun lieu trouvé dans le monde pour "<b>${this.escapeHtml(query)}</b>"
        </div>`;
      resultsContainer.classList.remove('hidden');
      return;
    }

    resultsContainer.classList.remove('hidden');
    if (namedTrails.length > 0 && typeof GrManager !== 'undefined') {
      GrManager.appendTrailItemsToContainer(resultsContainer, namedTrails, (it) => {
        const locationInput = document.getElementById('location-input');
        if (locationInput) locationInput.value = `${it.ref ? it.ref + ' - ' : ''}${it.name || ''}`;
      });
    }
    (places || []).forEach(place => {
      const item = document.createElement('div');
      item.className = 'px-3.5 py-2.5 hover:bg-emerald-50 cursor-pointer transition border-b border-slate-100 last:border-b-0 flex items-start gap-3 text-left group';
      
      const isCap = place.isCapital || (place.typeLabel && place.typeLabel.includes('Capitale'));
      const isCity = place.isCity || (place.typeLabel && place.typeLabel.includes('Ville'));
      const isPeak = place.typeLabel && (place.typeLabel.includes('Sommet') || place.typeLabel.includes('Massif'));

      const badgeColor = place.isAddress 
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : isCap
        ? 'bg-purple-100 text-purple-800 border-purple-200 font-bold'
        : isCity
        ? 'bg-sky-100 text-sky-800 border-sky-200'
        : isPeak
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold'
        : 'bg-slate-100 text-slate-700 border-slate-200';

      item.innerHTML = `
        <span class="text-base select-none mt-0.5 group-hover:scale-110 transition-transform">${place.icon || '📍'}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-xs sm:text-sm text-slate-800 truncate group-hover:text-emerald-700">${this.escapeHtml(place.title)}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full border ${badgeColor} select-none whitespace-nowrap">${place.typeLabel || 'Lieu'}</span>
          </div>
          ${place.subtitle ? `<div class="text-[11px] text-slate-500 truncate mt-0.5">${this.escapeHtml(place.subtitle)}</div>` : ''}
        </div>
      `;
      
      item.addEventListener('click', () => {
        this.applySelectedPlace(place.lat, place.lon, place.displayName || place.title, place.isAddress);
      });
      resultsContainer.appendChild(item);
    });
  }

  async searchPlaces(query) {
    if (this.placesAbortController) {
      this.placesAbortController.abort();
    }
    this.placesAbortController = new AbortController();
    const signal = this.placesAbortController.signal;

    const iconEl = document.getElementById('location-search-icon');
    if (iconEl) iconEl.innerHTML = '<span class="animate-spin inline-block">⏳</span>';

    try {
      // 1. Afficher d'abord immédiatement les lieux locaux si correspondance (0 ms)
      const localMatches = this.getLocalPlaceMatches(query);
      if (localMatches.length > 0) {
        this.renderPlacesResults(localMatches, query);
      }

      // 2. Recherche mondiale (Open-Meteo + BAN + Photon) + Sentiers réputés (Francigena, WHW, Stevenson...)
      const namedPromise = (typeof GrManager !== 'undefined' && GrManager.searchNamedTrails && query.trim().length >= 3)
        ? GrManager.searchNamedTrails(query).catch(() => [])
        : Promise.resolve([]);
      const [places, namedTrails] = await Promise.all([
        this.fetchPlacesList(query, signal),
        namedPromise
      ]);
      this._lastNamedTrails = namedTrails || [];
      
      // Fusionner avec les suggestions locales si pertinentes
      const combined = [...places];
      (localMatches || []).forEach(local => {
        const exists = combined.some(c => 
          (c.title && c.title.toLowerCase() === local.title.toLowerCase()) ||
          (Math.abs(c.lat - local.lat) < 0.05 && Math.abs(c.lon - local.lon) < 0.05)
        );
        if (!exists) {
          if (local.title.toLowerCase() === query.toLowerCase().trim()) {
            combined.unshift(local);
          } else {
            combined.push(local);
          }
        }
      });

      this.renderPlacesResults(combined, query);
    } catch (e) {
      if (e.name !== 'AbortError') console.warn("Erreur recherche lieu mondial :", e);
    } finally {
      if (iconEl) iconEl.textContent = '📍';
    }
  }

  applySelectedPlace(lat, lon, label, isAddress = false) {
    const locationInput = document.getElementById('location-input');
    const resultsContainer = document.getElementById('location-autocomplete-results');
    if (locationInput) locationInput.value = label;
    if (resultsContainer) resultsContainer.classList.add('hidden');
    if (window.MapManagerInstance) {
      window.MapManagerInstance.setSearchOrigin(lat, lon, label, false);
    }
    this.applyFiltersAndRender(false);
    
    // Zoom sur le lieu : niveau rue pour une adresse (16), niveau ville sinon (12)
    const zoom = (isAddress || /\d/.test(label || '')) ? 16 : 12;
    const zoomToPlace = () => {
      const m = window.MapManagerInstance && window.MapManagerInstance.map;
      if (m) m.setView([lat, lon], zoom);
    };
    zoomToPlace();
    setTimeout(zoomToPlace, 150);
  }

  async searchAndSelectFirstPlace(query) {
    const iconEl = document.getElementById('location-search-icon');
    if (iconEl) iconEl.innerHTML = '<span class="animate-spin inline-block">⏳</span>';
    try {
      if (typeof GrManager !== 'undefined' && (GrManager.isGrQuery(query) || (GrManager.isNamedTrailQuery && GrManager.isNamedTrailQuery(query)))) {
        const trails = GrManager.isGrQuery(query) ? await GrManager.searchRemote(query) : await GrManager.searchNamedTrails(query);
        if (trails && trails.length > 0) {
          const resultsContainer = document.getElementById('location-autocomplete-results');
          if (resultsContainer) resultsContainer.classList.add('hidden');
          await GrManager.displayRemote(trails[0], window.MapManagerInstance ? window.MapManagerInstance.map : null);
          return;
        }
      }
      const places = await this.fetchPlacesList(query);
      if (places && places.length > 0) {
        const p = places[0];
        this.applySelectedPlace(p.lat, p.lon, p.displayName || p.title, p.isAddress);
        this.showToast(`Point de référence défini : ${p.displayName || p.title}`, "success");
      } else {
        this.showToast(`Aucun lieu mondial trouvé pour "${query}"`, "error");
      }
    } finally {
      if (iconEl) iconEl.textContent = '📍';
    }
  }

  useCurrentLocation() {
    if (!navigator.geolocation) {
      this.showToast("La géolocalisation n'est pas supportée par votre navigateur", "error");
      return;
    }

    this.showToast("Recherche de votre position GPS...", "info");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const placeName = await GPXParser.reverseGeocode(lat, lon);
        const locInput = document.getElementById('location-input');
        if (locInput) locInput.value = placeName || 'Ma position';

        // Si le rayon était en mode "Monde entier" (>= 2500 km), rétablir le rayon local par défaut (100 km)
        if (window.MapManagerInstance && window.MapManagerInstance.searchRadiusKm >= 2500) {
          this.setRadiusStep(this.getStepIndexForKm(100), false);
        }

        if (window.MapManagerInstance) {
          window.MapManagerInstance.setSearchOrigin(lat, lon, placeName || 'Ma position', false);
        }

        this.applyFiltersAndRender(false);

        // Afficher immédiatement le lieu où on se trouve avec le zoom maximal
        if (window.MapManagerInstance) {
          window.MapManagerInstance.zoomToLocation(lat, lon);
          setTimeout(() => {
            if (window.MapManagerInstance) {
              window.MapManagerInstance.zoomToLocation(lat, lon);
            }
          }, 150);
        }

        this.showToast(`Position trouvée : ${placeName || 'Ma position'}`, "success");
      },
      (err) => {
        console.warn("Erreur géolocalisation GPS :", err);
        this.showToast("Impossible d'accéder à votre position GPS.", "error");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  handleOriginChange(origin) {
    const locInput = document.getElementById('location-input');
    if (locInput) locInput.value = origin.name;
    this.applyFiltersAndRender();
  }

  async handlePickFolder() {
    try {
      const res = await StorageManager.pickLocalDirectory();
      if (res && res.success) {
        this.allHikes = await StorageManager.getAllHikes();
        this.updateStorageBadge();
        this.applyFiltersAndRender();
        this.renderManagementList();
        this.showToast(`Dossier connecté : ${res.folderName} (${res.hikes.length} randonnées)`, "success");
      }
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  /**
   * Bascule dynamique de la base de données active
   * (Randonneurs Sanaryens / Base JLDApps sanctuarisée)
   */
  async handleDatabaseChange(dbId) {
    if (dbId !== 'sanaryens' && dbId !== 'jldapps') {
      dbId = 'sanaryens';
    }

    this.showToast("Bascule de base de données en cours...", "info");

    try {
      await StorageManager.setActiveDatabase(dbId);

      // Si autoSync Supabase est configuré, tenter de rafraîchir en tâche de fond pour cette base
      try {
        const supaUrl = (document.getElementById('supabase-url')?.value || localStorage.getItem('sanary_supabase_url') || (window.APP_CONFIG && window.APP_CONFIG.supabaseUrl) || '').trim();
        const supaKey = (document.getElementById('supabase-key')?.value || localStorage.getItem('sanary_supabase_key') || (window.APP_CONFIG && window.APP_CONFIG.supabaseKey) || '').trim();
        const supaAutoSync = localStorage.getItem('sanary_supabase_autosync') !== 'false';
        if (supaAutoSync && supaUrl && supaKey) {
          await StorageManager.fetchFromSupabase(supaUrl, supaKey, dbId);
        }
      } catch (syncErr) {
        console.warn("Sync background au changement de base :", syncErr);
      }

      this.allHikes = await StorageManager.getAllHikes();

      // Désélectionner toute randonnée affichée
      this.deselectHike();

      // Nettoyer les marqueurs de la carte
      try {
        if (window.MapManagerInstance) {
          if (typeof window.MapManagerInstance.clearMarkers === 'function') {
            window.MapManagerInstance.clearMarkers();
          } else if (window.MapManagerInstance.markersLayer) {
            window.MapManagerInstance.markersLayer.clearLayers();
          }
        }
      } catch (mapErr) {
        console.warn("Nettoyage marqueurs :", mapErr);
      }

      // Réactualiser tous les affichages
      this.applyPermissionGuards();
      this.applyFiltersAndRender();
      this.renderManagementList();
      this.updateDatabaseStatusUI();

      if (dbId === 'sanaryens') {
        this.showToast(`🌿 Base Randonneurs Sanaryens active (${this.allHikes.length} rando${this.allHikes.length > 1 ? 's' : ''})`, "success");
      } else {
        const isAdmin = typeof AuthManager !== 'undefined' && AuthManager.isAdmin();
        if (isAdmin) {
          this.showToast(`👑 Base JLDApps active (${this.allHikes.length} randos) — Mode Admin : Pleins droits actifs`, "success");
        } else {
          this.showToast(`🔒 Base JLDApps active (${this.allHikes.length} randonnées sanctuarisées en lecture seule)`, "info");
        }
      }
    } catch (err) {
      console.error("Erreur bascule base :", err);
      this.showToast(`Erreur lors de la bascule : ${err.message}`, "error");
    }
  }

  /**
   * Mise à jour de l'ensemble des indicateurs de base de données dans l'interface
   */
  updateDatabaseStatusUI() {
    const activeDbId = StorageManager.getActiveDatabaseId();
    const isSanctuary = StorageManager.isCurrentDatabaseSanctuary();
    const isWriteProtected = StorageManager.isWriteProtected();
    const isAdmin = typeof AuthManager !== 'undefined' && AuthManager.isAdmin();
    const counts = StorageManager.getDatabaseCounts();

    // 1. Synchroniser toutes les listes déroulantes de choix de base
    ['header-db-selector', 'admin-db-selector', 'settings-db-selector'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = activeDbId;
    });

    // 2. Mettre à jour les badges de comptage dans le modal admin
    const sanaryCountEl = document.getElementById('count-db-sanaryens');
    if (sanaryCountEl) {
      sanaryCountEl.textContent = `${counts.sanaryens} rando${counts.sanaryens > 1 ? 's' : ''}`;
    }

    const jldCountEl = document.getElementById('count-db-jldapps');
    if (jldCountEl) {
      jldCountEl.textContent = `${counts.jldapps} rando${counts.jldapps > 1 ? 's' : ''}`;
    }

    // 3. Mettre à jour les styles des cartes dans le modal admin
    const cardSanary = document.getElementById('card-db-sanaryens');
    const badgeSanary = document.getElementById('badge-status-sanaryens');
    const cardJld = document.getElementById('card-db-jldapps');
    const badgeJld = document.getElementById('badge-status-jldapps');

    if (activeDbId === 'sanaryens') {
      if (cardSanary) {
        cardSanary.className = 'p-3.5 rounded-xl border-2 border-emerald-400 bg-emerald-950/60 shadow-md space-y-2 transition ring-2 ring-emerald-500/30';
      }
      if (badgeSanary) {
        badgeSanary.textContent = 'Active 🌿';
        badgeSanary.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950';
      }
      if (cardJld) {
        cardJld.className = 'p-3.5 rounded-xl border border-slate-700 bg-slate-900/50 space-y-2 opacity-80 hover:opacity-100 transition';
      }
      if (badgeJld) {
        badgeJld.textContent = isAdmin ? 'Sanctuarisée (Accès Admin) 👑' : 'Sanctuarisée 🔒';
        badgeJld.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40';
      }
    } else {
      if (cardSanary) {
        cardSanary.className = 'p-3.5 rounded-xl border border-slate-700 bg-slate-900/50 space-y-2 opacity-80 hover:opacity-100 transition';
      }
      if (badgeSanary) {
        badgeSanary.textContent = 'En attente';
        badgeSanary.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300';
      }
      if (cardJld) {
        cardJld.className = isAdmin
          ? 'p-3.5 rounded-xl border-2 border-emerald-400 bg-emerald-950/40 shadow-md space-y-2 transition ring-2 ring-emerald-500/30'
          : 'p-3.5 rounded-xl border-2 border-amber-400 bg-amber-950/40 shadow-md space-y-2 transition ring-2 ring-amber-500/30';
      }
      if (badgeJld) {
        badgeJld.textContent = isAdmin ? 'Active (Admin : Pleins droits) 👑' : 'Active (Sanctuarisée) 🔒';
        badgeJld.className = isAdmin
          ? 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950'
          : 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950';
      }
    }

    // 4. Bannières d'avertissement dans l'upload et la gestion
    const uploadBanner = document.getElementById('sanctuary-upload-banner');
    if (uploadBanner) {
      if (isSanctuary) {
        uploadBanner.classList.remove('hidden');
        if (isAdmin) {
          uploadBanner.className = 'p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-emerald-950 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in';
          uploadBanner.innerHTML = `
            <div class="flex items-start sm:items-center gap-3">
              <span class="text-2xl flex-shrink-0">👑</span>
              <div>
                <div class="font-bold text-xs sm:text-sm text-emerald-900">Base JLDApps — Mode Administrateur (Droits d'écriture complets)</div>
                <div class="text-[11px] sm:text-xs text-emerald-800 mt-0.5">Vous êtes connecté en tant qu'administrateur : vous pouvez importer de nouveaux parcours GPX sur la base JLDApps.</div>
              </div>
            </div>
            <button type="button" onclick="App.handleDatabaseChange('sanaryens')" class="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex-shrink-0 shadow-sm">
              🌿 Basculer sur Sanaryens
            </button>
          `;
        } else {
          uploadBanner.className = 'p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in';
          uploadBanner.innerHTML = `
            <div class="flex items-start sm:items-center gap-3">
              <span class="text-2xl flex-shrink-0">🔒</span>
              <div>
                <div class="font-bold text-xs sm:text-sm">Base JLDApps sanctuarisée (Lecture seule)</div>
                <div class="text-[11px] sm:text-xs text-amber-800 mt-0.5">L'importation de nouveaux fichiers GPX est verrouillée pour protéger l'historique des 139 randonnées. Seul l'administrateur peut y apporter des modifications.</div>
              </div>
            </div>
            <button type="button" onclick="App.handleDatabaseChange('sanaryens')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex-shrink-0 shadow-sm">
              🌿 Basculer sur Randonneurs Sanaryens
            </button>
          `;
        }
      } else {
        uploadBanner.classList.add('hidden');
      }
    }

    const manageBanner = document.getElementById('sanctuary-manage-banner');
    if (manageBanner) {
      if (isSanctuary) {
        manageBanner.classList.remove('hidden');
        if (isAdmin) {
          manageBanner.className = 'p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-emerald-950 shadow-sm flex items-start sm:items-center gap-3 animate-in fade-in';
          manageBanner.innerHTML = `
            <span class="text-2xl flex-shrink-0">👑</span>
            <div>
              <div class="font-bold text-xs sm:text-sm text-emerald-900">Base JLDApps — Mode Administrateur (Droits de gestion complets)</div>
              <div class="text-[11px] sm:text-xs text-emerald-800 mt-0.5">En tant qu'administrateur, vous avez accès à tous les droits d'édition (nom, notes) et de suppression sur la base JLDApps.</div>
            </div>
          `;
        } else {
          manageBanner.className = 'p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 shadow-sm flex items-start sm:items-center gap-3 animate-in fade-in';
          manageBanner.innerHTML = `
            <span class="text-2xl flex-shrink-0">🔒</span>
            <div>
              <div class="font-bold text-xs sm:text-sm">Base JLDApps sanctuarisée (Consultation seule)</div>
              <div class="text-[11px] sm:text-xs text-amber-800 mt-0.5">La modification et la suppression de parcours sont réservées à l'administrateur pour protéger l'intégrité de l'historique des 139 randonnées.</div>
            </div>
          `;
        }
      } else {
        manageBanner.classList.add('hidden');
      }
    }

    // 5. Description dans l'onglet options
    const settingsDesc = document.getElementById('settings-db-description');
    if (settingsDesc) {
      if (activeDbId === 'sanaryens') {
        settingsDesc.innerHTML = `<span class="font-bold text-emerald-700">🌿 Base active : Randonneurs Sanaryens</span> (${counts.sanaryens} randonnée${counts.sanaryens > 1 ? 's' : ''} enregistrée${counts.sanaryens > 1 ? 's' : ''}). Les ajouts de traces GPX et les modifications de parcours sont autorisés.`;
      } else {
        if (isAdmin) {
          settingsDesc.innerHTML = `<span class="font-bold text-amber-700">🔒 Base active : Base JLDApps</span> (${counts.jldapps} randonnées). <span class="text-emerald-700 font-semibold">Mode Administrateur actif : vous disposez de tous les droits d'écriture et de gestion.</span>`;
        } else {
          settingsDesc.innerHTML = `<span class="font-bold text-amber-700">🔒 Base active : Base JLDApps</span> (${counts.jldapps} randonnées). Cette base historique est protégée en lecture seule pour préserver les 139 circuits. Seul l'administrateur peut y apporter des modifications.`;
        }
      }
    }

    // 6. Actualiser le badge de stockage
    this.updateStorageBadge();
  }

  updateStorageBadge() {
    const badge = document.getElementById('storage-badge');
    if (!badge) return;

    if (StorageManager.currentMode === 'filesystem' && StorageManager.dirHandle) {
      badge.innerHTML = `
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="font-bold text-xs text-emerald-300">📁 Disque : ${StorageManager.dirHandle.name}</span>
      `;
      badge.className = "flex items-center gap-2 px-3 py-1.5 bg-emerald-950/80 border border-emerald-500/50 rounded-full text-emerald-300 text-xs cursor-pointer hover:brightness-125 transition shadow-sm";
      badge.title = "Dossier local connecté sur votre disque dur. Cliquez pour modifier ou gérer.";
    } else {
      badge.innerHTML = `
        <span class="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
        <span class="font-semibold text-xs text-slate-200">💾 Stockage Interne</span>
      `;
      badge.className = "flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-300 text-xs cursor-pointer transition shadow-sm";
      badge.title = "Stockage sécurisé dans le navigateur. Cliquez pour choisir un dossier sur votre disque dur.";
    }
  }

  /**
   * Helper to read file as text with encoding fallbacks (UTF-8, ISO-8859-1, Windows-1252)
   */
  async readFileAsText(file) {
    let text = '';
    try {
      text = await file.text();
    } catch (e) {
      text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsText(file, 'utf-8');
      });
    }

    // If text contains ISO-8859-1/Windows-1252 declaration or replacement characters, re-read with iso-8859-1
    if (text && (
      text.includes('encoding="ISO-8859-1"') || 
      text.includes('encoding="windows-1252"') || 
      text.includes('encoding="iso-8859-1"') ||
      text.includes('encoding="latin1"') ||
      text.includes('\uFFFD')
    )) {
      try {
        const isoText = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(err);
          reader.readAsText(file, 'iso-8859-1');
        });
        if (isoText && !isoText.includes('\uFFFD')) {
          return isoText;
        }
      } catch (e) {}
    }

    return text;
  }

  /**
   * Détection de doublon / randonnée aux caractéristiques similaires
   */
  findSimilarHike(newHike, candidateList = null) {
    if (!newHike) return null;
    const candidates = candidateList || this.allHikes || [];
    if (candidates.length === 0) return null;

    const norm = (s) => (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .trim();

    const nameNew = norm(newHike.name);

    for (const existing of candidates) {
      if (existing.id === newHike.id) continue;

      const nameExist = norm(existing.name);
      const isExactName = (nameNew && nameExist && nameNew === nameExist);

      let distStartKm = Infinity;
      if (newHike.startPoint && existing.startPoint) {
        distStartKm = GPXParser.haversineDistance(
          newHike.startPoint.lat, newHike.startPoint.lon,
          existing.startPoint.lat, existing.startPoint.lon
        );
      }

      const d1 = newHike.distanceKm || 0;
      const d2 = existing.distanceKm || 0;
      const diffDistKm = Math.abs(d1 - d2);
      const maxDist = Math.max(d1, d2, 1);
      const distPct = diffDistKm / maxDist;

      const ele1 = newHike.elevationGain || 0;
      const ele2 = existing.elevationGain || 0;
      const diffDPlus = Math.abs(ele1 - ele2);
      const maxEle = Math.max(ele1, ele2, 1);
      const dplusPct = diffDPlus / maxEle;

      // 1. Même lieu de départ (< 400 m) ET distance quasi identique (< 0.5 km ou < 6%) ET D+ quasi identique (< 40 m ou < 10%)
      const sameGeoAndMetrics = (distStartKm <= 0.4) && (diffDistKm <= 0.5 || distPct <= 0.06) && (diffDPlus <= 40 || dplusPct <= 0.10);

      // 2. Même nom exact ET (départ proche < 2 km OU distance proche < 1 km)
      const sameNameAndContext = isExactName && (distStartKm <= 2.0 || diffDistKm <= 1.0);

      // 3. Départ et Arrivée quasi identiques (< 250 m) avec distance identique (< 400 m)
      let distEndKm = Infinity;
      if (newHike.endPoint && existing.endPoint) {
        distEndKm = GPXParser.haversineDistance(
          newHike.endPoint.lat, newHike.endPoint.lon,
          existing.endPoint.lat, existing.endPoint.lon
        );
      }
      const sameTrackEnds = (distStartKm <= 0.25) && (distEndKm <= 0.25) && (diffDistKm <= 0.4);

      if (sameGeoAndMetrics || sameNameAndContext || sameTrackEnds) {
        let reason = "";
        if (sameGeoAndMetrics) {
          reason = `Même lieu de départ (à ${Math.round(distStartKm * 1000)} m), distance quasi identique (${d2} km vs ${d1} km) et dénivelé équivalent (+${ele2}m vs +${ele1}m).`;
        } else if (sameNameAndContext) {
          reason = `Nom identique (« ${existing.name} ») et caractéristiques géographiques très proches.`;
        } else {
          reason = `Mêmes points de départ/arrivée et longueur équivalente (${d2} km vs ${d1} km).`;
        }

        return {
          hike: existing,
          reason: reason,
          distStartMeters: Math.round(distStartKm * 1000),
          diffDistKm: Math.round(diffDistKm * 10) / 10,
          diffDPlus: diffDPlus
        };
      }
    }

    return null;
  }

  /**
   * Affiche la fenêtre modale de détection de doublon et attend le choix de l'utilisateur
   */
  askDuplicateDecision(newHike, existingHike, reason, fileName) {
    return new Promise((resolve) => {
      const modal = document.getElementById('duplicate-hike-modal');
      if (!modal) {
        const proceed = confirm(
          `⚠️ Une randonnée aux mêmes caractéristiques existe déjà dans la base :\n\n` +
          `• Randonnée existante : « ${existingHike.name} » (${existingHike.distanceKm} km, D+ ${existingHike.elevationGain}m)\n` +
          `• Nouvelle trace : « ${newHike.name} » (${newHike.distanceKm} km, D+ ${newHike.elevationGain}m)\n\n` +
          `${reason}\n\n` +
          `Souhaitez-vous quand même l'ajouter ?\n` +
          `• [OK] = Ajouter quand même\n• [Annuler] = Ignorer le doublon`
        );
        resolve(proceed ? 'add' : 'skip');
        return;
      }

      const reasonEl = document.getElementById('duplicate-modal-reason');
      if (reasonEl) reasonEl.textContent = reason;

      // Infos rando existante
      const existNameEl = document.getElementById('duplicate-exist-name');
      if (existNameEl) existNameEl.textContent = existingHike.name;

      const existDistEl = document.getElementById('duplicate-exist-dist');
      if (existDistEl) existDistEl.textContent = `${existingHike.distanceKm} km`;

      const existDplusEl = document.getElementById('duplicate-exist-dplus');
      if (existDplusEl) existDplusEl.textContent = `+${existingHike.elevationGain}m`;

      const existAuthorEl = document.getElementById('duplicate-exist-author');
      if (existAuthorEl) existAuthorEl.textContent = existingHike.ajoutee_par ? `Par ${existingHike.ajoutee_par}` : '';

      // Infos nouvelle trace
      const newNameEl = document.getElementById('duplicate-new-name');
      if (newNameEl) newNameEl.textContent = newHike.name;

      const newDistEl = document.getElementById('duplicate-new-dist');
      if (newDistEl) newDistEl.textContent = `${newHike.distanceKm} km`;

      const newDplusEl = document.getElementById('duplicate-new-dplus');
      if (newDplusEl) newDplusEl.textContent = `+${newHike.elevationGain}m`;

      const newFileEl = document.getElementById('duplicate-new-file');
      if (newFileEl) newFileEl.textContent = fileName || '';

      const btnSkip = document.getElementById('btn-duplicate-skip');
      const btnReplace = document.getElementById('btn-duplicate-replace');
      const btnAdd = document.getElementById('btn-duplicate-add');

      const cleanup = (choice) => {
        modal.classList.add('hidden');
        if (btnSkip) btnSkip.onclick = null;
        if (btnReplace) btnReplace.onclick = null;
        if (btnAdd) btnAdd.onclick = null;
        modal.onclick = null;
        resolve(choice);
      };

      if (btnSkip) btnSkip.onclick = () => cleanup('skip');
      if (btnReplace) btnReplace.onclick = () => cleanup('replace');
      if (btnAdd) btnAdd.onclick = () => cleanup('add');

      modal.onclick = (e) => {
        if (e.target === modal) cleanup('skip');
      };

      modal.classList.remove('hidden');
    });
  }

  /**
   * Handle Multi-file Upload (Instant Parse + Auto-Save + Auto-Radius Expansion)
   */
  async handleFilesUploaded(files) {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule pour les membres. Seul l'administrateur peut y charger des parcours.", "warning");
      return;
    }
    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_upload')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de charger des randonnées.", "error");
      return;
    }

    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    this.showToast(`Analyse de ${fileList.length} fichier(s)...`, "info");

    const origin = (window.MapManagerInstance && window.MapManagerInstance.searchOrigin) 
      ? window.MapManagerInstance.searchOrigin 
      : { lat: 43.1189, lon: 5.8033 };

    let maxDistFound = 0;
    const newHikes = [];
    const errors = [];
    let skippedCount = 0;

    for (const file of fileList) {
      try {
        const text = await this.readFileAsText(file);
        const hike = GPXParser.parse(text, file.name);
        const proposedName = await GPXParser.generateProposedName(hike);
        hike.name = proposedName;
        hike.proposedName = proposedName;
        const authorEl = document.getElementById('upload-author-name');
        const customAuthor = authorEl && authorEl.value ? authorEl.value.trim() : '';
        if (customAuthor) localStorage.setItem('rf_uploader_display_name', customAuthor);
        hike.ajoutee_par = customAuthor || localStorage.getItem('rf_uploader_display_name') || ((typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser()) ? AuthManager.getCurrentUser().username : 'admin');
        
        // Extraction de la date de derniere rando depuis le GPX si presente
        if (!hike.lastHikeDate && hike.points && hike.points.length > 0) {
          const ptWithTime = hike.points.find(p => p.time);
          if (ptWithTime && ptWithTime.time) {
            try {
              const d = new Date(ptWithTime.time);
              if (!isNaN(d.getTime())) {
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yy = String(d.getFullYear()).slice(-2);
                hike.lastHikeDate = `${dd}/${mm}/${yy}`;
              }
            } catch (e) {}
          }
        }

        // Détection de randonnée ayant les mêmes caractéristiques
        const duplicateMatch = this.findSimilarHike(hike);
        if (duplicateMatch) {
          const decision = await this.askDuplicateDecision(
            hike, 
            duplicateMatch.hike, 
            duplicateMatch.reason, 
            file.name
          );

          if (decision === 'skip') {
            skippedCount++;
            this.showToast(`Doublon ignoré : « ${file.name} »`, "info");
            continue;
          } else if (decision === 'replace') {
            hike.id = duplicateMatch.hike.id;
            if (!hike.name || hike.name === proposedName) {
              hike.name = duplicateMatch.hike.name;
            }
          } else if (decision === 'add') {
            if (hike.name === duplicateMatch.hike.name) {
              hike.name = `${hike.name} (Bis)`;
            }
          }
        }

        // Calcul IBP officiel via l'API ibpindex.com si possible
        try {
          const officialIbp = await GPXParser.fetchOfficialIBP(text, file.name);
          if (officialIbp !== null) {
            hike.ibp = officialIbp;
            const lvl = GPXParser.getIBPLevel(officialIbp);
            hike.ibpLevel = lvl.level;
            hike.difficulty = lvl.label;
            if (hike.notes && /\[IBP:\s*\d+\]/i.test(hike.notes)) {
              hike.notes = hike.notes.replace(/\[IBP:\s*\d+\]/i, `[IBP: ${officialIbp}]`);
            } else {
              hike.notes = `[IBP: ${officialIbp}] ${hike.notes || ''}`.trim();
            }
          }
        } catch (e) {
          console.warn("IBP API call error in upload:", e);
        }

        // Auto-save immediately to persistent storage
        await StorageManager.saveHike(hike, text);

        // Auto-push to Supabase Cloud in background if configured
        try {
          const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
          const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
          const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
          if (supaUrl && supaKey) {
            StorageManager.pushHikeToSupabase(hike, supaUrl, supaKey).catch(e => console.warn("Supabase auto-upload error:", e));
          }
        } catch (e) {}

        // Add to main collection
        const existingIdx = this.allHikes.findIndex(h => h.id === hike.id || (h.name && h.name === hike.name));
        if (existingIdx >= 0) {
          this.allHikes[existingIdx] = hike;
        } else {
          this.allHikes.unshift(hike);
        }

        if (hike.startPoint) {
          const dist = GPXParser.haversineDistance(origin.lat, origin.lon, hike.startPoint.lat, hike.startPoint.lon);
          if (dist > maxDistFound) maxDistFound = dist;
        }

        newHikes.push(hike);
      } catch (err) {
        console.error(`Erreur lecture ${file.name} :`, err);
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    if (newHikes.length === 0) {
      if (skippedCount > 0) {
        this.showToast(`Opération terminée : ${skippedCount} doublon(s) ignoré(s).`, "info");
      } else {
        const errorDetail = errors.length > 0 ? errors.join("\n") : "Format de fichier non reconnu.";
        this.showToast(`Échec du chargement : ${errorDetail}`, "error");
      }
      return;
    }

    // Auto expand radius if newly added hikes are outside current radius
    const currentRadius = window.MapManagerInstance ? window.MapManagerInstance.searchRadiusKm : 50;
    if (maxDistFound > currentRadius) {
      const stepIdx = this.getStepIndexForKm(maxDistFound);
      this.setRadiusStep(stepIdx, true);
    }

    // Automatically switch to Explorer view and select the first new hike!
    this.switchTab('explorer');
    this.applyFiltersAndRender();
    this.renderManagementList();

    if (newHikes.length > 0) {
      this.handleHikeSelect(newHikes[0]);
    }

    let toastMsg = (newHikes.length === 1) 
      ? `🎉 « ${newHikes[0].name} » ajoutée ! (${newHikes[0].distanceKm} km, +${newHikes[0].elevationGain}m, IBP : ${newHikes[0].ibp} - Niveau ${newHikes[0].ibpLevel})`
      : `🎉 ${newHikes.length} randonnée(s) ajoutée(s) avec calcul de l'Indice IBP Index !`;
    if (skippedCount > 0) {
      toastMsg += ` (${skippedCount} doublon(s) ignoré(s))`;
    }
    this.showToast(toastMsg, "success");
  }

  /**
   * Handle Direct GPX Text Paste
   */
  async handlePasteGPX() {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule pour les membres. Seul l'administrateur peut y coller des parcours.", "warning");
      return;
    }
    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_upload')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de charger des randonnées.", "error");
      return;
    }

    const textarea = document.getElementById('paste-gpx-text');
    const nameInput = document.getElementById('paste-gpx-name');
    if (!textarea) return;

    const rawText = textarea.value.trim();
    if (!rawText) {
      this.showToast("Veuillez d'abord coller le texte de votre trace GPX.", "error");
      return;
    }

    const customName = nameInput ? nameInput.value.trim() : '';

    try {
      this.showToast("Analyse de la trace collée...", "info");
      const hike = GPXParser.parse(rawText, customName ? customName + '.gpx' : 'Randonnee_Collee.gpx');
      if (customName) {
        hike.name = GPXParser.ensureForeignCountryPrefix(
          customName,
          null,
          hike.startPoint ? hike.startPoint.lat : null,
          hike.startPoint ? hike.startPoint.lon : null
        );
      } else {
        const proposedName = await GPXParser.generateProposedName(hike);
        hike.name = proposedName;
        hike.proposedName = proposedName;
      }

      const authorEl = document.getElementById('upload-author-name');
      const customAuthor = authorEl && authorEl.value ? authorEl.value.trim() : '';
      if (customAuthor) localStorage.setItem('rf_uploader_display_name', customAuthor);
      hike.ajoutee_par = customAuthor || localStorage.getItem('rf_uploader_display_name') || ((typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser()) ? AuthManager.getCurrentUser().username : 'admin');

      // Détection de randonnée ayant les mêmes caractéristiques
      const duplicateMatch = this.findSimilarHike(hike);
      if (duplicateMatch) {
        const decision = await this.askDuplicateDecision(
          hike, 
          duplicateMatch.hike, 
          duplicateMatch.reason, 
          'Trace GPX collée'
        );

        if (decision === 'skip') {
          this.showToast("Importation annulée : doublon ignoré.", "info");
          return;
        } else if (decision === 'replace') {
          hike.id = duplicateMatch.hike.id;
          if (!customName) {
            hike.name = duplicateMatch.hike.name;
          }
        } else if (decision === 'add') {
          if (hike.name === duplicateMatch.hike.name) {
            hike.name = `${hike.name} (Bis)`;
          }
        }
      }

      // Calcul IBP officiel via l'API ibpindex.com si possible
      try {
        const officialIbp = await GPXParser.fetchOfficialIBP(rawText, (customName || 'trace') + '.gpx');
        if (officialIbp !== null) {
          hike.ibp = officialIbp;
          const lvl = GPXParser.getIBPLevel(officialIbp);
          hike.ibpLevel = lvl.level;
          hike.difficulty = lvl.label;
          if (hike.notes && /\[IBP:\s*\d+\]/i.test(hike.notes)) {
            hike.notes = hike.notes.replace(/\[IBP:\s*\d+\]/i, `[IBP: ${officialIbp}]`);
          } else {
            hike.notes = `[IBP: ${officialIbp}] ${hike.notes || ''}`.trim();
          }
        }
      } catch (e) {
        console.warn("IBP API call error in paste:", e);
      }

      await StorageManager.saveHike(hike, rawText);

      // Auto-push to Supabase Cloud in background if configured
      try {
        const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
        const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
        const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
        if (supaUrl && supaKey) {
          StorageManager.pushHikeToSupabase(hike, supaUrl, supaKey).catch(e => console.warn("Supabase auto-upload error:", e));
        }
      } catch (e) {}

      const existingIdx = this.allHikes.findIndex(h => h.id === hike.id || (h.name && h.name === hike.name));
      if (existingIdx >= 0) {
        this.allHikes[existingIdx] = hike;
      } else {
        this.allHikes.unshift(hike);
      }

      // Clear input
      textarea.value = '';
      if (nameInput) nameInput.value = '';

      // Auto expand radius if needed
      const origin = (window.MapManagerInstance && window.MapManagerInstance.searchOrigin) 
        ? window.MapManagerInstance.searchOrigin 
        : { lat: 43.1189, lon: 5.8033 };

      if (hike.startPoint) {
        const dist = GPXParser.haversineDistance(origin.lat, origin.lon, hike.startPoint.lat, hike.startPoint.lon);
        const currentRadius = window.MapManagerInstance ? window.MapManagerInstance.searchRadiusKm : 50;
        if (dist > currentRadius) {
          const stepIdx = this.getStepIndexForKm(dist);
          this.setRadiusStep(stepIdx, true);
        }
      }

      this.switchTab('explorer');
      this.applyFiltersAndRender();
      this.renderManagementList();
      this.handleHikeSelect(hike);

      this.showToast(`🎉 Randonnée « ${hike.name} » ajoutée avec succès !`, "success");
    } catch (err) {
      console.error("Erreur paste GPX :", err);
      this.showToast(`Erreur d'analyse : ${err.message}`, "error");
    }
  }

  // =========================================================================
  // MAP AREA PRINT MODAL (2-CLICK RECTANGLE EXTRACTION)
  // =========================================================================
  openMapAreaModal(bounds) {
    this.selectedAreaBounds = bounds;
    const modal = document.getElementById('map-area-modal');
    if (!modal) return;

    const minLat = bounds[0][0];
    const minLon = bounds[0][1];
    const maxLat = bounds[1][0];
    const maxLon = bounds[1][1];

    const dKmWidth = GPXParser.haversineDistance(minLat, minLon, minLat, maxLon);
    const dKmHeight = GPXParser.haversineDistance(minLat, minLon, maxLat, minLon);

    const infoEl = document.getElementById('modal-map-area-info');
    if (infoEl) {
      infoEl.textContent = `Zone sélectionnée : ~${dKmWidth.toFixed(1)} km × ${dKmHeight.toFixed(1)} km (2 clics)`;
    }

    // Déterminer la (ou les) trace(s) active(s) (jusqu'à 3 traces GPX libres ou randonnée club)
    const standaloneTracks = (window.MapManagerInstance && window.MapManagerInstance.standaloneTracks) || [];
    const activeHike = this.areaPrintHike || this.selectedHike || 
                       (window.MapManagerInstance && window.MapManagerInstance.selectedHike) || 
                       (window.MapManagerInstance && window.MapManagerInstance.standaloneHike) || null;

    // Remplir le sélecteur de tracé GPX (accessible et visible en permanence)
    const gpxSelect = document.getElementById('map-area-gpx-select');
    const titleEl = document.getElementById('map-area-title');

    if (gpxSelect) {
      gpxSelect.innerHTML = '<option value="">🚫 Aucun tracé (fond de carte vierge)</option>';

      // Si plusieurs traces GPX libres sont affichées (ex: 2 ou 3 traces simultanées)
      if (standaloneTracks.length > 1) {
        const optAll = document.createElement('option');
        optAll.value = '__all_standalone__';
        optAll.textContent = `📍 Toutes les traces affichées (${standaloneTracks.length} traces GPX simultanées)`;
        optAll.selected = true;
        gpxSelect.appendChild(optAll);

        standaloneTracks.forEach((trk, idx) => {
          const optTrk = document.createElement('option');
          optTrk.value = `__standalone_${trk.id || idx}__`;
          optTrk.textContent = `  ↳ Trace ${idx + 1} : ${trk.name} (${trk.distance || '?'} km)`;
          gpxSelect.appendChild(optTrk);
        });
      } else if (activeHike) {
        // Une seule trace active
        const optActive = document.createElement('option');
        optActive.value = String(activeHike.id);
        optActive.textContent = `📍 ${activeHike.name} (${activeHike.distance || activeHike.distanceKm || '?'} km)`;
        optActive.selected = true;
        gpxSelect.appendChild(optActive);
      }

      // En mode Randonner uniquement (protégé), lister les autres randonnées du club
      const isRandoMode = window.location.hash.startsWith('#randonner');
      if (isRandoMode) {
        const hikesList = (this.allHikes && this.allHikes.length > 0) ? this.allHikes : (this.hikes || []);
        const sortedHikes = [...hikesList].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        sortedHikes.forEach(h => {
          if (activeHike && String(h.id) === String(activeHike.id)) return;
          const opt = document.createElement('option');
          opt.value = h.id;
          opt.textContent = `📍 ${h.name} (${h.distanceKm ? h.distanceKm + ' km' : 'GPX'})`;
          gpxSelect.appendChild(opt);
        });
      }

      // Adapter automatiquement le titre en cas de changement de sélection
      gpxSelect.onchange = () => {
        const selectedId = gpxSelect.value;
        if (titleEl) {
          if (selectedId === '__all_standalone__') {
            titleEl.value = standaloneTracks.map(t => t.name).join(' • ') + ' - Extrait de carte';
          } else if (selectedId && selectedId.startsWith('__standalone_')) {
            const trkId = selectedId.replace('__standalone_', '').replace(/__$/, '');
            const chosenTrk = standaloneTracks.find((t, i) => String(t.id) === trkId || String(i) === trkId);
            titleEl.value = chosenTrk ? `${chosenTrk.name} - Extrait de carte` : `Extrait Cartographique`;
          } else if (activeHike && String(activeHike.id) === String(selectedId)) {
            titleEl.value = `${activeHike.name} - Extrait de carte`;
          } else {
            const hikesList = (this.allHikes && this.allHikes.length > 0) ? this.allHikes : (this.hikes || []);
            const chosen = hikesList.find(h => String(h.id) === String(selectedId));
            if (chosen) {
              titleEl.value = `${chosen.name} - Extrait de carte`;
            } else {
              titleEl.value = `Extrait Cartographique (${dKmWidth.toFixed(1)} × ${dKmHeight.toFixed(1)} km)`;
            }
          }
        }
      };
    }

    // Default title
    if (titleEl) {
      if (standaloneTracks.length > 1) {
        titleEl.value = standaloneTracks.map(t => t.name).join(' • ') + ' - Extrait de carte';
      } else if (activeHike) {
        titleEl.value = `${activeHike.name} - Extrait de carte`;
      } else {
        titleEl.value = `Extrait Cartographique (${dKmWidth.toFixed(1)} × ${dKmHeight.toFixed(1)} km)`;
      }
    }

    // Default layer matching currently active map layer
    const layerSelect = document.getElementById('map-area-layer');
    if (layerSelect && window.MapManagerInstance) {
      layerSelect.value = window.MapManagerInstance.getCurrentBaseLayerKey();
    }

    // Gestion de l'échelle vraie physique (1/XXXXXX)
    const formatEl = document.getElementById('map-area-format');
    const orientEl = document.getElementById('map-area-orientation');
    const scaleModeEl = document.getElementById('map-area-scale-mode');
    const scaleDenomEl = document.getElementById('map-area-scale-denom');
    const scalePreviewEl = document.getElementById('map-area-scale-preview');
    const scaleInputBox = document.getElementById('box-map-area-scale-input');
    const scalePresetsBox = document.getElementById('map-area-scale-presets');

    const updateScalePreview = () => {
      const fmt = (formatEl ? formatEl.value : 'a4').toLowerCase();
      const ori = (orientEl ? orientEl.value : 'landscape').toLowerCase();
      const mode = scaleModeEl ? scaleModeEl.value : 'fit';
      const denom = parseInt(scaleDenomEl ? scaleDenomEl.value : '25000', 10) || 25000;

      const pageDims = {
        a4: { w: 297, h: 210 },
        a3: { w: 420, h: 297 }
      };
      const dims = pageDims[fmt] || pageDims.a4;
      const sheetW = ori === 'landscape' ? Math.max(dims.w, dims.h) : Math.min(dims.w, dims.h);
      const sheetH = ori === 'landscape' ? Math.min(dims.w, dims.h) : Math.max(dims.w, dims.h);

      const marginX = 12;
      const marginY = 12;
      const topBannerH = 14;
      const botLegendH = 12;
      const mapBoxW_mm = sheetW - (2 * marginX);
      const mapBoxH_mm = sheetH - marginY - topBannerH - botLegendH - marginY;

      if (scaleInputBox) scaleInputBox.style.display = (mode === 'custom') ? 'block' : 'none';
      if (scalePresetsBox) scalePresetsBox.style.display = (mode === 'custom') ? 'flex' : 'none';

      if (scalePreviewEl) {
        if (mode === 'fit') {
          scalePreviewEl.innerHTML = `Mode <strong>Cadrage exact</strong> : la zone sélectionnée (~${dKmWidth.toFixed(1)} × ${dKmHeight.toFixed(1)} km) occupera 100% de la feuille ${fmt.toUpperCase()}.`;
        } else {
          const mapBoxW_m = (mapBoxW_mm / 1000) * denom;
          const mapBoxH_m = (mapBoxH_mm / 1000) * denom;
          const mapBoxW_km = mapBoxW_m / 1000;
          const mapBoxH_km = mapBoxH_m / 1000;
          const denomFmt = denom.toLocaleString('fr-FR');
          scalePreviewEl.innerHTML = `Échelle <strong>1 : ${denomFmt}</strong> sur ${fmt.toUpperCase()} (${mapBoxW_mm} × ${Math.round(mapBoxH_mm)} mm utiles) : cadre de <strong>~${mapBoxW_km.toFixed(2)} km × ${mapBoxH_km.toFixed(2)} km</strong> centré sur votre sélection (1 cm papier = ${denom < 100000 ? Math.round(denom / 100) + ' m' : (denom / 100000).toFixed(1) + ' km'} terrain).`;
        }
      }
    };

    if (formatEl) formatEl.onchange = updateScalePreview;
    if (orientEl) orientEl.onchange = updateScalePreview;
    if (scaleModeEl) scaleModeEl.onchange = updateScalePreview;
    if (scaleDenomEl) scaleDenomEl.oninput = updateScalePreview;

    const presetBtns = document.querySelectorAll('.btn-scale-preset');
    presetBtns.forEach(btn => {
      btn.onclick = () => {
        const sc = btn.dataset.scale;
        if (sc && scaleDenomEl) {
          scaleDenomEl.value = sc;
          presetBtns.forEach(b => {
            b.classList.remove('bg-emerald-600', 'text-white');
            b.classList.add('bg-white', 'text-slate-700', 'border', 'border-slate-300');
          });
          btn.classList.remove('bg-white', 'text-slate-700', 'border', 'border-slate-300');
          btn.classList.add('bg-emerald-600', 'text-white');
          updateScalePreview();
        }
      };
    });

    updateScalePreview();

    modal.classList.remove('hidden');
  }

  closeMapAreaModal() {
    const modal = document.getElementById('map-area-modal');
    if (modal) modal.classList.add('hidden');
    if (window.MapManagerInstance) {
      window.MapManagerInstance.clearAreaSelectionVisuals();
    }
  }

  async executeMapAreaDownload() {
    if (!this.selectedAreaBounds) return;

    const formatEl = document.getElementById('map-area-format');
    const format = formatEl ? formatEl.value : 'a4';
    const orientationEl = document.getElementById('map-area-orientation');
    const orientation = orientationEl ? orientationEl.value : 'landscape';
    const layerEl = document.getElementById('map-area-layer');
    const mapLayer = layerEl ? layerEl.value : 'igntop25';
    const titleEl = document.getElementById('map-area-title');
    const title = titleEl && titleEl.value.trim() ? titleEl.value.trim() : 'EXTRAIT DE CARTE TOPOGRAPHIQUE';
    const showCoordsEl = document.getElementById('map-area-opt-coords');
    const showCoords = showCoordsEl ? showCoordsEl.checked : true;
    const trackColorEl = document.getElementById('map-area-track-color');
    const trackColor = trackColorEl ? trackColorEl.value : '#1d4ed8';

    // Récupérer le tracé ou multi-tracés choisis dans le sélecteur GPX
    const gpxSelect = document.getElementById('map-area-gpx-select');
    const selectedHikeId = gpxSelect ? gpxSelect.value : '';
    let hikeForTrack = null;
    let tracksForExport = null;

    const standaloneTracks = (window.MapManagerInstance && window.MapManagerInstance.standaloneTracks) || [];

    if (selectedHikeId === '__all_standalone__') {
      tracksForExport = standaloneTracks;
    } else if (selectedHikeId && selectedHikeId.startsWith('__standalone_')) {
      const trkId = selectedHikeId.replace('__standalone_', '').replace(/__$/, '');
      hikeForTrack = standaloneTracks.find((t, i) => String(t.id) === trkId || String(i) === trkId) || null;
    } else if (selectedHikeId) {
      if (this.areaPrintHike && String(this.areaPrintHike.id) === String(selectedHikeId)) {
        hikeForTrack = this.areaPrintHike;
      } else if (window.MapManagerInstance && window.MapManagerInstance.standaloneHike && String(window.MapManagerInstance.standaloneHike.id) === String(selectedHikeId)) {
        hikeForTrack = window.MapManagerInstance.standaloneHike;
      } else {
        const hikesList = (this.allHikes && this.allHikes.length > 0) ? this.allHikes : (this.hikes || []);
        hikeForTrack = hikesList.find(h => String(h.id) === String(selectedHikeId)) || null;
      }
    } else if (standaloneTracks.length > 1 && (!selectedHikeId || selectedHikeId === '')) {
      // Choix explicite : aucun tracé
      tracksForExport = null;
      hikeForTrack = null;
    }

    this.closeMapAreaModal();

    this.showToast("Génération de l'extrait de carte en haute définition...", "info");
    try {
      if (hikeForTrack && typeof StorageManager !== 'undefined') {
        try { await StorageManager.ensureHikeTrackLoaded(hikeForTrack); } catch (e) {}
      }
      const showUtm = document.getElementById('map-area-opt-utm') ? document.getElementById('map-area-opt-utm').checked : true;
      const scaleModeEl = document.getElementById('map-area-scale-mode');
      const scaleMode = scaleModeEl ? scaleModeEl.value : 'fit';
      const scaleDenomEl = document.getElementById('map-area-scale-denom');
      const scaleDenom = scaleDenomEl ? (parseInt(scaleDenomEl.value, 10) || 25000) : 25000;

      await PDFExporter.exportMapAreaPDF(this.selectedAreaBounds, {
        title: title,
        format: format,
        orientation: orientation,
        mapLayer: mapLayer,
        showCoords: showCoords,
        showUtmGrid: showUtm,
        scaleMode: scaleMode,
        scaleDenom: scaleDenom,
        trackColor: trackColor,
        hike: hikeForTrack,
        tracks: tracksForExport,
        bearings: (window.MapManagerInstance && window.MapManagerInstance.bearingMeasurements) ? window.MapManagerInstance.bearingMeasurements : []
      });
      let trackNotice = ' (fond vierge)';
      if (tracksForExport && tracksForExport.length > 0) {
        trackNotice = ` avec ${tracksForExport.length} tracés GPX`;
      } else if (hikeForTrack) {
        trackNotice = ` avec tracé « ${hikeForTrack.name} »`;
      }
      this.showToast(`Extrait de carte (${format.toUpperCase()} ${orientation === 'landscape' ? 'Paysage' : 'Portrait'})${trackNotice} téléchargé !`, "success");
    } catch (err) {
      console.error("Erreur export carte zone :", err);
      this.showToast("Erreur lors de la génération de la carte PDF", "error");
    }
  }

  

    deselectHike() {
    this.selectedHike = null;
    this.isHikePinned = false;
    this.hoveredHike = null;
    this.isMouseOverPreview = false;
    this.cancelHoverClear();
    if (window.MapManagerInstance) {
      window.MapManagerInstance.hoveredHike = null;
      window.MapManagerInstance.deselectHike();
    }
    this.hideHikePreviewPanel();
    this.updateTableSelection(null);
  }

  switchTab(tabName) {
    if (tabName === 'upload' && typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_upload')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de charger des randonnées.", "error");
      return;
    }

    this.currentTab = tabName;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.classList.remove('bg-emerald-700', 'text-white', 'shadow-sm');
      btn.classList.add('text-slate-300', 'hover:bg-slate-800');
    });

    const activeContent = document.getElementById(`tab-content-${tabName}`);
    if (activeContent) activeContent.classList.remove('hidden');

    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('text-slate-300', 'hover:bg-slate-800');
      activeBtn.classList.add('bg-emerald-700', 'text-white', 'shadow-sm');
    }

    if (tabName === 'explorer') {
      setTimeout(() => {
        if (window.MapManagerInstance && window.MapManagerInstance.map) {
          window.MapManagerInstance.map.invalidateSize();
        }
      }, 100);
      this.applyFiltersAndRender();
    } else if (tabName === 'upload') {
      const authorInput = document.getElementById('upload-author-name');
      if (authorInput) {
        const loggedUser = (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser()) ? AuthManager.getCurrentUser().username : '';
        const savedAuthor = localStorage.getItem('rf_uploader_display_name') || '';
        if (!authorInput.value || authorInput.value === 'admin') {
          authorInput.value = savedAuthor || loggedUser || 'admin';
        }
        if (!authorInput._boundSave) {
          authorInput._boundSave = true;
          authorInput.addEventListener('change', () => {
            if (authorInput.value.trim()) {
              localStorage.setItem('rf_uploader_display_name', authorInput.value.trim());
            }
          });
        }
      }
    } else if (tabName === 'manage') {
      this.renderManagementList();
    }
    this.updateDatabaseStatusUI();
  }

  setViewMode(mode) {
    this.currentViewMode = mode;
    const mapCol = document.getElementById('map-column');
    const tableCol = document.getElementById('table-column');

    document.querySelectorAll('[data-view-mode]').forEach(btn => {
      btn.classList.remove('bg-emerald-600', 'text-white');
      btn.classList.add('bg-slate-100', 'text-slate-700');
    });

    const activeBtn = document.querySelector(`[data-view-mode="${mode}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('bg-slate-100', 'text-slate-700');
      activeBtn.classList.add('bg-emerald-600', 'text-white');
    }

    if (mode === 'map') {
      if (mapCol) {
        mapCol.classList.remove('hidden', 'lg:w-1/2');
        mapCol.classList.add('w-full', 'h-full');
      }
      if (tableCol) tableCol.classList.add('hidden');
    } else if (mode === 'table') {
      if (mapCol) mapCol.classList.add('hidden');
      if (tableCol) {
        tableCol.classList.remove('hidden', 'lg:w-1/2');
        tableCol.classList.add('w-full', 'h-full');
      }
    } else {
      if (mapCol) {
        mapCol.classList.remove('hidden', 'w-full');
        mapCol.classList.add('lg:w-1/2');
      }
      if (tableCol) {
        tableCol.classList.remove('hidden', 'w-full');
        tableCol.classList.add('lg:w-1/2');
      }
    }

    setTimeout(() => {
      if (window.MapManagerInstance && window.MapManagerInstance.map) {
        window.MapManagerInstance.map.invalidateSize();
      }
    }, 150);
  }

  applyFiltersAndRender(autoZoomSearchResults = false) {
    const origin = (window.MapManagerInstance && window.MapManagerInstance.searchOrigin) 
      ? window.MapManagerInstance.searchOrigin 
      : { lat: 43.1189, lon: 5.8033 };

    const radius = (window.MapManagerInstance && window.MapManagerInstance.searchRadiusKm) 
      ? window.MapManagerInstance.searchRadiusKm 
      : 100;

    const isWorldWide = radius >= 20000;

    this.filteredHikes = (this.allHikes || []).map(hike => {
      const distFromOrigin = hike.startPoint
        ? GPXParser.haversineDistance(origin.lat, origin.lon, hike.startPoint.lat, hike.startPoint.lon)
        : 9999;

      return {
        ...hike,
        distFromOrigin: Math.round(distFromOrigin * 10) / 10
      };
    }).filter(hike => {
      const matchesRadius = isWorldWide || (hike.distFromOrigin <= radius);
      const matchesQuery = !this.searchQuery || 
        hike.name.toLowerCase().includes(this.searchQuery) || 
        (hike.notes && hike.notes.toLowerCase().includes(this.searchQuery));

      // Si l'utilisateur saisit un mot-clé (ex: "Canada", "Chine", "Garibaldi"), recherche mondiale prioritaire
      if (this.searchQuery) {
        return matchesQuery;
      }

      return matchesRadius;
    });

    this.sortHikes();
    this.renderHikesTable();

    if (window.MapManagerInstance) {
      window.MapManagerInstance.renderHikeMarkers(this.filteredHikes);

      // Si recherche active par mot-clé et demandé explicitement, centrer la carte sur les résultats
      if (autoZoomSearchResults && this.searchQuery && this.filteredHikes.length > 0) {
        const validHikes = this.filteredHikes.filter(h => h.startPoint);
        if (validHikes.length > 0) {
          try {
            const bounds = L.latLngBounds(validHikes.map(h => [h.startPoint.lat, h.startPoint.lon]));
            window.MapManagerInstance.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
          } catch (e) {}
        }
      }
    }

    const activeDb = StorageManager.getActiveDatabase();
    const countEl = document.getElementById('results-count');
    if (countEl) {
      const dbTag = activeDb.isSanctuary ? ` [🔒 ${activeDb.name}]` : ` [🌿 ${activeDb.name}]`;
      if (this.searchQuery) {
        countEl.textContent = `${this.filteredHikes.length} résultat${this.filteredHikes.length > 1 ? 's' : ''} pour "${this.searchQuery}"${dbTag}`;
      } else if (isWorldWide) {
        countEl.textContent = `${this.filteredHikes.length} randonnée${this.filteredHikes.length > 1 ? 's' : ''} (Monde entier 🌍)${dbTag}`;
      } else if (radius >= 1000) {
        countEl.textContent = `${this.filteredHikes.length} randonnée${this.filteredHikes.length > 1 ? 's' : ''} à moins de ${radius.toLocaleString('fr-FR')} km${dbTag}`;
      } else {
        countEl.textContent = `${this.filteredHikes.length} randonnée${this.filteredHikes.length > 1 ? 's' : ''} à moins de ${radius} km${dbTag}`;
      }
    }

    const tableBadge = document.getElementById('table-filtered-badge');
    if (tableBadge) {
      if (this.searchQuery) {
        tableBadge.textContent = `${this.filteredHikes.length} résultat(s)`;
      } else {
        tableBadge.textContent = `${this.filteredHikes.length} rando(s)`;
      }
    }

    const manageCountBadge = document.getElementById('manage-total-count');
    if (manageCountBadge) {
      manageCountBadge.textContent = `${this.allHikes.length} randonnée(s)`;
    }
  }

  sortHikes() {
    this.filteredHikes.sort((a, b) => {
      let valA = a[this.sortColumn];
      let valB = b[this.sortColumn];

      if (this.sortColumn === 'ajoutee_par') {
        valA = (a.ajoutee_par || 'admin').toString().toLowerCase();
        valB = (b.ajoutee_par || 'admin').toString().toLowerCase();
      }

      if (this.sortColumn === 'ibp') {
        valA = (typeof a.ibp === 'number') ? a.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(a) : 0);
        valB = (typeof b.ibp === 'number') ? b.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(b) : 0);
      }

      if (this.sortColumn === 'lastHikeDate') {
        const parseDate = (d) => {
          if (!d || typeof d !== 'string') return 0;
          const parts = d.trim().split(/[\/\-\.]/);
          if (parts.length === 3) {
            let day = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10);
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            const t = new Date(year, month - 1, day).getTime();
            return isNaN(t) ? 0 : t;
          }
          return 0;
        };
        valA = parseDate(a.lastHikeDate);
        valB = parseDate(b.lastHikeDate);
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  setSort(column) {
    if (this.sortColumn === column) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = column;
      this.sortAsc = true;
    }
    this.sortHikes();
    this.renderHikesTable();
  }

  renderHikesTable() {
    const tableBody = document.getElementById('hikes-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (this.filteredHikes.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="p-8 text-center text-slate-400">
            <div class="text-3xl mb-2">🔍</div>
            <div class="font-medium text-slate-700">Aucune randonnée dans ce rayon (${window.MapManagerInstance ? window.MapManagerInstance.searchRadiusKm : 50} km)</div>
            <div class="text-xs text-slate-500 mt-1">👉 <strong>Augmentez le curseur de rayon</strong> (ex: 200 km) ou tapez une autre ville de départ pour les voir.</div>
          </td>
        </tr>
      `;
      return;
    }

    this.filteredHikes.forEach(hike => {
      const ibpVal = (typeof hike.ibp === 'number') ? hike.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(hike) : 50);
      const ibpInfo = (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(ibpVal) : { level: 3, label: 'Peu difficile', color: '#ea580c' };

      const tr = document.createElement('tr');
      tr.dataset.hikeId = hike.id;
      tr.className = 'border-b border-slate-100 hover:bg-emerald-50/70 transition-colors cursor-pointer text-sm';
      if (this.selectedHike && this.selectedHike.id === hike.id) {
        tr.classList.add('bg-emerald-50', 'border-emerald-300', 'font-semibold');
      }

      tr.innerHTML = `
        <td class="p-3 font-semibold text-slate-900 whitespace-nowrap">
          <div class="flex items-center gap-1.5 text-blue-600">
            <span class="text-xs">📍</span>
            <span>${hike.distFromOrigin} km</span>
          </div>
        </td>
        <td class="p-3">
          <div class="font-bold text-slate-800 hover:text-emerald-700 cursor-pointer group flex items-center gap-1.5 transition-colors" title="Cliquer pour afficher cette randonnée sur la carte">
            <span class="hover:underline">${hike.name}</span>
            <span class="text-xs text-emerald-600 opacity-60 group-hover:opacity-100 group-hover:scale-125 transition-all">🗺️</span>
          </div>
          ${hike.notes ? `<div class="text-xs text-slate-500 line-clamp-1 max-w-xs mt-0.5">${hike.notes}</div>` : ''}
        </td>
        <td class="p-3 text-slate-700 whitespace-nowrap">
          <span class="font-semibold">${hike.distanceKm} km</span>
        </td>
        <td class="p-3 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
            +${hike.elevationGain} m
          </span>
        </td>
        <td class="p-3 whitespace-nowrap">
          <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold shadow-2xs" style="background-color: ${ibpInfo.color}15; color: ${ibpInfo.color}; border: 1px solid ${ibpInfo.color}40;" title="Indice d'effort IBP : ${ibpVal} • Niveau ${ibpInfo.level} (${ibpInfo.label})">
            <span class="w-4 h-4 rounded text-[10px] font-black text-white flex items-center justify-center" style="background-color: ${ibpInfo.color}">${ibpInfo.level}</span>
            <span>IBP ${ibpVal}</span>
          </div>
        </td>
        <td class="p-3 whitespace-nowrap text-xs font-semibold text-slate-700">
          ${hike.lastHikeDate ? `<span class="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md border border-slate-200">${hike.lastHikeDate}</span>` : '<span class="text-slate-300 italic">-</span>'}
        </td>
        <td class="p-3 whitespace-nowrap text-xs">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200 font-bold" title="Trace GPX chargée par ${this.escapeHtml(hike.ajoutee_par || 'admin')}">
            <span>👤</span>
            <span>${this.escapeHtml(hike.ajoutee_par || 'admin')}</span>
          </span>
        </td>
        <td class="p-3 text-slate-600 whitespace-nowrap text-xs">
          ${hike.minElevation}m - ${hike.maxElevation}m
        </td>
        <td class="p-3 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1">
            ${(StorageManager.isWriteProtected() || (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_edit'))) ? '' : `
              <button class="btn-table-edit p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Modifier le nom et les notes">
                ✏️
              </button>
              <button class="btn-table-delete p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Supprimer cette randonnée">
                🗑️
              </button>
            `}
            <button class="btn-download-hike px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm transition flex items-center gap-1 ml-1" title="Télécharger GPX / Fiche PDF">
              <span>📥</span>
              <span class="hidden sm:inline">Télécharger</span>
            </button>
          </div>
        </td>
      `;

      tr.addEventListener('mouseenter', () => {
        if (!this.selectedHike || this.selectedHike.id !== hike.id) {
          this.handleHikeHover(hike);
        }
      });

      tr.addEventListener('mouseleave', () => {
        this.handleHikeHoverEnd();
      });

      tr.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.showHikeOnMap(hike);
        }
      });

      // Edit button click
      const editBtn = tr.querySelector('.btn-table-edit');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEditModal(hike);
        });
      }

      // Delete button click
      const deleteBtn = tr.querySelector('.btn-table-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openDeleteModal(hike);
        });
      }

      // Download button click
      const dlBtn = tr.querySelector('.btn-download-hike');
      if (dlBtn) {
        dlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openDownloadModal(hike);
        });
      }

      tableBody.appendChild(tr);
    });
  }

  showHikeOnMap(hike) {
    if (!hike) return;

    // 1. Si on est en mode tableau seul, basculer vers le mode split pour afficher la carte
    const wasTableMode = (this.currentViewMode === 'table');
    if (wasTableMode) {
      this.setViewMode('split');
    }

    // 2. Si on est sur un autre onglet (ex: Gérer les randos), revenir sur l'explorateur
    if (this.currentTab !== 'explorer') {
      this.switchTab('explorer');
    }

    // 3. Adapter le curseur de rayon si la randonnée est au-delà du rayon actuel
    const origin = (window.MapManagerInstance && window.MapManagerInstance.searchOrigin) 
      ? window.MapManagerInstance.searchOrigin 
      : { lat: 43.1189, lon: 5.8033 };

    if (hike.startPoint) {
      const dist = GPXParser.haversineDistance(origin.lat, origin.lon, hike.startPoint.lat, hike.startPoint.lon);
      const currentRadius = window.MapManagerInstance ? window.MapManagerInstance.searchRadiusKm : 50;
      if (dist > currentRadius) {
        const stepIdx = this.getStepIndexForKm(dist);
        this.setRadiusStep(stepIdx, false);
      }
    }

    // 4. Délai si le conteneur de carte était masqué pour s'assurer que Leaflet a ses dimensions réelles
    const delay = wasTableMode ? 100 : 0;
    setTimeout(() => {
      if (window.MapManagerInstance && window.MapManagerInstance.map) {
        window.MapManagerInstance.map.invalidateSize();
      }
      this.handleHikeSelect(hike);

      // Sur mobile, faire défiler vers la carte
      const mapCol = document.getElementById('map-column');
      if (mapCol && window.innerWidth < 1024) {
        mapCol.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, delay);
  }

  /**
   * Render Management Tab View
   */
  renderManagementList() {
    const listContainer = document.getElementById('manage-hikes-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const query = this.manageSearchQuery || '';
    const filtered = (this.allHikes || []).filter(h => 
      !query || h.name.toLowerCase().includes(query) || (h.notes && h.notes.toLowerCase().includes(query))
    );

    const countBadge = document.getElementById('manage-total-count');
    if (countBadge) {
      if (query) {
        countBadge.textContent = `${filtered.length} sur ${this.allHikes.length} randonnée(s)`;
      } else {
        countBadge.textContent = `${this.allHikes.length} randonnée(s)`;
      }
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-400">
          <div class="text-3xl mb-2">📁</div>
          <div class="font-bold text-slate-700">Aucune randonnée trouvée</div>
          <div class="text-xs text-slate-500 mt-1">Votre bibliothèque est vide ou aucun élément ne correspond à votre recherche.</div>
        </div>
      `;
      return;
    }

    const isSanctuary = StorageManager.isCurrentDatabaseSanctuary();
    const isWriteProtected = StorageManager.isWriteProtected();
    const isAdmin = typeof AuthManager !== 'undefined' && AuthManager.isAdmin();
    const canEdit = !isWriteProtected && (typeof AuthManager === 'undefined' || AuthManager.hasPermission('can_edit'));

    filtered.forEach((hike, idx) => {
      const card = document.createElement('div');
      card.className = 'bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 shadow-sm transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3';

      card.innerHTML = `
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-400">#${idx + 1}</span>
            <h4 class="text-sm sm:text-base font-bold text-slate-900 truncate">${hike.name}</h4>
          </div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
            <span class="font-medium text-emerald-700">📏 ${hike.distanceKm} km</span>
            <span class="font-medium text-emerald-700">↗️ +${hike.elevationGain}m</span>
            <span class="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded text-[11px]" style="background-color:${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).color : '#ea580c')}15; color:${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).color : '#ea580c')}; border: 1px solid ${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).color : '#ea580c')}40;">
              <span class="w-3.5 h-3.5 rounded text-[9px] font-black text-white flex items-center justify-center" style="background-color:${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).color : '#ea580c')}">${(typeof GPXParser !== 'undefined' ? GPXParser.getIBPLevel(hike.ibp || GPXParser.calculateIBP(hike)).level : 3)}</span>
              <span>IBP ${(typeof hike.ibp === 'number') ? hike.ibp : (typeof GPXParser !== 'undefined' ? GPXParser.calculateIBP(hike) : 50)}</span>
            </span>
            <span>⛰️ ${hike.minElevation}m - ${hike.maxElevation}m</span>
            <span>⏱️ ${hike.estimatedDuration || '3h30'}</span>
            ${hike.ajoutee_par ? `<span class="text-slate-500 font-medium">👤 Par : <strong class="text-slate-700">${hike.ajoutee_par}</strong></span>` : ''}
          </div>
          ${hike.notes ? `<div class="text-xs text-slate-600 line-clamp-2 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">« ${hike.notes} »</div>` : ''}
        </div>

        <div class="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <button class="btn-manage-view px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1" title="Voir sur la carte">
            <span>🗺️</span> <span>Voir</span>
          </button>
          ${(isSanctuary && isWriteProtected) ? `
            <span class="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1 select-none" title="Base sanctuarisée en lecture seule pour les membres">
              <span>🔒</span> <span>Sanctuarisée</span>
            </span>
          ` : (canEdit ? `
            ${(isSanctuary && isAdmin) ? `
              <span class="hidden sm:inline-flex px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold items-center gap-1" title="Mode Administrateur actif sur base JLDApps">
                <span>👑</span> <span>Admin</span>
              </span>
            ` : ''}
            <button class="btn-manage-edit px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1" title="Modifier nom et notes">
              <span>✏️</span> <span>Modifier</span>
            </button>
            <button class="btn-manage-delete px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1" title="Supprimer">
              <span>🗑️</span> <span>Supprimer</span>
            </button>
          ` : '')}
        </div>
      `;

      card.querySelector('.btn-manage-view').onclick = () => {
        this.showHikeOnMap(hike);
      };

      const editBtn = card.querySelector('.btn-manage-edit');
      if (editBtn) {
        editBtn.onclick = () => this.openEditModal(hike);
      }

      const delBtn = card.querySelector('.btn-manage-delete');
      if (delBtn) {
        delBtn.onclick = () => this.openDeleteModal(hike);
      }

      listContainer.appendChild(card);
    });
  }

  // =========================================================================
  // EDIT MODAL (✏️ Crayon)
  // =========================================================================
  openEditModal(hike) {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule. Seul l'administrateur peut modifier ces parcours.", "warning");
      return;
    }
    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_edit')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de modifier des randonnées.", "error");
      return;
    }
    this.hikeToEdit = hike;
    const modal = document.getElementById('edit-hike-modal');
    if (!modal) return;

    document.getElementById('edit-hike-name').value = hike.name || '';
    document.getElementById('edit-hike-notes').value = hike.notes || '';
    const lastDateInput = document.getElementById('edit-hike-last-date');
    if (lastDateInput) {
      lastDateInput.value = hike.lastHikeDate || '';
    }
    const authorEditInput = document.getElementById('edit-hike-author');
    if (authorEditInput) {
      authorEditInput.value = hike.ajoutee_par || ((typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser()) ? AuthManager.getCurrentUser().username : 'admin');
    }
    
    const ibpInput = document.getElementById('edit-hike-ibp');
    const ibpVal = (typeof hike.ibp === 'number') ? hike.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(hike) : 50);
    if (ibpInput) {
      ibpInput.value = ibpVal;
      this.updateEditIbpBadge(ibpVal);
      ibpInput.oninput = () => this.updateEditIbpBadge(ibpInput.value);
    }
    const recalcBtn = document.getElementById('btn-recalc-ibp');
    if (recalcBtn) {
      recalcBtn.onclick = () => {
        if (typeof GPXParser !== 'undefined') {
          const recalculated = GPXParser.calculateIBP(this.hikeToEdit);
          if (ibpInput) {
            ibpInput.value = recalculated;
            this.updateEditIbpBadge(recalculated);
          }
        }
      };
    }

    modal.classList.remove('hidden');
  }

  closeEditModal() {
    const modal = document.getElementById('edit-hike-modal');
    if (modal) modal.classList.add('hidden');
    this.hikeToEdit = null;
  }

  updateEditIbpBadge(ibp) {
    const val = parseInt(ibp, 10) || 1;
    const lvlInfo = (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(val) : { level: 1, label: 'Facile', color: '#16a34a' };
    const sq = document.getElementById('edit-hike-ibp-square');
    const lbl = document.getElementById('edit-hike-ibp-label');
    if (sq) {
      sq.textContent = lvlInfo.level;
      sq.style.backgroundColor = lvlInfo.color;
    }
    if (lbl) {
      lbl.textContent = `Niveau ${lvlInfo.level} (${lvlInfo.label})`;
      lbl.style.color = lvlInfo.color;
    }
  }

  async saveEditModal() {
    if (!this.hikeToEdit) return;

    const newName = document.getElementById('edit-hike-name').value.trim();
    const newNotes = document.getElementById('edit-hike-notes').value.trim();

    if (!newName) {
      this.showToast("Le nom de la randonnée ne peut pas être vide.", "error");
      return;
    }

    this.hikeToEdit.name = newName;
    this.hikeToEdit.notes = newNotes;
    const lastDateInput = document.getElementById('edit-hike-last-date');
    if (lastDateInput) {
      this.hikeToEdit.lastHikeDate = lastDateInput.value.trim();
    }
    const authorEditInput = document.getElementById('edit-hike-author');
    if (authorEditInput && authorEditInput.value.trim()) {
      this.hikeToEdit.ajoutee_par = authorEditInput.value.trim();
    }

    const ibpInputEl = document.getElementById('edit-hike-ibp');
    if (ibpInputEl) {
      const newIbp = parseInt(ibpInputEl.value, 10);
      if (!isNaN(newIbp) && newIbp > 0) {
        this.hikeToEdit.ibp = newIbp;
        if (typeof GPXParser !== 'undefined') {
          const lvlInfo = GPXParser.getIBPLevel(newIbp);
          this.hikeToEdit.ibpLevel = lvlInfo.level;
          this.hikeToEdit.difficulty = lvlInfo.label;
        }
      }
    }

    const updatedGpx = GPXParser.exportToGpxString(this.hikeToEdit);
    await StorageManager.saveHike(this.hikeToEdit, updatedGpx);

    // Auto-update Supabase Cloud in background
    try {
      const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
      const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
      const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
      if (supaUrl && supaKey) {
        StorageManager.pushHikeToSupabase(this.hikeToEdit, supaUrl, supaKey).catch(e => console.warn("Supabase auto-edit error:", e));
      }
    } catch (e) {}

    this.closeEditModal();
    this.applyFiltersAndRender();
    this.renderManagementList();

    if (this.selectedHike && this.selectedHike.id === this.hikeToEdit.id) {
      this.showHikePreviewPanel(this.hikeToEdit);
    }

    this.showToast("Randonnée modifiée avec succès !", "success");
  }

  // =========================================================================
  // DELETE MODAL (🗑️ Corbeille avec confirmation)
  // =========================================================================
  openDeleteModal(hike) {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule. Seul l'administrateur peut supprimer des parcours de cette base.", "warning");
      return;
    }
    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_edit')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de supprimer des randonnées.", "error");
      return;
    }
    this.hikeToDelete = hike;
    const modal = document.getElementById('delete-hike-modal');
    if (!modal) return;

    const nameEl = document.getElementById('delete-modal-hike-name');
    if (nameEl) nameEl.textContent = hike.name || 'cette randonnée';
    modal.classList.remove('hidden');
  }

  closeDeleteModal() {
    const modal = document.getElementById('delete-hike-modal');
    if (modal) modal.classList.add('hidden');
    this.hikeToDelete = null;
  }

  async confirmDeleteModal() {
    if (!this.hikeToDelete) {
      this.closeDeleteModal();
      return;
    }

    const targetHike = this.hikeToDelete;
    const targetId = targetHike.id;
    const targetName = targetHike.name;
    const targetFilename = targetHike.filename;

    try {
      await StorageManager.deleteHike(targetId, targetFilename);
      this.allHikes = this.allHikes.filter(h => h.id !== targetId && h.name !== targetName);

      // Auto-delete from Supabase Cloud in background
      try {
        const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
        const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
        const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
        if (supaUrl && supaKey) {
          StorageManager.deleteFromSupabase(targetId, supaUrl, supaKey).catch(e => console.warn("Supabase auto-delete error:", e));
        }
      } catch (e) {}

      if (this.selectedHike && (this.selectedHike.id === targetId || this.selectedHike.name === targetName)) {
        this.deselectHike();
      }

      this.showToast(`Randonnée « ${targetName} » supprimée définitivement.`, "info");
    } catch (err) {
      console.error("Erreur suppression:", err);
      this.allHikes = this.allHikes.filter(h => h.id !== targetId && h.name !== targetName);
      this.showToast("Randonnée supprimée.", "info");
    } finally {
      this.closeDeleteModal();
      this.applyFiltersAndRender();
      this.renderManagementList();
    }
  }

  // =========================================================================
  // GESTION DES DOUBLONS DANS LA BIBLIOTHÈQUE
  // (Même trace, même kilométrage, même dénivelé)
  // =========================================================================

  handleSearchDuplicatesClick() {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule. Basculez sur la base Randonneurs Sanaryens pour gérer les doublons.", "warning");
      return;
    }

    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_edit') && !AuthManager.isAdmin()) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de modifier ou supprimer des randonnées.", "error");
      return;
    }

    if (!this.allHikes || this.allHikes.length < 2) {
      this.showToast("Votre bibliothèque ne contient pas assez de randonnées pour rechercher des doublons.", "info");
      return;
    }

    const groups = this.findAllDuplicateGroups();
    if (!groups || groups.length === 0) {
      this.showToast("✅ Aucun doublon détecté ! Toutes vos randonnées ont des caractéristiques ou tracés distincts.", "success");
      return;
    }

    this.activeDuplicateGroups = groups;
    this.renderDuplicatesModal();
    const modal = document.getElementById('duplicates-manager-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeDuplicatesModal() {
    const modal = document.getElementById('duplicates-manager-modal');
    if (modal) modal.classList.add('hidden');
    this.activeDuplicateGroups = [];
  }

  areHikesDuplicates(h1, h2) {
    if (!h1 || !h2 || h1.id === h2.id) return false;

    // 1. Kilométrage similaire (< 0.4 km ou < 5%)
    const d1 = Number(h1.distanceKm || 0);
    const d2 = Number(h2.distanceKm || 0);
    const diffDistKm = Math.abs(d1 - d2);
    const maxDist = Math.max(d1, d2, 1);
    const distPct = diffDistKm / maxDist;
    const isSameDist = (diffDistKm <= 0.4) || (distPct <= 0.05);
    if (!isSameDist) return false;

    // 2. Dénivelé similaire (< 35 m ou < 8%)
    const ele1 = Number(h1.elevationGain || 0);
    const ele2 = Number(h2.elevationGain || 0);
    const diffEle = Math.abs(ele1 - ele2);
    const maxEle = Math.max(ele1, ele2, 1);
    const elePct = diffEle / maxEle;
    const isSameEle = (diffEle <= 35) || (elePct <= 0.08);
    if (!isSameEle) return false;

    // 3. Départ géographique
    let distStartMeters = Infinity;
    if (h1.startPoint && h2.startPoint) {
      distStartMeters = GPXParser.haversineDistance(
        h1.startPoint.lat, h1.startPoint.lon,
        h2.startPoint.lat, h2.startPoint.lon
      ) * 1000;
    }

    // 4. Arrivée géographique (si disponible)
    let distEndMeters = Infinity;
    const p1 = h1.points || [];
    const p2 = h2.points || [];
    const end1 = h1.endPoint || (p1.length > 0 ? p1[p1.length - 1] : null);
    const end2 = h2.endPoint || (p2.length > 0 ? p2[p2.length - 1] : null);
    if (end1 && end2) {
      distEndMeters = GPXParser.haversineDistance(end1.lat, end1.lon, end2.lat, end2.lon) * 1000;
    }

    const startMatches = distStartMeters <= 450;
    const endMatches = (distEndMeters === Infinity) || (distEndMeters <= 450);

    // 5. Comparaison des coordonnées du tracé (si points disponibles)
    let trackMatches = true;
    if (p1.length >= 10 && p2.length >= 10) {
      const sampleFractions = [0.2, 0.4, 0.6, 0.8];
      let totalMinDist = 0;
      for (const frac of sampleFractions) {
        const pt1 = p1[Math.floor((p1.length - 1) * frac)];
        let minD = Infinity;
        const step = Math.max(1, Math.floor(p2.length / 30));
        for (let k = 0; k < p2.length; k += step) {
          const pt2 = p2[k];
          const d = GPXParser.haversineDistance(pt1.lat, pt1.lon, pt2.lat, pt2.lon) * 1000;
          if (d < minD) minD = d;
        }
        totalMinDist += minD;
      }
      const avgDist = totalMinDist / sampleFractions.length;
      trackMatches = avgDist <= 450;
    }

    if (startMatches && endMatches && trackMatches) {
      const dStartStr = distStartMeters !== Infinity ? ` (départ à ${Math.round(distStartMeters)} m)` : '';
      return {
        isDuplicate: true,
        reason: `Même tracé${dStartStr}, longueur équivalente (${d1} km vs ${d2} km) et dénivelé identique (+${ele1}m vs +${ele2}m).`
      };
    }

    // Cas de secours : Même nom exact et départ à moins de 1 km
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
    if (norm(h1.name) && norm(h1.name) === norm(h2.name) && distStartMeters <= 1000) {
      return {
        isDuplicate: true,
        reason: `Nom identique (« ${h1.name} »), départ proche (${Math.round(distStartMeters)} m) et métriques équivalentes.`
      };
    }

    return false;
  }

  findAllDuplicateGroups() {
    const hikes = this.allHikes || [];
    if (hikes.length < 2) return [];

    const adj = new Map();
    hikes.forEach(h => adj.set(h.id, []));
    const edgeReasons = new Map();

    for (let i = 0; i < hikes.length; i++) {
      for (let j = i + 1; j < hikes.length; j++) {
        const h1 = hikes[i];
        const h2 = hikes[j];
        const match = this.areHikesDuplicates(h1, h2);
        if (match) {
          adj.get(h1.id).push(h2.id);
          adj.get(h2.id).push(h1.id);
          const key = [h1.id, h2.id].sort().join('__');
          edgeReasons.set(key, match.reason);
        }
      }
    }

    const visited = new Set();
    const groups = [];

    for (const h of hikes) {
      if (visited.has(h.id)) continue;
      const neighbors = adj.get(h.id) || [];
      if (neighbors.length === 0) continue;

      const groupIds = [];
      const queue = [h.id];
      visited.add(h.id);

      while (queue.length > 0) {
        const currId = queue.shift();
        groupIds.push(currId);
        for (const nxt of (adj.get(currId) || [])) {
          if (!visited.has(nxt)) {
            visited.add(nxt);
            queue.push(nxt);
          }
        }
      }

      if (groupIds.length > 1) {
        const groupHikes = groupIds.map(id => hikes.find(x => x.id === id)).filter(Boolean);

        // Algorithme de pré-sélection de la randonnée la plus complète à conserver :
        const scoreHike = (hk) => {
          let score = 0;
          if (hk.notes && hk.notes.trim().length > 5) score += 50;
          if (hk.points && hk.points.length > 0) score += Math.min(30, hk.points.length / 50);
          if (hk.ajoutee_par) score += 10;
          if (/\b(bis|copie|copy|\(\d+\))\b/i.test(hk.name)) score -= 40;
          if (hk.created_at || hk.date_ajout) score += 5;
          return score;
        };

        groupHikes.sort((a, b) => scoreHike(b) - scoreHike(a));

        const first = groupHikes[0];
        const second = groupHikes[1];
        const key = [first.id, second.id].sort().join('__');
        const reason = edgeReasons.get(key) || 
          `Tracé et caractéristiques identiques (${first.distanceKm} km, +${first.elevationGain}m).`;

        groups.push({
          id: `group_${groups.length + 1}`,
          hikes: groupHikes,
          keepId: groupHikes[0].id,
          reason: reason
        });
      }
    }

    return groups;
  }

  renderDuplicatesModal() {
    const modalBody = document.getElementById('duplicates-modal-body');
    const modalSubtitle = document.getElementById('duplicates-modal-subtitle');
    const modalSummary = document.getElementById('duplicates-modal-summary');
    const applyBtn = document.getElementById('btn-apply-duplicates-clean');
    const applyBtnText = document.getElementById('btn-apply-duplicates-text');

    if (!modalBody) return;
    modalBody.innerHTML = '';

    const groups = this.activeDuplicateGroups || [];
    let totalDuplicatesToDelete = 0;
    groups.forEach(g => {
      totalDuplicatesToDelete += (g.hikes.length - 1);
    });

    if (modalSubtitle) {
      modalSubtitle.textContent = `${groups.length} groupe${groups.length > 1 ? 's' : ''} de doublons détecté${groups.length > 1 ? 's' : ''} (${totalDuplicatesToDelete} randonnée${totalDuplicatesToDelete > 1 ? 's' : ''} en trop).`;
    }

    if (modalSummary) {
      modalSummary.innerHTML = `
        <span class="font-bold text-slate-800">${groups.length}</span> groupe(s) • 
        <span class="font-bold text-rose-600">${totalDuplicatesToDelete}</span> doublon(s) à supprimer • 
        <span class="font-bold text-emerald-700">${groups.length}</span> randonnée(s) conservée(s)
      `;
    }

    if (applyBtn) {
      applyBtn.disabled = totalDuplicatesToDelete === 0;
    }
    if (applyBtnText) {
      applyBtnText.textContent = `Supprimer les ${totalDuplicatesToDelete} doublon(s) sélectionnés`;
    }

    if (groups.length === 0) {
      modalBody.innerHTML = `
        <div class="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-500">
          <div class="text-3xl mb-2">🎉</div>
          <div class="font-bold text-slate-800 text-base">Aucun doublon restant</div>
          <div class="text-xs text-slate-500 mt-1">Toutes vos randonnées sont uniques et conservées.</div>
        </div>
      `;
      return;
    }

    groups.forEach((group, gIdx) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'bg-white border-2 border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4';
      groupEl.dataset.groupId = group.id;

      const hikesHtml = group.hikes.map(hike => {
        const isKept = (hike.id === group.keepId);
        const cardBorder = isKept 
          ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/50' 
          : 'border-slate-200 bg-slate-50/60 opacity-85 hover:border-slate-300';
        
        return `
          <div class="duplicate-hike-card p-3 sm:p-4 rounded-xl border-2 transition cursor-pointer ${cardBorder}" data-hike-id="${hike.id}">
            <div class="flex items-start sm:items-center justify-between gap-3">
              <label class="flex items-start sm:items-center gap-3 cursor-pointer flex-1 min-w-0">
                <input type="radio" name="keep_${group.id}" value="${hike.id}" ${isKept ? 'checked' : ''} class="mt-0.5 sm:mt-0 w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-sm sm:text-base text-slate-900 truncate">${this.escapeHtml(hike.name)}</span>
                    ${isKept ? `
                      <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-extrabold flex items-center gap-1 select-none">
                        <span>✅</span> <span>À CONSERVER</span>
                      </span>
                    ` : `
                      <span class="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold flex items-center gap-1 select-none">
                        <span>🗑️</span> <span>SERA SUPPRIMÉE</span>
                      </span>
                    `}
                  </div>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
                    <span class="font-bold text-emerald-700">📏 ${hike.distanceKm} km</span>
                    <span class="font-bold text-emerald-700">↗️ +${hike.elevationGain}m</span>
                    <span>⛰️ ${hike.minElevation || 0}m - ${hike.maxElevation || 0}m</span>
                    <span>⏱️ ${hike.estimatedDuration || '3h30'}</span>
                    ${hike.points ? `<span>📍 ${hike.points.length} points</span>` : ''}
                    ${hike.ajoutee_par ? `<span class="font-medium text-slate-500">👤 Par : <strong class="text-slate-700">${this.escapeHtml(hike.ajoutee_par)}</strong></span>` : ''}
                  </div>
                  ${hike.notes ? `<div class="text-[11px] text-slate-600 line-clamp-2 mt-1.5 bg-white/80 p-1.5 rounded border border-slate-200/60 italic">« ${this.escapeHtml(hike.notes)} »</div>` : ''}
                </div>
              </label>

              <button type="button" class="btn-preview-dup px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1 flex-shrink-0 cursor-pointer" title="Aperçu sur la carte">
                <span>🗺️</span> <span class="hidden sm:inline">Voir</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      groupEl.innerHTML = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold">Groupe #${gIdx + 1}</span>
              <span class="text-xs sm:text-sm font-bold text-slate-800">${group.hikes.length} randonnées en doublon</span>
            </div>
            <div class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span>📌</span> <span>${this.escapeHtml(group.reason)}</span>
            </div>
          </div>
          <button type="button" class="btn-clean-single-group text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline flex items-center gap-1 self-end sm:self-auto cursor-pointer" title="Supprimer immédiatement les doublons de ce groupe uniquement">
            <span>🗑️</span> <span>Nettoyer ce groupe</span>
          </button>
        </div>

        <div class="space-y-2.5">
          ${hikesHtml}
        </div>
      `;

      // Event listener on radio & cards
      groupEl.querySelectorAll('.duplicate-hike-card').forEach(card => {
        const hikeId = card.dataset.hikeId;
        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-preview-dup')) return;
          this.setGroupKeepHike(group.id, hikeId);
        });

        const previewBtn = card.querySelector('.btn-preview-dup');
        if (previewBtn) {
          previewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const h = group.hikes.find(x => x.id === hikeId);
            if (h) {
              this.closeDuplicatesModal();
              this.showHikeOnMap(h);
              this.showToast(`Affichage du tracé de « ${h.name} » sur la carte`, "info");
            }
          });
        }
      });

      // Single group cleanup button
      const cleanGroupBtn = groupEl.querySelector('.btn-clean-single-group');
      if (cleanGroupBtn) {
        cleanGroupBtn.addEventListener('click', () => {
          this.cleanSingleDuplicateGroup(group.id);
        });
      }

      modalBody.appendChild(groupEl);
    });
  }

  setGroupKeepHike(groupId, hikeId) {
    const grp = (this.activeDuplicateGroups || []).find(g => g.id === groupId);
    if (!grp) return;
    grp.keepId = hikeId;
    this.renderDuplicatesModal();
  }

  async cleanSingleDuplicateGroup(groupId) {
    const grp = (this.activeDuplicateGroups || []).find(g => g.id === groupId);
    if (!grp) return;

    const toDelete = grp.hikes.filter(h => h.id !== grp.keepId);
    if (toDelete.length === 0) return;

    const keptHike = grp.hikes.find(h => h.id === grp.keepId);
    const confirmMsg = `Confirmez-vous la suppression de ${toDelete.length} randonnée(s) en doublon dans ce groupe ?\n\n` +
      `Randonnée conservée : « ${keptHike ? keptHike.name : ''} »\n` +
      `Randonnées supprimées : ${toDelete.map(h => '« ' + h.name + ' »').join(', ')}`;

    if (!confirm(confirmMsg)) return;

    for (const h of toDelete) {
      try {
        await StorageManager.deleteHike(h.id, h.filename);
        this.allHikes = this.allHikes.filter(x => x.id !== h.id);
        
        // Auto-delete Supabase Cloud in background
        try {
          const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
          const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
          const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
          if (supaUrl && supaKey) {
            StorageManager.deleteFromSupabase(h.id, supaUrl, supaKey).catch(e => console.warn(e));
          }
        } catch (e) {}
      } catch (err) {
        console.warn("Erreur suppression doublon :", err);
      }
    }

    this.activeDuplicateGroups = this.activeDuplicateGroups.filter(g => g.id !== groupId);
    this.applyFiltersAndRender();
    this.renderManagementList();
    this.renderDuplicatesModal();

    this.showToast(`Groupe nettoyé : ${toDelete.length} doublon(s) supprimé(s).`, "success");

    if (this.activeDuplicateGroups.length === 0) {
      setTimeout(() => this.closeDuplicatesModal(), 1200);
    }
  }

  async executeApplyDuplicatesClean() {
    const groups = this.activeDuplicateGroups || [];
    if (groups.length === 0) return;

    const allToDelete = [];
    groups.forEach(g => {
      g.hikes.forEach(h => {
        if (h.id !== g.keepId) {
          allToDelete.push(h);
        }
      });
    });

    if (allToDelete.length === 0) {
      this.showToast("Aucun doublon à supprimer.", "info");
      return;
    }

    const confirmMsg = `Confirmez-vous la suppression définitive de ${allToDelete.length} randonnée(s) en doublon ?\n\n` +
      `Les ${groups.length} randonnées choisies seront conservées.\nCette action est irréversible.`;

    if (!confirm(confirmMsg)) return;

    let deletedCount = 0;
    const deleteBtn = document.getElementById('btn-apply-duplicates-clean');
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.innerHTML = `<span>⏳</span> Suppression en cours...`;
    }

    try {
      for (const h of allToDelete) {
        try {
          await StorageManager.deleteHike(h.id, h.filename);
          this.allHikes = this.allHikes.filter(x => x.id !== h.id);
          deletedCount++;

          // Auto-delete Supabase
          try {
            const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
            const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
            const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
            if (supaUrl && supaKey) {
              StorageManager.deleteFromSupabase(h.id, supaUrl, supaKey).catch(e => console.warn(e));
            }
          } catch (e) {}
        } catch (err) {
          console.warn("Erreur suppression doublon :", err);
        }
      }

      this.closeDuplicatesModal();
      this.applyFiltersAndRender();
      this.renderManagementList();
      this.showToast(`✅ Nettoyage terminé : ${deletedCount} doublon(s) supprimé(s) avec succès !`, "success");
    } finally {
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `<span>🗑️</span> <span id="btn-apply-duplicates-text">Supprimer les doublons sélectionnés</span>`;
      }
    }
  }

  // =========================================================================
  // RESTITUTION & PREVIEWS
  // =========================================================================
  handleHikeHover(hike) {
    this.cancelHoverClear();
    if (hike) {
      this.hoveredHike = hike;
      if (window.MapManagerInstance) {
        window.MapManagerInstance.hoveredHike = hike;
        window.MapManagerInstance.displayTrack(hike, false);
      }
      this.showHikePreviewPanel(hike);
    } else {
      this.handleHikeHoverEnd();
    }
  }

  handleHikeHoverEnd() {
    this.scheduleHoverClear();
  }

  scheduleHoverClear(delayMs = 250) {
    if (this.isHikePinned) return;
    this.cancelHoverClear();
    this.hoverClearTimer = setTimeout(() => {
      if (this.isHikePinned) return;
      const previewPanel = document.getElementById('hike-preview-panel');
      const isOver = this.isMouseOverPreview || (previewPanel && previewPanel.matches && previewPanel.matches(':hover'));
      if (isOver) {
        // La souris est sur le panneau d'aperçu : on maintient l'affichage stable sans clignotement
        return;
      }

      this.hoveredHike = null;
      if (window.MapManagerInstance) {
        window.MapManagerInstance.hoveredHike = null;
      }

      if (this.selectedHike) {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.displayTrack(this.selectedHike, true);
        }
        this.showHikePreviewPanel(this.selectedHike);
      } else {
        if (window.MapManagerInstance) {
          window.MapManagerInstance.clearTrack();
        }
        this.hideHikePreviewPanel();
      }
    }, delayMs);
  }

  cancelHoverClear() {
    if (this.hoverClearTimer) {
      clearTimeout(this.hoverClearTimer);
      this.hoverClearTimer = null;
    }
  }

  handleHikeSelect(hike) {
    if (!hike) return;
    this.cancelHoverClear();
    this.selectedHike = hike;
    if (window.MapManagerInstance) {
      window.MapManagerInstance.selectHike(hike, true, false);
    }
    this.showHikePreviewPanel(hike);
    this.updateTableSelection(hike.id);
  }

  updateTableSelection(selectedId) {
    const rows = document.querySelectorAll('#hikes-table-body tr[data-hike-id]');
    rows.forEach(tr => {
      if (selectedId && tr.dataset.hikeId === selectedId) {
        tr.classList.add('bg-emerald-50', 'border-emerald-300', 'font-semibold');
      } else {
        tr.classList.remove('bg-emerald-50', 'border-emerald-300', 'font-semibold');
      }
    });
  }

  async showHikePreviewPanel(hike) {
    const previewPanel = document.getElementById('hike-preview-panel');
    if (!previewPanel || !hike) return;

    if ((!hike.points || hike.points.length === 0) && typeof StorageManager !== 'undefined') {
      await StorageManager.ensureHikeTrackLoaded(hike);
    }

    // Assurer que le tracé a ses distances cumulées calculées
    if (hike.points && hike.points.length > 0 && typeof hike.points[0].dist === 'undefined') {
      let cumulative = 0;
      hike.points[0].dist = 0;
      for (let i = 1; i < hike.points.length; i++) {
        const p1 = hike.points[i - 1];
        const p2 = hike.points[i];
        if (typeof GPXParser !== 'undefined') {
          cumulative += GPXParser.haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
        } else {
          // Haversine direct
          const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
          const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((p1.lat * Math.PI) / 180) * Math.cos((p2.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
          cumulative += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        p2.dist = Math.round(cumulative * 100) / 100;
      }
      if (!hike.distanceKm) {
        hike.distanceKm = Math.round(cumulative * 10) / 10;
      }
    }

    // Min & Max elevation
    if ((!hike.minElevation || !hike.maxElevation) && hike.points && hike.points.length > 0) {
      let minE = Infinity, maxE = -Infinity;
      hike.points.forEach(p => {
        if (p.ele < minE) minE = p.ele;
        if (p.ele > maxE) maxE = p.ele;
      });
      if (minE !== Infinity) {
        hike.minElevation = Math.round(minE);
        hike.maxElevation = Math.round(maxE);
      }
    }

    previewPanel.classList.remove('hidden');

    // Détection immédiate si la souris se trouve déjà sous la zone d'apparition du panneau
    if (previewPanel.matches && previewPanel.matches(':hover')) {
      this.isMouseOverPreview = true;
      this.cancelHoverClear();
    }

    const distDisplay = hike.distanceKm || (hike.distance ? String(hike.distance) : '0');
    const dplusDisplay = (hike.elevationGain !== undefined) ? Math.round(hike.elevationGain) : 0;
    const dmoinsDisplay = (hike.elevationLoss !== undefined) ? Math.round(hike.elevationLoss) : 0;
    const altMin = (hike.minElevation !== undefined) ? hike.minElevation : 0;
    const altMax = (hike.maxElevation !== undefined) ? hike.maxElevation : 0;

    document.getElementById('preview-title').textContent = hike.name || 'Randonnée';
    document.getElementById('preview-dist').textContent = `${distDisplay} km`;
    document.getElementById('preview-dplus').textContent = `+${dplusDisplay}m`;
    document.getElementById('preview-dmoins').textContent = `-${dmoinsDisplay}m`;
    document.getElementById('preview-alt').textContent = `${altMin}m / ${altMax}m`;
    document.getElementById('preview-duration').textContent = hike.estimatedDuration || '3h30';
    document.getElementById('preview-notes').textContent = hike.notes || 'Aucune note enregistrée';

    const ibpVal = (typeof hike.ibp === 'number') ? hike.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(hike) : 50);
    const ibpInfo = (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(ibpVal) : { level: 3, label: 'Peu difficile', color: '#ea580c' };
    const ibpBox = document.getElementById('preview-ibp-box');
    const ibpEl = document.getElementById('preview-ibp');
    if (ibpEl && ibpBox) {
      ibpBox.style.backgroundColor = `${ibpInfo.color}15`;
      ibpBox.style.borderColor = `${ibpInfo.color}40`;
      ibpBox.style.color = ibpInfo.color;
      ibpBox.title = `Indice IBP : ${ibpVal} • Niveau ${ibpInfo.level} (${ibpInfo.label})`;
      ibpEl.innerHTML = `<span class="w-3.5 h-3.5 rounded text-[9px] font-black text-white flex items-center justify-center" style="background-color:${ibpInfo.color}">${ibpInfo.level}</span><span>${ibpVal}</span>`;
    }

    const isCarteMode = window.location.hash.startsWith('#carte') || (window.PortalRouterInstance && window.PortalRouterInstance.currentView === 'carte') || (window.portalRouter && window.portalRouter.currentView === 'carte');
    const btnDl = document.getElementById('preview-btn-download');
    if (btnDl) {
      if (isCarteMode) {
        btnDl.classList.add('hidden');
        btnDl.style.setProperty('display', 'none', 'important');
        btnDl.onclick = null;
      } else {
        btnDl.classList.remove('hidden');
        btnDl.style.removeProperty('display');
        btnDl.onclick = () => this.openDownloadModal(hike);
      }
    }

    // Assurer l'instance ElevationProfile
    if (!this.elevationProfile && typeof ElevationProfile !== 'undefined') {
      this.elevationProfile = new ElevationProfile('elevation-chart-container');
      window.ElevationProfileInstance = this.elevationProfile;
    }

    if (this.elevationProfile) {
      this.elevationProfile.render(hike, 
        (point) => { if (window.MapManagerInstance) window.MapManagerInstance.setCursorPosition(point); },
        () => { if (window.MapManagerInstance) window.MapManagerInstance.clearCursorPosition(); }
      );
    }
  }

  hideHikePreviewPanel() {
    const previewPanel = document.getElementById('hike-preview-panel');
    if (previewPanel && !this.selectedHike && !this.isHikePinned) {
      previewPanel.classList.add('hidden');
      this.isMouseOverPreview = false;
    }
  }

  /**
   * Configuration du déplacement tactile & souris de la petite fenêtre d'aperçu
   */
  setupDraggablePreviewPanel() {
    const panel = document.getElementById('hike-preview-panel');
    const container = document.getElementById('map-column');
    if (!panel || !container) return;

    // Empêcher Leaflet de capter les clics et le défilement sur le panneau
    if (typeof L !== 'undefined' && L.DomEvent) {
      L.DomEvent.disableClickPropagation(panel);
      L.DomEvent.disableScrollPropagation(panel);
    }

    const dragHandle = document.getElementById('preview-drag-handle');
    const titleHeader = panel.querySelector('.flex.items-start');
    const resetBtn = document.getElementById('btn-reset-preview-pos');

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let userMoved = false;

    // Bouton de réinitialisation vers le coin bas-gauche d'origine
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        userMoved = false;
        panel.style.left = '';
        panel.style.top = '';
        panel.style.bottom = '';
        panel.style.right = '';
        panel.style.width = '';
        resetBtn.classList.add('hidden');
      });
    }

    const onStart = (e) => {
      // Ignorer si clic sur un bouton, champ de saisie, canvas ou lien
      if (e.target.closest('button, input, select, a, canvas, #elevation-chart-container')) return;

      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      if (!userMoved) {
        initialLeft = panelRect.left - containerRect.left;
        initialTop = panelRect.top - containerRect.top;
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
        panel.style.left = `${initialLeft}px`;
        panel.style.top = `${initialTop}px`;
        panel.style.width = `${panelRect.width}px`;
      } else {
        initialLeft = panel.offsetLeft;
        initialTop = panel.offsetTop;
      }

      startX = clientX;
      startY = clientY;
      isDragging = true;
      userMoved = true;

      panel.style.transition = 'none';
      panel.classList.add('ring-2', 'ring-emerald-500/70', 'shadow-2xl');
      if (dragHandle) dragHandle.classList.add('cursor-grabbing');
      if (resetBtn) resetBtn.classList.remove('hidden');

      e.stopPropagation();
    };

    const onMove = (e) => {
      if (!isDragging) return;

      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

      const dx = clientX - startX;
      const dy = clientY - startY;

      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      const minX = 4;
      const maxX = Math.max(minX, containerRect.width - panelRect.width - 4);
      const minY = 4;
      const maxY = Math.max(minY, containerRect.height - panelRect.height - 4);

      const targetX = Math.max(minX, Math.min(maxX, initialLeft + dx));
      const targetY = Math.max(minY, Math.min(maxY, initialTop + dy));

      panel.style.left = `${targetX}px`;
      panel.style.top = `${targetY}px`;

      e.preventDefault();
      e.stopPropagation();
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      panel.style.transition = '';
      panel.classList.remove('ring-2', 'ring-emerald-500/70');
      if (dragHandle) dragHandle.classList.remove('cursor-grabbing');
    };

    // Attacher aux poignées de glissement (handle supérieur et barre de titre)
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', onStart);
      dragHandle.addEventListener('touchstart', onStart, { passive: false });
    }
    if (titleHeader) {
      titleHeader.addEventListener('mousedown', onStart);
      titleHeader.addEventListener('touchstart', onStart, { passive: false });
    }

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    // Ajuster si redimensionnement de l'écran pour rester dans la carte
    window.addEventListener('resize', () => {
      if (!userMoved || panel.classList.contains('hidden')) return;
      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const maxX = Math.max(4, containerRect.width - panelRect.width - 4);
      const maxY = Math.max(4, containerRect.height - panelRect.height - 4);
      if (panel.offsetLeft > maxX) panel.style.left = `${maxX}px`;
      if (panel.offsetTop > maxY) panel.style.top = `${maxY}px`;
    });
  }

  getLocalPlaceMatches(query) {
    const q = (query || '').toLowerCase().trim();
    if (q.length < 2) return [];

    const commonPlaces = [
      { title: "Sanary-sur-Mer", subtitle: "83110, Var, Provence-Alpes-Côte d'Azur", lat: 43.1187, lon: 5.8037, typeLabel: "Ville", icon: "🏙️" },
      { title: "Bandol", subtitle: "83150, Var, Provence-Alpes-Côte d'Azur", lat: 43.1364, lon: 5.7533, typeLabel: "Ville", icon: "🏙️" },
      { title: "Ollioules", subtitle: "83190, Var, Provence-Alpes-Côte d'Azur", lat: 43.1397, lon: 5.8481, typeLabel: "Ville", icon: "🏙️" },
      { title: "Six-Fours-les-Plages", subtitle: "83140, Var, Provence-Alpes-Côte d'Azur", lat: 43.1066, lon: 5.8396, typeLabel: "Ville", icon: "🏙️" },
      { title: "Toulon", subtitle: "83000, Var, Provence-Alpes-Côte d'Azur", lat: 43.1242, lon: 5.9280, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Seyne-sur-Mer", subtitle: "83500, Var, Provence-Alpes-Côte d'Azur", lat: 43.1009, lon: 5.8824, typeLabel: "Ville", icon: "🏙️" },
      { title: "Saint-Mandrier-sur-Mer", subtitle: "83430, Var, Provence-Alpes-Côte d'Azur", lat: 43.0789, lon: 5.9288, typeLabel: "Ville", icon: "🏙️" },
      { title: "Le Beausset", subtitle: "83330, Var, Provence-Alpes-Côte d'Azur", lat: 43.1978, lon: 5.8039, typeLabel: "Ville", icon: "🏙️" },
      { title: "Le Castellet", subtitle: "83330, Var, Provence-Alpes-Côte d'Azur", lat: 43.2036, lon: 5.7769, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Cadière-d'Azur", subtitle: "83740, Var, Provence-Alpes-Côte d'Azur", lat: 43.1956, lon: 5.7561, typeLabel: "Ville", icon: "🏙️" },
      { title: "Saint-Cyr-sur-Mer", subtitle: "83270, Var, Provence-Alpes-Côte d'Azur", lat: 43.1819, lon: 5.7142, typeLabel: "Ville", icon: "🏙️" },
      { title: "Évenos / Sainte-Anne", subtitle: "83330, Var, Provence-Alpes-Côte d'Azur", lat: 43.1664, lon: 5.8286, typeLabel: "Village", icon: "📍" },
      { title: "Signes", subtitle: "83870, Var, Provence-Alpes-Côte d'Azur", lat: 43.2922, lon: 5.8631, typeLabel: "Village", icon: "📍" },
      { title: "Cassis", subtitle: "13260, Bouches-du-Rhône", lat: 43.2144, lon: 5.5381, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Ciotat", subtitle: "13600, Bouches-du-Rhône", lat: 43.1748, lon: 5.6047, typeLabel: "Ville", icon: "🏙️" },
      { title: "Roquefort-la-Bédoule", subtitle: "13830, Bouches-du-Rhône", lat: 43.2483, lon: 5.5908, typeLabel: "Village", icon: "📍" },
      { title: "Hyères", subtitle: "83400, Var, Provence-Alpes-Côte d'Azur", lat: 43.1206, lon: 6.1286, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Valette-du-Var", subtitle: "83160, Var, Provence-Alpes-Côte d'Azur", lat: 43.1378, lon: 5.9831, typeLabel: "Ville", icon: "🏙️" },
      { title: "La Garde", subtitle: "83130, Var, Provence-Alpes-Côte d'Azur", lat: 43.1250, lon: 6.0125, typeLabel: "Ville", icon: "🏙️" },
      { title: "Le Pradet", subtitle: "83220, Var, Provence-Alpes-Côte d'Azur", lat: 43.1064, lon: 6.0222, typeLabel: "Ville", icon: "🏙️" },
      { title: "Carqueiranne", subtitle: "83320, Var, Provence-Alpes-Côte d'Azur", lat: 43.0947, lon: 6.0747, typeLabel: "Ville", icon: "🏙️" },
      { title: "Solliès-Pont", subtitle: "83210, Var, Provence-Alpes-Côte d'Azur", lat: 43.1906, lon: 6.0411, typeLabel: "Ville", icon: "🏙️" },
      { title: "Cuers", subtitle: "83390, Var, Provence-Alpes-Côte d'Azur", lat: 43.2375, lon: 6.0717, typeLabel: "Ville", icon: "🏙️" },
      { title: "Marseille", subtitle: "13000, Bouches-du-Rhône", lat: 43.2965, lon: 5.3698, typeLabel: "Ville", icon: "🏙️" },
      { title: "Aubagne", subtitle: "13400, Bouches-du-Rhône", lat: 43.2928, lon: 5.5708, typeLabel: "Ville", icon: "🏙️" },
      { title: "Cap Sicié / Notre-Dame du Mai", subtitle: "Massif côtier, Six-Fours / La Seyne", lat: 43.0578, lon: 5.8569, typeLabel: "Massif", icon: "⛰️" },
      { title: "Mont Faron", subtitle: "Sommet & Belvédère, Toulon", lat: 43.1539, lon: 5.9525, typeLabel: "Sommet", icon: "⛰️" },
      { title: "Le Croupatier", subtitle: "Barre rocheuse, Ollioules / Evenos", lat: 43.1611, lon: 5.8614, typeLabel: "Massif", icon: "⛰️" },
      { title: "Gros Cerveau", subtitle: "Crête panoramique, Ollioules / Sanary", lat: 43.1528, lon: 5.8194, typeLabel: "Massif", icon: "⛰️" }
    ];

    return commonPlaces
      .filter(p => p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q))
      .map(p => ({
        ...p,
        shortName: p.title,
        displayName: `${p.title} (${p.subtitle})`,
        isAddress: false
      }));
  }

  async fetchPlacesList(query, signal) {
    const cleanQuery = (query || '').trim();
    if (cleanQuery.length < 2) return [];

    const normKey = cleanQuery.toLowerCase();
    if (!this.placesCache) this.placesCache = new Map();
    if (this.placesCache.has(normKey)) {
      return this.placesCache.get(normKey);
    }

    const hasDigits = /\d/.test(cleanQuery);

    // Fonction d'aide pour générer l'émoji du drapeau national (ISO 3166-1 alpha-2)
    const getCountryFlag = (code) => {
      if (!code || typeof code !== 'string' || code.length !== 2) return '';
      try {
        const cp = code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
        return String.fromCodePoint(...cp);
      } catch (e) {
        return '';
      }
    };

    // 1. RECHERCHE MONDIALE DE TOUTES LES VILLES DU MONDE (Open-Meteo Geocoding API - 3M+ villes, sans clé, temps de réponse <100ms)
    const openMeteoPromise = (async () => {
      try {
        const omController = new AbortController();
        const omTimer = setTimeout(() => omController.abort(), 2500);
        const onAbort = () => omController.abort();
        if (signal) signal.addEventListener('abort', onAbort, { once: true });

        const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=10&language=fr&format=json`;
        const res = await fetch(u, { signal: omController.signal });
        clearTimeout(omTimer);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (res.ok) {
          const data = await res.json();
          return (data.results || []).map(r => {
            const flag = getCountryFlag(r.country_code);
            const country = r.country || '';
            const admin = r.admin1 || r.admin2 || '';
            const subParts = [admin, country].filter(Boolean);
            const subtitle = subParts.join(', ');
            const isCapital = r.feature_code === 'PPLC';
            const isPeak = ['PK', 'MT', 'HLL', 'VLC'].includes(r.feature_code);

            const icon = isPeak ? '⛰️' : (isCapital ? '🏛️' : '🏙️');
            let typeLabel = 'Ville';
            if (isPeak) typeLabel = 'Sommet';
            else if (isCapital) typeLabel = country ? `Capitale • ${country}` : 'Capitale';
            else if (country) typeLabel = `Ville • ${country}`;

            return {
              lat: r.latitude,
              lon: r.longitude,
              title: r.name,
              subtitle: subtitle,
              shortName: r.name,
              displayName: subtitle ? `${r.name} (${subtitle})` : r.name,
              icon: flag ? `${flag} ${icon}` : icon,
              typeLabel: typeLabel,
              country: country,
              countryCode: r.country_code,
              population: r.population || 0,
              isAddress: false,
              isCity: true,
              isCapital: isCapital,
              score: (isCapital ? 220 : 120) + (r.population ? Math.min(100, Math.log10(r.population) * 15) : 0)
            };
          });
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn("Erreur Open-Meteo Geocoding :", e);
      }
      return [];
    })();

    // 2. BASE ADRESSE NATIONALE (BAN) POUR ADRESSES ET RUES DE FRANCE
    const banPromise = (async () => {
      try {
        const banController = new AbortController();
        const banTimer = setTimeout(() => banController.abort(), 2000);
        const onAbort = () => banController.abort();
        if (signal) signal.addEventListener('abort', onAbort, { once: true });

        const bUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(cleanQuery)}&limit=6`;
        const bRes = await fetch(bUrl, { signal: banController.signal });
        clearTimeout(banTimer);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (bRes.ok) {
          const bData = await bRes.json();
          return (bData.features || [])
            .filter(f => f.properties && (f.properties.score > 0.35 || (hasDigits && f.properties.type === 'housenumber')))
            .map(f => {
              const props = f.properties || {};
              const type = props.type || 'locality';
              let icon = '📍';
              let typeLabel = 'Lieu';
              let score = 50;
              if (type === 'housenumber') {
                icon = '🏠';
                typeLabel = 'Adresse';
                score = hasDigits ? 280 : 70;
              } else if (type === 'street') {
                icon = '🛣️';
                typeLabel = 'Rue';
                score = hasDigits ? 220 : 80;
              } else if (type === 'municipality') {
                icon = '🏙️';
                typeLabel = 'Ville • France';
                score = 130;
              }

              const title = props.name || props.label;
              const subtitle = [props.postcode, props.city, props.context].filter(Boolean).join(', ');

              return {
                lat: f.geometry.coordinates[1],
                lon: f.geometry.coordinates[0],
                title: title,
                subtitle: subtitle,
                shortName: props.label || title,
                displayName: subtitle ? `${title} (${subtitle})` : title,
                icon: `🇫🇷 ${icon}`,
                typeLabel: typeLabel,
                country: 'France',
                countryCode: 'FR',
                isAddress: type === 'housenumber',
                isCity: type === 'municipality',
                isCapital: false,
                score: score
              };
            });
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn("Erreur BAN :", e);
      }
      return [];
    })();

    // 3. PHOTON / KOMOOT (OPENSTREETMAP MONDIAL - Sommets, Parcs, Villes et Lieux mondiaux)
    const photonPromise = (async () => {
      try {
        const phController = new AbortController();
        const phTimer = setTimeout(() => phController.abort(), 2200);
        const onAbort = () => phController.abort();
        if (signal) signal.addEventListener('abort', onAbort, { once: true });

        const pUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=6&lang=fr`;
        const pRes = await fetch(pUrl, { signal: phController.signal });
        clearTimeout(phTimer);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (pRes.ok) {
          const pData = await pRes.json();
          return (pData.features || []).map(f => {
            const p = f.properties || {};
            const flag = getCountryFlag(p.countrycode);
            const isPeak = p.osm_value === 'peak' || p.osm_key === 'natural';
            const isCity = ['city', 'town', 'village', 'capital'].includes(p.osm_value);
            const icon = isPeak ? '⛰️' : (isCity ? '🏙️' : '📍');
            const sub = [p.state, p.country].filter(Boolean).join(', ');

            return {
              lat: f.geometry.coordinates[1],
              lon: f.geometry.coordinates[0],
              title: p.name,
              subtitle: sub,
              shortName: p.name,
              displayName: sub ? `${p.name} (${sub})` : p.name,
              icon: flag ? `${flag} ${icon}` : icon,
              typeLabel: isPeak ? 'Sommet' : (p.country ? `Lieu • ${p.country}` : 'Lieu'),
              country: p.country,
              countryCode: p.countrycode,
              isAddress: Boolean(p.housenumber),
              isCity: isCity,
              isCapital: p.osm_value === 'capital',
              score: isPeak ? 95 : (isCity ? 85 : 45)
            };
          });
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn("Erreur Photon :", e);
      }
      return [];
    })();

    // Exécution parallèle des sources
    const [omSettled, banSettled, phSettled] = await Promise.allSettled([
      openMeteoPromise,
      banPromise,
      photonPromise
    ]);

    const omItems = (omSettled.status === 'fulfilled' && omSettled.value) ? omSettled.value : [];
    const banItems = (banSettled.status === 'fulfilled' && banSettled.value) ? banSettled.value : [];
    const phItems = (phSettled.status === 'fulfilled' && phSettled.value) ? phSettled.value : [];

    const candidates = [...omItems, ...banItems, ...phItems];

    // Attribution des scores de pertinence textuelle
    const qLower = normKey;
    candidates.forEach(item => {
      const tLower = (item.title || '').toLowerCase();
      if (tLower === qLower) {
        item.score += 500; // Correspondance exacte du nom (ex: "Rome" -> Rome, Italie)
      } else if (tLower.startsWith(qLower)) {
        item.score += 250;
      } else if (tLower.includes(qLower)) {
        item.score += 50;
      }
      if (hasDigits && item.isAddress) {
        item.score += 300;
      }
    });

    // Tri par score de pertinence décroissant
    candidates.sort((a, b) => b.score - a.score);

    // Déduplication géographique
    const combined = [];
    candidates.forEach(p => {
      if (!p.title || isNaN(p.lat) || isNaN(p.lon)) return;
      const exists = combined.some(c => {
        const sameTitle = c.title.toLowerCase() === p.title.toLowerCase();
        const distKm = GPXParser.haversineDistance(c.lat, c.lon, p.lat, p.lon);
        return (sameTitle && distKm < 50) || distKm < 8;
      });
      if (!exists) {
        combined.push(p);
      }
    });

    const finalResults = combined.slice(0, 10);
    this.placesCache.set(normKey, finalResults);
    return finalResults;
  }

  renderPlacesResults(places, query) {
    const resultsContainer = document.getElementById('location-autocomplete-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '';

    // Recherche GR : tous les GR via OpenStreetMap (tracé réel)
    if (typeof GrManager !== 'undefined' && GrManager.isGrQuery(query)) {
      GrManager.renderResults(resultsContainer, query, (it) => {
        const locationInput = document.getElementById('location-input');
        if (locationInput) locationInput.value = `${it.ref}${it.name && it.name !== it.ref ? ' - ' + it.name : ''}`;
      });
      return;
    }

    const namedTrails = (typeof GrManager !== 'undefined' && Array.isArray(this._lastNamedTrails))
      ? this._lastNamedTrails
      : [];

    if ((!places || places.length === 0) && namedTrails.length === 0) {
      resultsContainer.innerHTML = `
        <div class="p-3.5 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
          <span>🌍</span> Aucun lieu trouvé dans le monde pour "<b>${this.escapeHtml(query)}</b>"
        </div>`;
      resultsContainer.classList.remove('hidden');
      return;
    }

    resultsContainer.classList.remove('hidden');
    if (namedTrails.length > 0 && typeof GrManager !== 'undefined') {
      GrManager.appendTrailItemsToContainer(resultsContainer, namedTrails, (it) => {
        const locationInput = document.getElementById('location-input');
        if (locationInput) locationInput.value = `${it.ref ? it.ref + ' - ' : ''}${it.name || ''}`;
      });
    }
    (places || []).forEach(place => {
      const item = document.createElement('div');
      item.className = 'px-3.5 py-2.5 hover:bg-emerald-50 cursor-pointer transition border-b border-slate-100 last:border-b-0 flex items-start gap-3 text-left group';
      
      const isCap = place.isCapital || (place.typeLabel && place.typeLabel.includes('Capitale'));
      const isCity = place.isCity || (place.typeLabel && place.typeLabel.includes('Ville'));
      const isPeak = place.typeLabel && (place.typeLabel.includes('Sommet') || place.typeLabel.includes('Massif'));

      const badgeColor = place.isAddress 
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : isCap
        ? 'bg-purple-100 text-purple-800 border-purple-200 font-bold'
        : isCity
        ? 'bg-sky-100 text-sky-800 border-sky-200'
        : isPeak
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold'
        : 'bg-slate-100 text-slate-700 border-slate-200';

      item.innerHTML = `
        <span class="text-base select-none mt-0.5 group-hover:scale-110 transition-transform">${place.icon || '📍'}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-xs sm:text-sm text-slate-800 truncate group-hover:text-emerald-700">${this.escapeHtml(place.title)}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full border ${badgeColor} select-none whitespace-nowrap">${place.typeLabel || 'Lieu'}</span>
          </div>
          ${place.subtitle ? `<div class="text-[11px] text-slate-500 truncate mt-0.5">${this.escapeHtml(place.subtitle)}</div>` : ''}
        </div>
      `;
      
      item.addEventListener('click', () => {
        this.applySelectedPlace(place.lat, place.lon, place.displayName || place.title, place.isAddress);
      });
      resultsContainer.appendChild(item);
    });
  }

  async searchPlaces(query) {
    if (this.placesAbortController) {
      this.placesAbortController.abort();
    }
    this.placesAbortController = new AbortController();
    const signal = this.placesAbortController.signal;

    const iconEl = document.getElementById('location-search-icon');
    if (iconEl) iconEl.innerHTML = '<span class="animate-spin inline-block">⏳</span>';

    try {
      // 1. Afficher d'abord immédiatement les lieux locaux si correspondance (0 ms)
      const localMatches = this.getLocalPlaceMatches(query);
      if (localMatches.length > 0) {
        this.renderPlacesResults(localMatches, query);
      }

      // 2. Recherche mondiale (Open-Meteo + BAN + Photon) + Sentiers réputés (Francigena, WHW, Stevenson...)
      const namedPromise = (typeof GrManager !== 'undefined' && GrManager.searchNamedTrails && query.trim().length >= 3)
        ? GrManager.searchNamedTrails(query).catch(() => [])
        : Promise.resolve([]);
      const [places, namedTrails] = await Promise.all([
        this.fetchPlacesList(query, signal),
        namedPromise
      ]);
      this._lastNamedTrails = namedTrails || [];
      
      // Fusionner avec les suggestions locales si pertinentes
      const combined = [...places];
      (localMatches || []).forEach(local => {
        const exists = combined.some(c => 
          (c.title && c.title.toLowerCase() === local.title.toLowerCase()) ||
          (Math.abs(c.lat - local.lat) < 0.05 && Math.abs(c.lon - local.lon) < 0.05)
        );
        if (!exists) {
          if (local.title.toLowerCase() === query.toLowerCase().trim()) {
            combined.unshift(local);
          } else {
            combined.push(local);
          }
        }
      });

      this.renderPlacesResults(combined, query);
    } catch (e) {
      if (e.name !== 'AbortError') console.warn("Erreur recherche lieu mondial :", e);
    } finally {
      if (iconEl) iconEl.textContent = '📍';
    }
  }

  applySelectedPlace(lat, lon, label, isAddress = false) {
    const locationInput = document.getElementById('location-input');
    const resultsContainer = document.getElementById('location-autocomplete-results');
    if (locationInput) locationInput.value = label;
    if (resultsContainer) resultsContainer.classList.add('hidden');
    if (window.MapManagerInstance) {
      window.MapManagerInstance.setSearchOrigin(lat, lon, label, false);
    }
    this.applyFiltersAndRender(false);
    
    // Zoom sur le lieu : niveau rue pour une adresse (16), niveau ville sinon (12)
    const zoom = (isAddress || /\d/.test(label || '')) ? 16 : 12;
    const zoomToPlace = () => {
      const m = window.MapManagerInstance && window.MapManagerInstance.map;
      if (m) m.setView([lat, lon], zoom);
    };
    zoomToPlace();
    setTimeout(zoomToPlace, 150);
  }

  async searchAndSelectFirstPlace(query) {
    const iconEl = document.getElementById('location-search-icon');
    if (iconEl) iconEl.innerHTML = '<span class="animate-spin inline-block">⏳</span>';
    try {
      if (typeof GrManager !== 'undefined' && (GrManager.isGrQuery(query) || (GrManager.isNamedTrailQuery && GrManager.isNamedTrailQuery(query)))) {
        const trails = GrManager.isGrQuery(query) ? await GrManager.searchRemote(query) : await GrManager.searchNamedTrails(query);
        if (trails && trails.length > 0) {
          const resultsContainer = document.getElementById('location-autocomplete-results');
          if (resultsContainer) resultsContainer.classList.add('hidden');
          await GrManager.displayRemote(trails[0], window.MapManagerInstance ? window.MapManagerInstance.map : null);
          return;
        }
      }
      const places = await this.fetchPlacesList(query);
      if (places && places.length > 0) {
        const p = places[0];
        this.applySelectedPlace(p.lat, p.lon, p.displayName || p.title, p.isAddress);
        this.showToast(`Point de référence défini : ${p.displayName || p.title}`, "success");
      } else {
        this.showToast(`Aucun lieu mondial trouvé pour "${query}"`, "error");
      }
    } finally {
      if (iconEl) iconEl.textContent = '📍';
    }
  }

  useCurrentLocation() {
    if (!navigator.geolocation) {
      this.showToast("La géolocalisation n'est pas supportée par votre navigateur", "error");
      return;
    }

    this.showToast("Recherche de votre position GPS...", "info");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const placeName = await GPXParser.reverseGeocode(lat, lon);
        const locInput = document.getElementById('location-input');
        if (locInput) locInput.value = placeName || 'Ma position';

        // Si le rayon était en mode "Monde entier" (>= 2500 km), rétablir le rayon local par défaut (100 km)
        if (window.MapManagerInstance && window.MapManagerInstance.searchRadiusKm >= 2500) {
          this.setRadiusStep(this.getStepIndexForKm(100), false);
        }

        if (window.MapManagerInstance) {
          window.MapManagerInstance.setSearchOrigin(lat, lon, placeName || 'Ma position', false);
        }

        this.applyFiltersAndRender(false);

        // Afficher immédiatement le lieu où on se trouve avec le zoom maximal
        if (window.MapManagerInstance) {
          window.MapManagerInstance.zoomToLocation(lat, lon);
          setTimeout(() => {
            if (window.MapManagerInstance) {
              window.MapManagerInstance.zoomToLocation(lat, lon);
            }
          }, 150);
        }

        this.showToast(`Position trouvée : ${placeName || 'Ma position'}`, "success");
      },
      (err) => {
        console.warn("Erreur géolocalisation GPS :", err);
        this.showToast("Impossible d'accéder à votre position GPS.", "error");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  handleOriginChange(origin) {
    const locInput = document.getElementById('location-input');
    if (locInput) locInput.value = origin.name;
    this.applyFiltersAndRender();
  }

  async handlePickFolder() {
    try {
      const res = await StorageManager.pickLocalDirectory();
      if (res && res.success) {
        this.allHikes = await StorageManager.getAllHikes();
        this.updateStorageBadge();
        this.applyFiltersAndRender();
        this.renderManagementList();
        this.showToast(`Dossier connecté : ${res.folderName} (${res.hikes.length} randonnées)`, "success");
      }
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  /**
   * Bascule dynamique de la base de données active
   * (Randonneurs Sanaryens / Base JLDApps sanctuarisée)
   */
  async handleDatabaseChange(dbId) {
    if (dbId !== 'sanaryens' && dbId !== 'jldapps') {
      dbId = 'sanaryens';
    }

    this.showToast("Bascule de base de données en cours...", "info");

    try {
      await StorageManager.setActiveDatabase(dbId);

      // Si autoSync Supabase est configuré, tenter de rafraîchir en tâche de fond pour cette base
      try {
        const supaUrl = (document.getElementById('supabase-url')?.value || localStorage.getItem('sanary_supabase_url') || (window.APP_CONFIG && window.APP_CONFIG.supabaseUrl) || '').trim();
        const supaKey = (document.getElementById('supabase-key')?.value || localStorage.getItem('sanary_supabase_key') || (window.APP_CONFIG && window.APP_CONFIG.supabaseKey) || '').trim();
        const supaAutoSync = localStorage.getItem('sanary_supabase_autosync') !== 'false';
        if (supaAutoSync && supaUrl && supaKey) {
          await StorageManager.fetchFromSupabase(supaUrl, supaKey, dbId);
        }
      } catch (syncErr) {
        console.warn("Sync background au changement de base :", syncErr);
      }

      this.allHikes = await StorageManager.getAllHikes();

      // Désélectionner toute randonnée affichée
      this.deselectHike();

      // Nettoyer les marqueurs de la carte
      try {
        if (window.MapManagerInstance) {
          if (typeof window.MapManagerInstance.clearMarkers === 'function') {
            window.MapManagerInstance.clearMarkers();
          } else if (window.MapManagerInstance.markersLayer) {
            window.MapManagerInstance.markersLayer.clearLayers();
          }
        }
      } catch (mapErr) {
        console.warn("Nettoyage marqueurs :", mapErr);
      }

      // Réactualiser tous les affichages
      this.applyPermissionGuards();
      this.applyFiltersAndRender();
      this.renderManagementList();
      this.updateDatabaseStatusUI();

      if (dbId === 'sanaryens') {
        this.showToast(`🌿 Base Randonneurs Sanaryens active (${this.allHikes.length} rando${this.allHikes.length > 1 ? 's' : ''})`, "success");
      } else {
        const isAdmin = typeof AuthManager !== 'undefined' && AuthManager.isAdmin();
        if (isAdmin) {
          this.showToast(`👑 Base JLDApps active (${this.allHikes.length} randos) — Mode Admin : Pleins droits actifs`, "success");
        } else {
          this.showToast(`🔒 Base JLDApps active (${this.allHikes.length} randonnées sanctuarisées en lecture seule)`, "info");
        }
      }
    } catch (err) {
      console.error("Erreur bascule base :", err);
      this.showToast(`Erreur lors de la bascule : ${err.message}`, "error");
    }
  }

  /**
   * Mise à jour de l'ensemble des indicateurs de base de données dans l'interface
   */
  updateDatabaseStatusUI() {
    const activeDbId = StorageManager.getActiveDatabaseId();
    const isSanctuary = StorageManager.isCurrentDatabaseSanctuary();
    const isWriteProtected = StorageManager.isWriteProtected();
    const isAdmin = typeof AuthManager !== 'undefined' && AuthManager.isAdmin();
    const counts = StorageManager.getDatabaseCounts();

    // 1. Synchroniser toutes les listes déroulantes de choix de base
    ['header-db-selector', 'admin-db-selector', 'settings-db-selector'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = activeDbId;
    });

    // 2. Mettre à jour les badges de comptage dans le modal admin
    const sanaryCountEl = document.getElementById('count-db-sanaryens');
    if (sanaryCountEl) {
      sanaryCountEl.textContent = `${counts.sanaryens} rando${counts.sanaryens > 1 ? 's' : ''}`;
    }

    const jldCountEl = document.getElementById('count-db-jldapps');
    if (jldCountEl) {
      jldCountEl.textContent = `${counts.jldapps} rando${counts.jldapps > 1 ? 's' : ''}`;
    }

    // 3. Mettre à jour les styles des cartes dans le modal admin
    const cardSanary = document.getElementById('card-db-sanaryens');
    const badgeSanary = document.getElementById('badge-status-sanaryens');
    const cardJld = document.getElementById('card-db-jldapps');
    const badgeJld = document.getElementById('badge-status-jldapps');

    if (activeDbId === 'sanaryens') {
      if (cardSanary) {
        cardSanary.className = 'p-3.5 rounded-xl border-2 border-emerald-400 bg-emerald-950/60 shadow-md space-y-2 transition ring-2 ring-emerald-500/30';
      }
      if (badgeSanary) {
        badgeSanary.textContent = 'Active 🌿';
        badgeSanary.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950';
      }
      if (cardJld) {
        cardJld.className = 'p-3.5 rounded-xl border border-slate-700 bg-slate-900/50 space-y-2 opacity-80 hover:opacity-100 transition';
      }
      if (badgeJld) {
        badgeJld.textContent = isAdmin ? 'Sanctuarisée (Accès Admin) 👑' : 'Sanctuarisée 🔒';
        badgeJld.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40';
      }
    } else {
      if (cardSanary) {
        cardSanary.className = 'p-3.5 rounded-xl border border-slate-700 bg-slate-900/50 space-y-2 opacity-80 hover:opacity-100 transition';
      }
      if (badgeSanary) {
        badgeSanary.textContent = 'En attente';
        badgeSanary.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300';
      }
      if (cardJld) {
        cardJld.className = isAdmin
          ? 'p-3.5 rounded-xl border-2 border-emerald-400 bg-emerald-950/40 shadow-md space-y-2 transition ring-2 ring-emerald-500/30'
          : 'p-3.5 rounded-xl border-2 border-amber-400 bg-amber-950/40 shadow-md space-y-2 transition ring-2 ring-amber-500/30';
      }
      if (badgeJld) {
        badgeJld.textContent = isAdmin ? 'Active (Admin : Pleins droits) 👑' : 'Active (Sanctuarisée) 🔒';
        badgeJld.className = isAdmin
          ? 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950'
          : 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950';
      }
    }

    // 4. Bannières d'avertissement dans l'upload et la gestion
    const uploadBanner = document.getElementById('sanctuary-upload-banner');
    if (uploadBanner) {
      if (isSanctuary) {
        uploadBanner.classList.remove('hidden');
        if (isAdmin) {
          uploadBanner.className = 'p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-emerald-950 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in';
          uploadBanner.innerHTML = `
            <div class="flex items-start sm:items-center gap-3">
              <span class="text-2xl flex-shrink-0">👑</span>
              <div>
                <div class="font-bold text-xs sm:text-sm text-emerald-900">Base JLDApps — Mode Administrateur (Droits d'écriture complets)</div>
                <div class="text-[11px] sm:text-xs text-emerald-800 mt-0.5">Vous êtes connecté en tant qu'administrateur : vous pouvez importer de nouveaux parcours GPX sur la base JLDApps.</div>
              </div>
            </div>
            <button type="button" onclick="App.handleDatabaseChange('sanaryens')" class="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex-shrink-0 shadow-sm">
              🌿 Basculer sur Sanaryens
            </button>
          `;
        } else {
          uploadBanner.className = 'p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in';
          uploadBanner.innerHTML = `
            <div class="flex items-start sm:items-center gap-3">
              <span class="text-2xl flex-shrink-0">🔒</span>
              <div>
                <div class="font-bold text-xs sm:text-sm">Base JLDApps sanctuarisée (Lecture seule)</div>
                <div class="text-[11px] sm:text-xs text-amber-800 mt-0.5">L'importation de nouveaux fichiers GPX est verrouillée pour protéger l'historique des 139 randonnées. Seul l'administrateur peut y apporter des modifications.</div>
              </div>
            </div>
            <button type="button" onclick="App.handleDatabaseChange('sanaryens')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex-shrink-0 shadow-sm">
              🌿 Basculer sur Randonneurs Sanaryens
            </button>
          `;
        }
      } else {
        uploadBanner.classList.add('hidden');
      }
    }

    const manageBanner = document.getElementById('sanctuary-manage-banner');
    if (manageBanner) {
      if (isSanctuary) {
        manageBanner.classList.remove('hidden');
        if (isAdmin) {
          manageBanner.className = 'p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-emerald-950 shadow-sm flex items-start sm:items-center gap-3 animate-in fade-in';
          manageBanner.innerHTML = `
            <span class="text-2xl flex-shrink-0">👑</span>
            <div>
              <div class="font-bold text-xs sm:text-sm text-emerald-900">Base JLDApps — Mode Administrateur (Droits de gestion complets)</div>
              <div class="text-[11px] sm:text-xs text-emerald-800 mt-0.5">En tant qu'administrateur, vous avez accès à tous les droits d'édition (nom, notes) et de suppression sur la base JLDApps.</div>
            </div>
          `;
        } else {
          manageBanner.className = 'p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 shadow-sm flex items-start sm:items-center gap-3 animate-in fade-in';
          manageBanner.innerHTML = `
            <span class="text-2xl flex-shrink-0">🔒</span>
            <div>
              <div class="font-bold text-xs sm:text-sm">Base JLDApps sanctuarisée (Consultation seule)</div>
              <div class="text-[11px] sm:text-xs text-amber-800 mt-0.5">La modification et la suppression de parcours sont réservées à l'administrateur pour protéger l'intégrité de l'historique des 139 randonnées.</div>
            </div>
          `;
        }
      } else {
        manageBanner.classList.add('hidden');
      }
    }

    // 5. Description dans l'onglet options
    const settingsDesc = document.getElementById('settings-db-description');
    if (settingsDesc) {
      if (activeDbId === 'sanaryens') {
        settingsDesc.innerHTML = `<span class="font-bold text-emerald-700">🌿 Base active : Randonneurs Sanaryens</span> (${counts.sanaryens} randonnée${counts.sanaryens > 1 ? 's' : ''} enregistrée${counts.sanaryens > 1 ? 's' : ''}). Les ajouts de traces GPX et les modifications de parcours sont autorisés.`;
      } else {
        if (isAdmin) {
          settingsDesc.innerHTML = `<span class="font-bold text-amber-700">🔒 Base active : Base JLDApps</span> (${counts.jldapps} randonnées). <span class="text-emerald-700 font-semibold">Mode Administrateur actif : vous disposez de tous les droits d'écriture et de gestion.</span>`;
        } else {
          settingsDesc.innerHTML = `<span class="font-bold text-amber-700">🔒 Base active : Base JLDApps</span> (${counts.jldapps} randonnées). Cette base historique est protégée en lecture seule pour préserver les 139 circuits. Seul l'administrateur peut y apporter des modifications.`;
        }
      }
    }

    // 6. Actualiser le badge de stockage
    this.updateStorageBadge();
  }

  updateStorageBadge() {
    const badge = document.getElementById('storage-badge');
    if (!badge) return;

    if (StorageManager.currentMode === 'filesystem' && StorageManager.dirHandle) {
      badge.innerHTML = `
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="font-bold text-xs text-emerald-300">📁 Disque : ${StorageManager.dirHandle.name}</span>
      `;
      badge.className = "flex items-center gap-2 px-3 py-1.5 bg-emerald-950/80 border border-emerald-500/50 rounded-full text-emerald-300 text-xs cursor-pointer hover:brightness-125 transition shadow-sm";
      badge.title = "Dossier local connecté sur votre disque dur. Cliquez pour modifier ou gérer.";
    } else {
      badge.innerHTML = `
        <span class="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
        <span class="font-semibold text-xs text-slate-200">💾 Stockage Interne</span>
      `;
      badge.className = "flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-300 text-xs cursor-pointer transition shadow-sm";
      badge.title = "Stockage sécurisé dans le navigateur. Cliquez pour choisir un dossier sur votre disque dur.";
    }
  }

  /**
   * Helper to read file as text with encoding fallbacks (UTF-8, ISO-8859-1, Windows-1252)
   */
  async readFileAsText(file) {
    let text = '';
    try {
      text = await file.text();
    } catch (e) {
      text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsText(file, 'utf-8');
      });
    }

    // If text contains ISO-8859-1/Windows-1252 declaration or replacement characters, re-read with iso-8859-1
    if (text && (
      text.includes('encoding="ISO-8859-1"') || 
      text.includes('encoding="windows-1252"') || 
      text.includes('encoding="iso-8859-1"') ||
      text.includes('encoding="latin1"') ||
      text.includes('\uFFFD')
    )) {
      try {
        const isoText = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(err);
          reader.readAsText(file, 'iso-8859-1');
        });
        if (isoText && !isoText.includes('\uFFFD')) {
          return isoText;
        }
      } catch (e) {}
    }

    return text;
  }

  /**
   * Détection de doublon / randonnée aux caractéristiques similaires
   */
  findSimilarHike(newHike, candidateList = null) {
    if (!newHike) return null;
    const candidates = candidateList || this.allHikes || [];
    if (candidates.length === 0) return null;

    const norm = (s) => (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .trim();

    const nameNew = norm(newHike.name);

    for (const existing of candidates) {
      if (existing.id === newHike.id) continue;

      const nameExist = norm(existing.name);
      const isExactName = (nameNew && nameExist && nameNew === nameExist);

      let distStartKm = Infinity;
      if (newHike.startPoint && existing.startPoint) {
        distStartKm = GPXParser.haversineDistance(
          newHike.startPoint.lat, newHike.startPoint.lon,
          existing.startPoint.lat, existing.startPoint.lon
        );
      }

      const d1 = newHike.distanceKm || 0;
      const d2 = existing.distanceKm || 0;
      const diffDistKm = Math.abs(d1 - d2);
      const maxDist = Math.max(d1, d2, 1);
      const distPct = diffDistKm / maxDist;

      const ele1 = newHike.elevationGain || 0;
      const ele2 = existing.elevationGain || 0;
      const diffDPlus = Math.abs(ele1 - ele2);
      const maxEle = Math.max(ele1, ele2, 1);
      const dplusPct = diffDPlus / maxEle;

      // 1. Même lieu de départ (< 400 m) ET distance quasi identique (< 0.5 km ou < 6%) ET D+ quasi identique (< 40 m ou < 10%)
      const sameGeoAndMetrics = (distStartKm <= 0.4) && (diffDistKm <= 0.5 || distPct <= 0.06) && (diffDPlus <= 40 || dplusPct <= 0.10);

      // 2. Même nom exact ET (départ proche < 2 km OU distance proche < 1 km)
      const sameNameAndContext = isExactName && (distStartKm <= 2.0 || diffDistKm <= 1.0);

      // 3. Départ et Arrivée quasi identiques (< 250 m) avec distance identique (< 400 m)
      let distEndKm = Infinity;
      if (newHike.endPoint && existing.endPoint) {
        distEndKm = GPXParser.haversineDistance(
          newHike.endPoint.lat, newHike.endPoint.lon,
          existing.endPoint.lat, existing.endPoint.lon
        );
      }
      const sameTrackEnds = (distStartKm <= 0.25) && (distEndKm <= 0.25) && (diffDistKm <= 0.4);

      if (sameGeoAndMetrics || sameNameAndContext || sameTrackEnds) {
        let reason = "";
        if (sameGeoAndMetrics) {
          reason = `Même lieu de départ (à ${Math.round(distStartKm * 1000)} m), distance quasi identique (${d2} km vs ${d1} km) et dénivelé équivalent (+${ele2}m vs +${ele1}m).`;
        } else if (sameNameAndContext) {
          reason = `Nom identique (« ${existing.name} ») et caractéristiques géographiques très proches.`;
        } else {
          reason = `Mêmes points de départ/arrivée et longueur équivalente (${d2} km vs ${d1} km).`;
        }

        return {
          hike: existing,
          reason: reason,
          distStartMeters: Math.round(distStartKm * 1000),
          diffDistKm: Math.round(diffDistKm * 10) / 10,
          diffDPlus: diffDPlus
        };
      }
    }

    return null;
  }

  /**
   * Affiche la fenêtre modale de détection de doublon et attend le choix de l'utilisateur
   */
  askDuplicateDecision(newHike, existingHike, reason, fileName) {
    return new Promise((resolve) => {
      const modal = document.getElementById('duplicate-hike-modal');
      if (!modal) {
        const proceed = confirm(
          `⚠️ Une randonnée aux mêmes caractéristiques existe déjà dans la base :\n\n` +
          `• Randonnée existante : « ${existingHike.name} » (${existingHike.distanceKm} km, D+ ${existingHike.elevationGain}m)\n` +
          `• Nouvelle trace : « ${newHike.name} » (${newHike.distanceKm} km, D+ ${newHike.elevationGain}m)\n\n` +
          `${reason}\n\n` +
          `Souhaitez-vous quand même l'ajouter ?\n` +
          `• [OK] = Ajouter quand même\n• [Annuler] = Ignorer le doublon`
        );
        resolve(proceed ? 'add' : 'skip');
        return;
      }

      const reasonEl = document.getElementById('duplicate-modal-reason');
      if (reasonEl) reasonEl.textContent = reason;

      // Infos rando existante
      const existNameEl = document.getElementById('duplicate-exist-name');
      if (existNameEl) existNameEl.textContent = existingHike.name;

      const existDistEl = document.getElementById('duplicate-exist-dist');
      if (existDistEl) existDistEl.textContent = `${existingHike.distanceKm} km`;

      const existDplusEl = document.getElementById('duplicate-exist-dplus');
      if (existDplusEl) existDplusEl.textContent = `+${existingHike.elevationGain}m`;

      const existAuthorEl = document.getElementById('duplicate-exist-author');
      if (existAuthorEl) existAuthorEl.textContent = existingHike.ajoutee_par ? `Par ${existingHike.ajoutee_par}` : '';

      // Infos nouvelle trace
      const newNameEl = document.getElementById('duplicate-new-name');
      if (newNameEl) newNameEl.textContent = newHike.name;

      const newDistEl = document.getElementById('duplicate-new-dist');
      if (newDistEl) newDistEl.textContent = `${newHike.distanceKm} km`;

      const newDplusEl = document.getElementById('duplicate-new-dplus');
      if (newDplusEl) newDplusEl.textContent = `+${newHike.elevationGain}m`;

      const newFileEl = document.getElementById('duplicate-new-file');
      if (newFileEl) newFileEl.textContent = fileName || '';

      const btnSkip = document.getElementById('btn-duplicate-skip');
      const btnReplace = document.getElementById('btn-duplicate-replace');
      const btnAdd = document.getElementById('btn-duplicate-add');

      const cleanup = (choice) => {
        modal.classList.add('hidden');
        if (btnSkip) btnSkip.onclick = null;
        if (btnReplace) btnReplace.onclick = null;
        if (btnAdd) btnAdd.onclick = null;
        modal.onclick = null;
        resolve(choice);
      };

      if (btnSkip) btnSkip.onclick = () => cleanup('skip');
      if (btnReplace) btnReplace.onclick = () => cleanup('replace');
      if (btnAdd) btnAdd.onclick = () => cleanup('add');

      modal.onclick = (e) => {
        if (e.target === modal) cleanup('skip');
      };

      modal.classList.remove('hidden');
    });
  }

  /**
   * Handle Multi-file Upload (Instant Parse + Auto-Save + Auto-Radius Expansion)
   */
  async handleFilesUploaded(files) {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule pour les membres. Seul l'administrateur peut y charger des parcours.", "warning");
      return;
    }
    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_upload')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de charger des randonnées.", "error");
      return;
    }

    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    this.showToast(`Analyse de ${fileList.length} fichier(s)...`, "info");

    const origin = (window.MapManagerInstance && window.MapManagerInstance.searchOrigin) 
      ? window.MapManagerInstance.searchOrigin 
      : { lat: 43.1189, lon: 5.8033 };

    let maxDistFound = 0;
    const newHikes = [];
    const errors = [];
    let skippedCount = 0;

    for (const file of fileList) {
      try {
        const text = await this.readFileAsText(file);
        const hike = GPXParser.parse(text, file.name);
        const proposedName = await GPXParser.generateProposedName(hike);
        hike.name = proposedName;
        hike.proposedName = proposedName;
        const authorEl = document.getElementById('upload-author-name');
        const customAuthor = authorEl && authorEl.value ? authorEl.value.trim() : '';
        if (customAuthor) localStorage.setItem('rf_uploader_display_name', customAuthor);
        hike.ajoutee_par = customAuthor || localStorage.getItem('rf_uploader_display_name') || ((typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser()) ? AuthManager.getCurrentUser().username : 'admin');
        
        // Extraction de la date de derniere rando depuis le GPX si presente
        if (!hike.lastHikeDate && hike.points && hike.points.length > 0) {
          const ptWithTime = hike.points.find(p => p.time);
          if (ptWithTime && ptWithTime.time) {
            try {
              const d = new Date(ptWithTime.time);
              if (!isNaN(d.getTime())) {
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yy = String(d.getFullYear()).slice(-2);
                hike.lastHikeDate = `${dd}/${mm}/${yy}`;
              }
            } catch (e) {}
          }
        }

        // Détection de randonnée ayant les mêmes caractéristiques
        const duplicateMatch = this.findSimilarHike(hike);
        if (duplicateMatch) {
          const decision = await this.askDuplicateDecision(
            hike, 
            duplicateMatch.hike, 
            duplicateMatch.reason, 
            file.name
          );

          if (decision === 'skip') {
            skippedCount++;
            this.showToast(`Doublon ignoré : « ${file.name} »`, "info");
            continue;
          } else if (decision === 'replace') {
            hike.id = duplicateMatch.hike.id;
            if (!hike.name || hike.name === proposedName) {
              hike.name = duplicateMatch.hike.name;
            }
          } else if (decision === 'add') {
            if (hike.name === duplicateMatch.hike.name) {
              hike.name = `${hike.name} (Bis)`;
            }
          }
        }

        // Calcul IBP officiel via l'API ibpindex.com si possible
        try {
          const officialIbp = await GPXParser.fetchOfficialIBP(text, file.name);
          if (officialIbp !== null) {
            hike.ibp = officialIbp;
            const lvl = GPXParser.getIBPLevel(officialIbp);
            hike.ibpLevel = lvl.level;
            hike.difficulty = lvl.label;
            if (hike.notes && /\[IBP:\s*\d+\]/i.test(hike.notes)) {
              hike.notes = hike.notes.replace(/\[IBP:\s*\d+\]/i, `[IBP: ${officialIbp}]`);
            } else {
              hike.notes = `[IBP: ${officialIbp}] ${hike.notes || ''}`.trim();
            }
          }
        } catch (e) {
          console.warn("IBP API call error in upload:", e);
        }

        // Auto-save immediately to persistent storage
        await StorageManager.saveHike(hike, text);

        // Auto-push to Supabase Cloud in background if configured
        try {
          const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
          const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
          const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
          if (supaUrl && supaKey) {
            StorageManager.pushHikeToSupabase(hike, supaUrl, supaKey).catch(e => console.warn("Supabase auto-upload error:", e));
          }
        } catch (e) {}

        // Add to main collection
        const existingIdx = this.allHikes.findIndex(h => h.id === hike.id || (h.name && h.name === hike.name));
        if (existingIdx >= 0) {
          this.allHikes[existingIdx] = hike;
        } else {
          this.allHikes.unshift(hike);
        }

        if (hike.startPoint) {
          const dist = GPXParser.haversineDistance(origin.lat, origin.lon, hike.startPoint.lat, hike.startPoint.lon);
          if (dist > maxDistFound) maxDistFound = dist;
        }

        newHikes.push(hike);
      } catch (err) {
        console.error(`Erreur lecture ${file.name} :`, err);
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    if (newHikes.length === 0) {
      if (skippedCount > 0) {
        this.showToast(`Opération terminée : ${skippedCount} doublon(s) ignoré(s).`, "info");
      } else {
        const errorDetail = errors.length > 0 ? errors.join("\n") : "Format de fichier non reconnu.";
        this.showToast(`Échec du chargement : ${errorDetail}`, "error");
      }
      return;
    }

    // Auto expand radius if newly added hikes are outside current radius
    const currentRadius = window.MapManagerInstance ? window.MapManagerInstance.searchRadiusKm : 50;
    if (maxDistFound > currentRadius) {
      const stepIdx = this.getStepIndexForKm(maxDistFound);
      this.setRadiusStep(stepIdx, true);
    }

    // Automatically switch to Explorer view and select the first new hike!
    this.switchTab('explorer');
    this.applyFiltersAndRender();
    this.renderManagementList();

    if (newHikes.length > 0) {
      this.handleHikeSelect(newHikes[0]);
    }

    let toastMsg = (newHikes.length === 1) 
      ? `🎉 « ${newHikes[0].name} » ajoutée ! (${newHikes[0].distanceKm} km, +${newHikes[0].elevationGain}m, IBP : ${newHikes[0].ibp} - Niveau ${newHikes[0].ibpLevel})`
      : `🎉 ${newHikes.length} randonnée(s) ajoutée(s) avec calcul de l'Indice IBP Index !`;
    if (skippedCount > 0) {
      toastMsg += ` (${skippedCount} doublon(s) ignoré(s))`;
    }
    this.showToast(toastMsg, "success");
  }

  /**
   * Handle Direct GPX Text Paste
   */
  async handlePasteGPX() {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule pour les membres. Seul l'administrateur peut y coller des parcours.", "warning");
      return;
    }
    if (typeof AuthManager !== 'undefined' && !AuthManager.hasPermission('can_upload')) {
      this.showToast("Accès restreint : Vous n'avez pas l'autorisation de charger des randonnées.", "error");
      return;
    }

    const textarea = document.getElementById('paste-gpx-text');
    const nameInput = document.getElementById('paste-gpx-name');
    if (!textarea) return;

    const rawText = textarea.value.trim();
    if (!rawText) {
      this.showToast("Veuillez d'abord coller le texte de votre trace GPX.", "error");
      return;
    }

    const customName = nameInput ? nameInput.value.trim() : '';

    try {
      this.showToast("Analyse de la trace collée...", "info");
      const hike = GPXParser.parse(rawText, customName ? customName + '.gpx' : 'Randonnee_Collee.gpx');
      if (customName) {
        hike.name = GPXParser.ensureForeignCountryPrefix(
          customName,
          null,
          hike.startPoint ? hike.startPoint.lat : null,
          hike.startPoint ? hike.startPoint.lon : null
        );
      } else {
        const proposedName = await GPXParser.generateProposedName(hike);
        hike.name = proposedName;
        hike.proposedName = proposedName;
      }

      const authorEl = document.getElementById('upload-author-name');
      const customAuthor = authorEl && authorEl.value ? authorEl.value.trim() : '';
      if (customAuthor) localStorage.setItem('rf_uploader_display_name', customAuthor);
      hike.ajoutee_par = customAuthor || localStorage.getItem('rf_uploader_display_name') || ((typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser()) ? AuthManager.getCurrentUser().username : 'admin');

      // Détection de randonnée ayant les mêmes caractéristiques
      const duplicateMatch = this.findSimilarHike(hike);
      if (duplicateMatch) {
        const decision = await this.askDuplicateDecision(
          hike, 
          duplicateMatch.hike, 
          duplicateMatch.reason, 
          'Trace GPX collée'
        );

        if (decision === 'skip') {
          this.showToast("Importation annulée : doublon ignoré.", "info");
          return;
        } else if (decision === 'replace') {
          hike.id = duplicateMatch.hike.id;
          if (!customName) {
            hike.name = duplicateMatch.hike.name;
          }
        } else if (decision === 'add') {
          if (hike.name === duplicateMatch.hike.name) {
            hike.name = `${hike.name} (Bis)`;
          }
        }
      }

      // Calcul IBP officiel via l'API ibpindex.com si possible
      try {
        const officialIbp = await GPXParser.fetchOfficialIBP(rawText, (customName || 'trace') + '.gpx');
        if (officialIbp !== null) {
          hike.ibp = officialIbp;
          const lvl = GPXParser.getIBPLevel(officialIbp);
          hike.ibpLevel = lvl.level;
          hike.difficulty = lvl.label;
          if (hike.notes && /\[IBP:\s*\d+\]/i.test(hike.notes)) {
            hike.notes = hike.notes.replace(/\[IBP:\s*\d+\]/i, `[IBP: ${officialIbp}]`);
          } else {
            hike.notes = `[IBP: ${officialIbp}] ${hike.notes || ''}`.trim();
          }
        }
      } catch (e) {
        console.warn("IBP API call error in paste:", e);
      }

      await StorageManager.saveHike(hike, rawText);

      // Auto-push to Supabase Cloud in background if configured
      try {
        const cfg = (typeof window.APP_CONFIG !== 'undefined') ? window.APP_CONFIG : {};
        const supaUrl = localStorage.getItem('sanary_supabase_url') || cfg.supabaseUrl;
        const supaKey = localStorage.getItem('sanary_supabase_key') || cfg.supabaseKey;
        if (supaUrl && supaKey) {
          StorageManager.pushHikeToSupabase(hike, supaUrl, supaKey).catch(e => console.warn("Supabase auto-upload error:", e));
        }
      } catch (e) {}

      const existingIdx = this.allHikes.findIndex(h => h.id === hike.id || (h.name && h.name === hike.name));
      if (existingIdx >= 0) {
        this.allHikes[existingIdx] = hike;
      } else {
        this.allHikes.unshift(hike);
      }

      // Clear input
      textarea.value = '';
      if (nameInput) nameInput.value = '';

      // Auto expand radius if needed
      const origin = (window.MapManagerInstance && window.MapManagerInstance.searchOrigin) 
        ? window.MapManagerInstance.searchOrigin 
        : { lat: 43.1189, lon: 5.8033 };

      if (hike.startPoint) {
        const dist = GPXParser.haversineDistance(origin.lat, origin.lon, hike.startPoint.lat, hike.startPoint.lon);
        const currentRadius = window.MapManagerInstance ? window.MapManagerInstance.searchRadiusKm : 50;
        if (dist > currentRadius) {
          const stepIdx = this.getStepIndexForKm(dist);
          this.setRadiusStep(stepIdx, true);
        }
      }

      this.switchTab('explorer');
      this.applyFiltersAndRender();
      this.renderManagementList();
      this.handleHikeSelect(hike);

      this.showToast(`🎉 Randonnée « ${hike.name} » ajoutée avec succès !`, "success");
    } catch (err) {
      console.error("Erreur paste GPX :", err);
      this.showToast(`Erreur d'analyse : ${err.message}`, "error");
    }
  }

  // =========================================================================
  // MAP AREA PRINT MODAL (2-CLICK RECTANGLE EXTRACTION)
  // =========================================================================
  openMapAreaModal(bounds) {
    this.selectedAreaBounds = bounds;
    const modal = document.getElementById('map-area-modal');
    if (!modal) return;

    const minLat = bounds[0][0];
    const minLon = bounds[0][1];
    const maxLat = bounds[1][0];
    const maxLon = bounds[1][1];

    const dKmWidth = GPXParser.haversineDistance(minLat, minLon, minLat, maxLon);
    const dKmHeight = GPXParser.haversineDistance(minLat, minLon, maxLat, minLon);

    const infoEl = document.getElementById('modal-map-area-info');
    if (infoEl) {
      infoEl.textContent = `Zone sélectionnée : ~${dKmWidth.toFixed(1)} km × ${dKmHeight.toFixed(1)} km (2 clics)`;
    }

    // Déterminer la (ou les) trace(s) active(s) (jusqu'à 3 traces GPX libres ou randonnée club)
    const standaloneTracks = (window.MapManagerInstance && window.MapManagerInstance.standaloneTracks) || [];
    const activeHike = this.areaPrintHike || this.selectedHike || 
                       (window.MapManagerInstance && window.MapManagerInstance.selectedHike) || 
                       (window.MapManagerInstance && window.MapManagerInstance.standaloneHike) || null;

    // Remplir le sélecteur de tracé GPX (accessible et visible en permanence)
    const gpxSelect = document.getElementById('map-area-gpx-select');
    const titleEl = document.getElementById('map-area-title');

    if (gpxSelect) {
      gpxSelect.innerHTML = '<option value="">🚫 Aucun tracé (fond de carte vierge)</option>';

      // Si plusieurs traces GPX libres sont affichées (ex: 2 ou 3 traces simultanées)
      if (standaloneTracks.length > 1) {
        const optAll = document.createElement('option');
        optAll.value = '__all_standalone__';
        optAll.textContent = `📍 Toutes les traces affichées (${standaloneTracks.length} traces GPX simultanées)`;
        optAll.selected = true;
        gpxSelect.appendChild(optAll);

        standaloneTracks.forEach((trk, idx) => {
          const optTrk = document.createElement('option');
          optTrk.value = `__standalone_${trk.id || idx}__`;
          optTrk.textContent = `  ↳ Trace ${idx + 1} : ${trk.name} (${trk.distance || '?'} km)`;
          gpxSelect.appendChild(optTrk);
        });
      } else if (activeHike) {
        // Une seule trace active
        const optActive = document.createElement('option');
        optActive.value = String(activeHike.id);
        optActive.textContent = `📍 ${activeHike.name} (${activeHike.distance || activeHike.distanceKm || '?'} km)`;
        optActive.selected = true;
        gpxSelect.appendChild(optActive);
      }

      // En mode Randonner uniquement (protégé), lister les autres randonnées du club
      const isRandoMode = window.location.hash.startsWith('#randonner');
      if (isRandoMode) {
        const hikesList = (this.allHikes && this.allHikes.length > 0) ? this.allHikes : (this.hikes || []);
        const sortedHikes = [...hikesList].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        sortedHikes.forEach(h => {
          if (activeHike && String(h.id) === String(activeHike.id)) return;
          const opt = document.createElement('option');
          opt.value = h.id;
          opt.textContent = `📍 ${h.name} (${h.distanceKm ? h.distanceKm + ' km' : 'GPX'})`;
          gpxSelect.appendChild(opt);
        });
      }

      // Adapter automatiquement le titre en cas de changement de sélection
      gpxSelect.onchange = () => {
        const selectedId = gpxSelect.value;
        if (titleEl) {
          if (selectedId === '__all_standalone__') {
            titleEl.value = standaloneTracks.map(t => t.name).join(' • ') + ' - Extrait de carte';
          } else if (selectedId && selectedId.startsWith('__standalone_')) {
            const trkId = selectedId.replace('__standalone_', '').replace(/__$/, '');
            const chosenTrk = standaloneTracks.find((t, i) => String(t.id) === trkId || String(i) === trkId);
            titleEl.value = chosenTrk ? `${chosenTrk.name} - Extrait de carte` : `Extrait Cartographique`;
          } else if (activeHike && String(activeHike.id) === String(selectedId)) {
            titleEl.value = `${activeHike.name} - Extrait de carte`;
          } else {
            const hikesList = (this.allHikes && this.allHikes.length > 0) ? this.allHikes : (this.hikes || []);
            const chosen = hikesList.find(h => String(h.id) === String(selectedId));
            if (chosen) {
              titleEl.value = `${chosen.name} - Extrait de carte`;
            } else {
              titleEl.value = `Extrait Cartographique (${dKmWidth.toFixed(1)} × ${dKmHeight.toFixed(1)} km)`;
            }
          }
        }
      };
    }

    // Default title
    if (titleEl) {
      if (standaloneTracks.length > 1) {
        titleEl.value = standaloneTracks.map(t => t.name).join(' • ') + ' - Extrait de carte';
      } else if (activeHike) {
        titleEl.value = `${activeHike.name} - Extrait de carte`;
      } else {
        titleEl.value = `Extrait Cartographique (${dKmWidth.toFixed(1)} × ${dKmHeight.toFixed(1)} km)`;
      }
    }

    // Default layer matching currently active map layer
    const layerSelect = document.getElementById('map-area-layer');
    if (layerSelect && window.MapManagerInstance) {
      layerSelect.value = window.MapManagerInstance.getCurrentBaseLayerKey();
    }

    // Gestion de l'échelle vraie physique (1/XXXXXX)
    const formatEl = document.getElementById('map-area-format');
    const orientEl = document.getElementById('map-area-orientation');
    const scaleModeEl = document.getElementById('map-area-scale-mode');
    const scaleDenomEl = document.getElementById('map-area-scale-denom');
    const scalePreviewEl = document.getElementById('map-area-scale-preview');
    const scaleInputBox = document.getElementById('box-map-area-scale-input');
    const scalePresetsBox = document.getElementById('map-area-scale-presets');

    const updateScalePreview = () => {
      const fmt = (formatEl ? formatEl.value : 'a4').toLowerCase();
      const ori = (orientEl ? orientEl.value : 'landscape').toLowerCase();
      const mode = scaleModeEl ? scaleModeEl.value : 'fit';
      const denom = parseInt(scaleDenomEl ? scaleDenomEl.value : '25000', 10) || 25000;

      const pageDims = {
        a4: { w: 297, h: 210 },
        a3: { w: 420, h: 297 }
      };
      const dims = pageDims[fmt] || pageDims.a4;
      const sheetW = ori === 'landscape' ? Math.max(dims.w, dims.h) : Math.min(dims.w, dims.h);
      const sheetH = ori === 'landscape' ? Math.min(dims.w, dims.h) : Math.max(dims.w, dims.h);

      const marginX = 12;
      const marginY = 12;
      const topBannerH = 14;
      const botLegendH = 12;
      const mapBoxW_mm = sheetW - (2 * marginX);
      const mapBoxH_mm = sheetH - marginY - topBannerH - botLegendH - marginY;

      if (scaleInputBox) scaleInputBox.style.display = (mode === 'custom') ? 'block' : 'none';
      if (scalePresetsBox) scalePresetsBox.style.display = (mode === 'custom') ? 'flex' : 'none';

      if (scalePreviewEl) {
        if (mode === 'fit') {
          scalePreviewEl.innerHTML = `Mode <strong>Cadrage exact</strong> : la zone sélectionnée (~${dKmWidth.toFixed(1)} × ${dKmHeight.toFixed(1)} km) occupera 100% de la feuille ${fmt.toUpperCase()}.`;
        } else {
          const mapBoxW_m = (mapBoxW_mm / 1000) * denom;
          const mapBoxH_m = (mapBoxH_mm / 1000) * denom;
          const mapBoxW_km = mapBoxW_m / 1000;
          const mapBoxH_km = mapBoxH_m / 1000;
          const denomFmt = denom.toLocaleString('fr-FR');
          scalePreviewEl.innerHTML = `Échelle <strong>1 : ${denomFmt}</strong> sur ${fmt.toUpperCase()} (${mapBoxW_mm} × ${Math.round(mapBoxH_mm)} mm utiles) : cadre de <strong>~${mapBoxW_km.toFixed(2)} km × ${mapBoxH_km.toFixed(2)} km</strong> centré sur votre sélection (1 cm papier = ${denom < 100000 ? Math.round(denom / 100) + ' m' : (denom / 100000).toFixed(1) + ' km'} terrain).`;
        }
      }
    };

    if (formatEl) formatEl.onchange = updateScalePreview;
    if (orientEl) orientEl.onchange = updateScalePreview;
    if (scaleModeEl) scaleModeEl.onchange = updateScalePreview;
    if (scaleDenomEl) scaleDenomEl.oninput = updateScalePreview;

    const presetBtns = document.querySelectorAll('.btn-scale-preset');
    presetBtns.forEach(btn => {
      btn.onclick = () => {
        const sc = btn.dataset.scale;
        if (sc && scaleDenomEl) {
          scaleDenomEl.value = sc;
          presetBtns.forEach(b => {
            b.classList.remove('bg-emerald-600', 'text-white');
            b.classList.add('bg-white', 'text-slate-700', 'border', 'border-slate-300');
          });
          btn.classList.remove('bg-white', 'text-slate-700', 'border', 'border-slate-300');
          btn.classList.add('bg-emerald-600', 'text-white');
          updateScalePreview();
        }
      };
    });

    updateScalePreview();

    modal.classList.remove('hidden');
  }

  closeMapAreaModal() {
    const modal = document.getElementById('map-area-modal');
    if (modal) modal.classList.add('hidden');
    if (window.MapManagerInstance) {
      window.MapManagerInstance.clearAreaSelectionVisuals();
    }
  }

  async executeMapAreaDownload() {
    if (!this.selectedAreaBounds) return;

    const formatEl = document.getElementById('map-area-format');
    const format = formatEl ? formatEl.value : 'a4';
    const orientationEl = document.getElementById('map-area-orientation');
    const orientation = orientationEl ? orientationEl.value : 'landscape';
    const layerEl = document.getElementById('map-area-layer');
    const mapLayer = layerEl ? layerEl.value : 'igntop25';
    const titleEl = document.getElementById('map-area-title');
    const title = titleEl && titleEl.value.trim() ? titleEl.value.trim() : 'EXTRAIT DE CARTE TOPOGRAPHIQUE';
    const showCoordsEl = document.getElementById('map-area-opt-coords');
    const showCoords = showCoordsEl ? showCoordsEl.checked : true;
    const trackColorEl = document.getElementById('map-area-track-color');
    const trackColor = trackColorEl ? trackColorEl.value : '#1d4ed8';

    // Récupérer le tracé ou multi-tracés choisis dans le sélecteur GPX
    const gpxSelect = document.getElementById('map-area-gpx-select');
    const selectedHikeId = gpxSelect ? gpxSelect.value : '';
    let hikeForTrack = null;
    let tracksForExport = null;

    const standaloneTracks = (window.MapManagerInstance && window.MapManagerInstance.standaloneTracks) || [];

    if (selectedHikeId === '__all_standalone__') {
      tracksForExport = standaloneTracks;
    } else if (selectedHikeId && selectedHikeId.startsWith('__standalone_')) {
      const trkId = selectedHikeId.replace('__standalone_', '').replace(/__$/, '');
      hikeForTrack = standaloneTracks.find((t, i) => String(t.id) === trkId || String(i) === trkId) || null;
    } else if (selectedHikeId) {
      if (this.areaPrintHike && String(this.areaPrintHike.id) === String(selectedHikeId)) {
        hikeForTrack = this.areaPrintHike;
      } else if (window.MapManagerInstance && window.MapManagerInstance.standaloneHike && String(window.MapManagerInstance.standaloneHike.id) === String(selectedHikeId)) {
        hikeForTrack = window.MapManagerInstance.standaloneHike;
      } else {
        const hikesList = (this.allHikes && this.allHikes.length > 0) ? this.allHikes : (this.hikes || []);
        hikeForTrack = hikesList.find(h => String(h.id) === String(selectedHikeId)) || null;
      }
    } else if (standaloneTracks.length > 1 && (!selectedHikeId || selectedHikeId === '')) {
      // Choix explicite : aucun tracé
      tracksForExport = null;
      hikeForTrack = null;
    }

    this.closeMapAreaModal();

    this.showToast("Génération de l'extrait de carte en haute définition...", "info");
    try {
      if (hikeForTrack && typeof StorageManager !== 'undefined') {
        try { await StorageManager.ensureHikeTrackLoaded(hikeForTrack); } catch (e) {}
      }
      const showUtm = document.getElementById('map-area-opt-utm') ? document.getElementById('map-area-opt-utm').checked : true;
      const scaleModeEl = document.getElementById('map-area-scale-mode');
      const scaleMode = scaleModeEl ? scaleModeEl.value : 'fit';
      const scaleDenomEl = document.getElementById('map-area-scale-denom');
      const scaleDenom = scaleDenomEl ? (parseInt(scaleDenomEl.value, 10) || 25000) : 25000;

      await PDFExporter.exportMapAreaPDF(this.selectedAreaBounds, {
        title: title,
        format: format,
        orientation: orientation,
        mapLayer: mapLayer,
        showCoords: showCoords,
        showUtmGrid: showUtm,
        scaleMode: scaleMode,
        scaleDenom: scaleDenom,
        trackColor: trackColor,
        hike: hikeForTrack,
        tracks: tracksForExport,
        bearings: (window.MapManagerInstance && window.MapManagerInstance.bearingMeasurements) ? window.MapManagerInstance.bearingMeasurements : []
      });
      let trackNotice = ' (fond vierge)';
      if (tracksForExport && tracksForExport.length > 0) {
        trackNotice = ` avec ${tracksForExport.length} tracés GPX`;
      } else if (hikeForTrack) {
        trackNotice = ` avec tracé « ${hikeForTrack.name} »`;
      }
      this.showToast(`Extrait de carte (${format.toUpperCase()} ${orientation === 'landscape' ? 'Paysage' : 'Portrait'})${trackNotice} téléchargé !`, "success");
    } catch (err) {
      console.error("Erreur export carte zone :", err);
      this.showToast("Erreur lors de la génération de la carte PDF", "error");
    }
  }

  

    // =========================================================================
  // MAP LEGEND MODAL (IGN TOP 25 / OPENTOPOMAP / OSM / SATELLITE & GPX)
  // =========================================================================
  handleBaseLayerChange(layerKey) {
    const btnLegend = document.getElementById('btn-map-legend');
    const btnLegendText = document.getElementById('btn-map-legend-text');
    if (!btnLegend) return;

    if (layerKey === 'satellite') {
      btnLegend.title = "Consulter la légende des circuits GPX et repères (Vue Satellite)";
      if (btnLegendText) btnLegendText.textContent = "Légende GPX";
    } else {
      btnLegend.title = "Consulter la légende des cartes (IGN Top 25, sentiers, symboles)";
      if (btnLegendText) btnLegendText.textContent = "Légende";
    }
  }

  openMapLegendModal(requestedTab = null) {
    const modal = document.getElementById('map-legend-modal');
    if (!modal) return;

    const currentLayer = (window.MapManagerInstance && typeof window.MapManagerInstance.getCurrentBaseLayerKey === 'function')
      ? window.MapManagerInstance.getCurrentBaseLayerKey()
      : 'igntop25';

    let tab = requestedTab;
    if (!tab) {
      if (currentLayer === 'satellite') {
        tab = 'satellite';
      } else if (currentLayer === 'opentopo') {
        tab = 'opentopo';
      } else if (currentLayer === 'osmfr') {
        tab = 'osm';
      } else {
        tab = 'ign';
      }
    }

    const titleEl = document.getElementById('map-legend-modal-title');
    const subEl = document.getElementById('map-legend-modal-subtitle');
    const tabsBar = document.getElementById('map-legend-tabs-bar');

    if (tab === 'satellite' && currentLayer === 'satellite') {
      if (titleEl) titleEl.textContent = 'Légende des Circuits GPX & Repères (Vue Satellite)';
      if (subEl) subEl.textContent = 'Niveaux de difficulté, codes couleur des tracés et repérage sur photo aérienne';
      // En mode satellite : afficher uniquement la légende GPX (masquer la barre des onglets topo)
      if (tabsBar) tabsBar.classList.add('hidden');
    } else {
      if (titleEl) titleEl.textContent = 'Légende des Cartes Topographiques';
      if (subEl) subEl.textContent = 'Guide des sentiers balisés, courbes de niveau, falaises et symboles essentiels';
      if (tabsBar) tabsBar.classList.remove('hidden');
    }

    this.switchLegendTab(tab);
    modal.classList.remove('hidden');
  }

  showTopoTabsInSatelliteMode() {
    const tabsBar = document.getElementById('map-legend-tabs-bar');
    if (tabsBar) tabsBar.classList.remove('hidden');
    const titleEl = document.getElementById('map-legend-modal-title');
    const subEl = document.getElementById('map-legend-modal-subtitle');
    if (titleEl) titleEl.textContent = 'Légende des Cartes Topographiques';
    if (subEl) subEl.textContent = 'Guide des sentiers balisés, courbes de niveau, falaises et symboles essentiels';
    this.switchLegendTab('ign');
  }

  closeMapLegendModal() {
    const modal = document.getElementById('map-legend-modal');
    if (modal) modal.classList.add('hidden');
  }

  switchLegendTab(tabKey) {
    const tabs = ['satellite', 'ign', 'ibp', 'opentopo', 'osm', 'calanques'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-legend-btn-${t}`);
      const pane = document.getElementById(`legend-pane-${t}`);
      if (btn) {
        if (t === tabKey) {
          btn.className = 'tab-legend-btn px-4 py-2 text-xs font-bold border-b-2 border-emerald-600 text-emerald-700 cursor-pointer flex items-center gap-1.5 transition';
        } else {
          btn.className = 'tab-legend-btn px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 border-b-2 border-transparent cursor-pointer flex items-center gap-1.5 transition';
        }
      }
      if (pane) {
        if (t === tabKey) {
          pane.classList.remove('hidden');
        } else {
          pane.classList.add('hidden');
        }
      }
    });
  }

  // =========================================================================
  // DOWNLOAD MODAL (GPX + PDF)
  // =========================================================================
  openDownloadModal(hike) {
    this.selectedHike = hike;
    const modal = document.getElementById('download-modal');
    if (!modal) return;

    document.getElementById('modal-hike-title').textContent = hike.name;
    document.getElementById('modal-hike-info').textContent = `${hike.distanceKm} km • D+ ${hike.elevationGain}m`;
    modal.classList.remove('hidden');
  }

  closeDownloadModal() {
    const modal = document.getElementById('download-modal');
    if (modal) modal.classList.add('hidden');
  }

  async executeDownload() {
    if (!this.selectedHike) return;

    const dlGpx = document.getElementById('opt-download-gpx').checked;
    const dlPdf = document.getElementById('opt-download-pdf').checked;
    const incMap = document.getElementById('opt-pdf-map').checked;
    const mapLayerEl = document.getElementById('opt-pdf-map-layer');
    const mapLayer = mapLayerEl ? mapLayerEl.value : 'ign';
    const pdfFormatEl = document.getElementById('opt-pdf-format');
    const pdfFormat = pdfFormatEl ? pdfFormatEl.value : 'a4';
    const pdfOrientationEl = document.getElementById('opt-pdf-orientation');
    const pdfOrientation = pdfOrientationEl ? pdfOrientationEl.value : 'portrait';
    const pdfStyleEl = document.getElementById('opt-pdf-style');
    const layoutStyle = pdfStyleEl ? pdfStyleEl.value : 'overlay';
    const incProfile = document.getElementById('opt-pdf-profile').checked;
    const incNotes = document.getElementById('opt-pdf-notes').checked;
    const incUtmEl = document.getElementById('opt-pdf-utm');
    const incUtm = incUtmEl ? incUtmEl.checked : true;

    this.closeDownloadModal();

    // S'assurer que les points et le tracé de la rando sélectionnée sont complètement chargés
    if (typeof StorageManager !== 'undefined') {
      try {
        await StorageManager.ensureHikeTrackLoaded(this.selectedHike);
      } catch (e) {
        console.warn("ensureHikeTrackLoaded:", e);
      }
    }

    if (dlGpx) {
      const gpxContent = GPXParser.exportToGpxString(this.selectedHike);
      const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (this.selectedHike.name || 'randonnee').replace(/[\\/:*?"<>|]/g, '_') + '.gpx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this.showToast("Fichier GPX téléchargé !", "success");
    }

    if (dlPdf) {
      this.showToast("Génération de la Fiche Randonnée...", "info");
      try {
        await PDFExporter.exportFichePDF(this.selectedHike, {
          includeMap: incMap,
          mapLayer: mapLayer,
          format: pdfFormat,
          orientation: pdfOrientation,
          layoutStyle: layoutStyle,
          includeProfile: incProfile,
          includeNotes: incNotes,
          showUtmGrid: incUtm
        });
        const styleLabel = pdfOrientation === 'landscape' ? (layoutStyle === 'overlay' ? ' • Panoramique' : ' • 2 Colonnes') : '';
        this.showToast(`Fiche PDF (${pdfFormat.toUpperCase()} ${pdfOrientation === 'landscape' ? 'Paysage' : 'Portrait'}${styleLabel}) téléchargée !`, "success");
      } catch (err) {
        console.error("Erreur PDF :", err);
        this.showToast("Erreur lors de la génération du PDF", "error");
      }
    }
  }

  async syncFromServer(url, isSilent = false) {
    const syncBtn = document.getElementById('btn-sync-server');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = `<span>⏳</span> Synchronisation...`;
    }

    try {
      const count = await StorageManager.syncWithRemoteServer(url);
      this.allHikes = await StorageManager.getAllHikes();
      this.applyFiltersAndRender();
      this.renderManagementList();
      this.showToast(`🎉 ${count} randonnée(s) synchronisée(s) avec succès depuis le serveur !`, "success");
    } catch (err) {
      console.error("Erreur synchronisation serveur :", err);
      if (!isSilent) {
        this.showToast(`Erreur serveur : ${err.message}`, "error");
      }
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = `<span>🔄</span> Synchroniser`;
      }
    }
  }

  // =========================================================================
  // SUPABASE CLOUD SYNC & PUSH METHODS
  // =========================================================================
  updateSupabaseBadge() {
    const badge = document.getElementById('supabase-status-badge');
    if (!badge) return;

    const url = localStorage.getItem('sanary_supabase_url');
    const key = localStorage.getItem('sanary_supabase_key');

    if (url && key) {
      badge.textContent = '🟢 Prêt / Configuré';
      badge.className = 'text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';
    } else {
      badge.textContent = 'Non configuré';
      badge.className = 'text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600';
    }
  }

  async testSupabaseConnection() {
    const url = (document.getElementById('supabase-url')?.value || '').trim();
    const key = (document.getElementById('supabase-key')?.value || '').trim();

    if (!url || !key) {
      this.showToast("Veuillez saisir votre Project URL et votre Clé Anon Supabase.", "error");
      return;
    }

    this.showToast("Test de connexion à Supabase en cours...", "info");
    try {
      const count = await StorageManager.fetchFromSupabase(url, key);
      this.showToast(`✅ Connexion réussie à Supabase ! (${count} randonnée(s) trouvée(s) dans la base)`, "success");
      this.updateSupabaseBadge();
    } catch (err) {
      this.showToast(`❌ Erreur connexion Supabase : ${err.message}`, "error");
    }
  }

  async syncFromSupabase(isSilent = false) {
    const url = (document.getElementById('supabase-url')?.value || localStorage.getItem('sanary_supabase_url') || '').trim();
    const key = (document.getElementById('supabase-key')?.value || localStorage.getItem('sanary_supabase_key') || '').trim();

    if (!url || !key) {
      if (!isSilent) this.showToast("Veuillez configurer l'URL et la clé Supabase dans les Options.", "error");
      return;
    }

    const syncBtn = document.getElementById('btn-sync-supabase');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = `<span>⏳</span> Connexion Supabase...`;
    }

    try {
      const count = await StorageManager.fetchFromSupabase(url, key);
      this.allHikes = await StorageManager.getAllHikes();
      this.applyFiltersAndRender();
      this.renderManagementList();
      this.updateSupabaseBadge();
      this.showToast(`⚡ ${count} randonnée(s) synchronisée(s) depuis Supabase Cloud !`, "success");
    } catch (err) {
      console.error("Erreur Supabase sync:", err);
      if (!isSilent) {
        this.showToast(`Erreur Supabase : ${err.message}`, "error");
      }
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = `<span>🔄</span> Synchroniser depuis Supabase`;
      }
    }
  }

  async pushAllToSupabase() {
    if (StorageManager.isWriteProtected()) {
      this.showToast("Opération impossible : La base JLDApps est sanctuarisée en lecture seule pour les membres.", "warning");
      return;
    }

    const url = (document.getElementById('supabase-url')?.value || localStorage.getItem('sanary_supabase_url') || '').trim();
    const key = (document.getElementById('supabase-key')?.value || localStorage.getItem('sanary_supabase_key') || '').trim();

    if (!url || !key) {
      this.showToast("Veuillez d'abord renseigner l'URL et la clé Anon Supabase.", "error");
      return;
    }

    const pushBtn = document.getElementById('btn-push-supabase');
    if (pushBtn) {
      pushBtn.disabled = true;
      pushBtn.innerHTML = `<span>⏳</span> Envoi en cours...`;
    }

    try {
      this.showToast("Envoi des randonnées et fichiers GPX vers Supabase...", "info");
      const result = await StorageManager.pushAllLocalHikesToSupabase(url, key, (current, total, name) => {
        this.showToast(`Transfert vers Supabase : ${current}/${total} (${name})...`, "info");
      });

      if (result.total === 0) {
        this.showToast(`✅ Rien à envoyer : les ${result.skipped} randonnée(s) sont déjà sur Supabase.`, "success");
      } else {
        this.showToast(`🚀 ${result.success}/${result.total} nouvelle(s) randonnée(s) envoyée(s) (${result.skipped} déjà présente(s)).`, "success");
      }
      this.updateSupabaseBadge();
    } catch (err) {
      console.error("Erreur push Supabase:", err);
      this.showToast(`Erreur d'envoi vers Supabase : ${err.message}`, "error");
    } finally {
      if (pushBtn) {
        pushBtn.disabled = false;
        pushBtn.innerHTML = `<span>🚀</span> Envoyer mes randos locales vers Supabase`;
      }
    }
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `fixed bottom-5 right-5 z-[150] pointer-events-none px-4 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all transform duration-300 ${
      type === 'success' ? 'bg-emerald-600 text-white' :
      type === 'error' ? 'bg-rose-600 text-white' :
      'bg-slate-900 text-white'
    }`;

    toast.classList.remove('opacity-0', 'translate-y-4');
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4');
    }, 4000);
  }

  playLogoMarch() {
    const frame = document.getElementById('logo-frame');
    const overlay = document.getElementById('logo-anim-overlay');
    const staticLogo = document.getElementById('app-logo');
    const hikersWrapper = document.getElementById('logo-hikers-wrapper');

    if (!frame || !overlay || !staticLogo || !hikersWrapper) return;

    // Reset previous timers and allow immediate re-trigger
    clearTimeout(this._logoMarchTimer);
    clearTimeout(this._logoMarchEndTimer);
    this._isLogoMarching = true;

    // Force hard animation reset
    frame.classList.remove('logo-march-active');
    hikersWrapper.style.animation = 'none';
    void hikersWrapper.offsetWidth;
    hikersWrapper.style.animation = '';

    // Switch view: show animated overlay, hide static base logo
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'none';
    staticLogo.style.opacity = '0';

    // Start marching
    frame.classList.add('logo-march-active');

    // When the 3 hikers exit the frame (after 4.5s)
    this._logoMarchTimer = setTimeout(() => {
      // Revenir au logo tel qu'il est (réapparition fluide du logo d'origine)
      staticLogo.style.opacity = '1';
      overlay.style.opacity = '0';

      this._logoMarchEndTimer = setTimeout(() => {
        frame.classList.remove('logo-march-active');
        this._isLogoMarching = false;
      }, 400);
    }, 4500);
  }

  // =========================================================================
  // AUTHENTIFICATION & GESTION DES UTILISATEURS (MODE B2 - JLD APPS 2026)
  // =========================================================================

  checkAuthenticationState() {
    const lockModal = document.getElementById('login-lock-modal');
    const authContainer = document.getElementById('auth-header-container');
    const isAuthed = typeof AuthManager !== 'undefined' && AuthManager.isAuthenticated();

    // MapRando: Verrouillage par mot de passe réservé à l'espace Randonner
    const currentHash = window.location.hash || '#accueil';
    const isRandoRoute = currentHash.startsWith('#randonner');

    if (!isAuthed) {
      if (lockModal) {
        if (isRandoRoute) {
          lockModal.classList.remove('hidden');
        } else {
          lockModal.classList.add('hidden');
        }
      }
      if (authContainer) authContainer.classList.add('opacity-0', 'pointer-events-none');
      
      // S'assurer que les champs restent strictement vierges à l'affichage (ni identifiant ni mot de passe pré-affichés)
      const userInp = document.getElementById('login-username');
      const pwdInp = document.getElementById('login-password');
      const eyeBtn = document.querySelector('#form-login .pwd-eye-btn');
      if (userInp) userInp.value = '';
      if (pwdInp) {
        pwdInp.value = '';
        pwdInp.type = 'password';
      }
      if (eyeBtn) eyeBtn.textContent = '👁️';
      return false;
    } else {
      if (lockModal) lockModal.classList.add('hidden');
      if (authContainer) authContainer.classList.remove('opacity-0', 'pointer-events-none');
      this.updateAuthHeaderUI();
      this.applyPermissionGuards();
      this.updateDatabaseStatusUI();
      this.renderManagementList();
      this.applyFiltersAndRender();
      return true;
    }
  }

  updateAuthHeaderUI() {
    const user = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUser() : null;
    if (!user) return;

    const usernameDisplay = document.getElementById('header-username-display');
    const roleBadge = document.getElementById('header-role-badge');
    const dropdownUsername = document.getElementById('dropdown-username-info');
    const dropdownPerms = document.getElementById('dropdown-permissions-info');

    if (usernameDisplay) usernameDisplay.textContent = user.username;
    if (roleBadge) {
      if (user.role === 'admin') {
        roleBadge.textContent = 'Admin';
        roleBadge.className = 'px-1.5 py-0.5 bg-emerald-950 text-emerald-300 text-[10px] rounded font-semibold border border-emerald-800';
      } else if (user.role === 'test' || user.username === 'test') {
        roleBadge.textContent = 'Invité (Test)';
        roleBadge.className = 'px-1.5 py-0.5 bg-amber-950 text-amber-300 text-[10px] rounded font-semibold border border-amber-800';
      } else {
        roleBadge.textContent = 'Membre';
        roleBadge.className = 'px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded font-semibold border border-slate-700';
      }
    }

    if (dropdownUsername) {
      const roleLabel = user.role === 'admin' ? 'Administrateur' : (user.role === 'test' || user.username === 'test' ? 'Invité (Découverte)' : 'Membre');
      dropdownUsername.textContent = `Connecté : ${user.username} (${roleLabel})`;
    }
    if (dropdownPerms) {
      if (user.role === 'test' || user.username === 'test') {
        dropdownPerms.textContent = 'Droits : Consultation & Carto seule (Aucune écriture)';
      } else {
        const perms = [];
        if (user.role === 'admin' || user.can_upload) perms.push('📤 Upload');
        if (user.role === 'admin' || user.can_edit) perms.push('✏️ Édition');
        dropdownPerms.textContent = perms.length > 0 ? `Droits : ${perms.join(', ')}` : 'Droits : Consultation seule';
      }
    }
  }

  applyPermissionGuards() {
    const canUpload = typeof AuthManager !== 'undefined' && AuthManager.hasPermission('can_upload');
    const isAdmin = typeof AuthManager !== 'undefined' && AuthManager.isAdmin();
    const isWriteProtected = StorageManager.isWriteProtected();

    // 1. Onglet Charger
    const uploadTabBtn = document.querySelector('[data-tab="upload"]');
    if (uploadTabBtn) {
      if (!canUpload || isWriteProtected) {
        uploadTabBtn.classList.add('opacity-40', 'cursor-not-allowed');
        uploadTabBtn.title = isWriteProtected ? "Base JLDApps sanctuarisée (Lecture seule)" : "Chargement désactivé (Permissions restreintes)";
      } else {
        uploadTabBtn.classList.remove('opacity-40', 'cursor-not-allowed');
        uploadTabBtn.title = "";
      }
    }

    // 2. Boutons Admin dans le menu déroulant et modal post-login
    const adminMenuBtn = document.getElementById('btn-menu-admin-users');
    if (adminMenuBtn) {
      adminMenuBtn.classList.toggle('hidden', !isAdmin);
    }
    const postLoginAdminBtn = document.getElementById('btn-post-login-manage-users');
    if (postLoginAdminBtn) {
      postLoginAdminBtn.classList.toggle('hidden', !isAdmin);
    }

    const curUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUser() : null;
    const isTestUser = curUser && (curUser.role === 'test' || curUser.username === 'test');
    const menuChangePwdBtn = document.getElementById('btn-menu-change-pwd');
    if (menuChangePwdBtn) {
      menuChangePwdBtn.classList.toggle('hidden', Boolean(isTestUser));
    }

    // 3. Dropzone
    const dropzone = document.getElementById('upload-dropzone');
    if (dropzone) {
      if (!canUpload || isWriteProtected) {
        dropzone.classList.add('pointer-events-none', 'opacity-50');
      } else {
        dropzone.classList.remove('pointer-events-none', 'opacity-50');
      }
    }
  }

  toggleUserDropdown() {
    const dd = document.getElementById('user-menu-dropdown');
    if (dd) dd.classList.toggle('hidden');
  }

  closeUserDropdown() {
    const dd = document.getElementById('user-menu-dropdown');
    if (dd) dd.classList.add('hidden');
  }

  togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === 'password') {
      input.type = 'text';
      if (btnEl) btnEl.textContent = '🙈';
    } else {
      input.type = 'password';
      if (btnEl) btnEl.textContent = '👁️';
    }
  }

  updatePasswordCriteriaCheck(inputId, criteriaContainerId) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(criteriaContainerId);
    if (!input || !container || typeof AuthManager === 'undefined') return;

    const val = input.value;
    const res = AuthManager.validatePassword(val);

    const updateEl = (rule, isValid) => {
      const el = container.querySelector(`[data-rule="${rule}"]`);
      if (el) {
        if (isValid) {
          el.classList.remove('invalid');
          el.classList.add('valid');
        } else {
          el.classList.remove('valid');
          el.classList.add('invalid');
        }
      }
    };

    updateEl('length', res.lengthOk);
    updateEl('uppercase', res.uppercaseOk);
    updateEl('lowercase', res.lowercaseOk);
    updateEl('number', res.numberOk);
    updateEl('special', res.specialOk);
  }

  async handleLoginSubmit() {
    const userInput = document.getElementById('login-username');
    const pwdInput = document.getElementById('login-password');
    const errBox = document.getElementById('login-error-msg');
    const errText = document.getElementById('login-error-text');

    if (!userInput || !pwdInput) return;

    const username = userInput.value;
    const password = pwdInput.value;

    if (errBox) errBox.classList.add('hidden');

    const result = await AuthManager.login(username, password);
    if (!result.success) {
      if (errBox && errText) {
        errText.textContent = result.error || "Identifiant ou mot de passe incorrect.";
        errBox.classList.remove('hidden');
      }
      return;
    }

    // Enregistrement auprès du gestionnaire de mots de passe Google / Navigateur
    if (typeof window !== 'undefined' && window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
      try {
        const formEl = document.getElementById('form-login');
        const cred = formEl ? new PasswordCredential(formEl) : new PasswordCredential({
          id: username,
          password: password,
          name: username
        });
        if (cred) {
          navigator.credentials.store(cred).catch(e => console.info("Info stockage mot de passe :", e));
        }
      } catch (e) {
        console.info("Info Credential Management API :", e);
      }
    }

    // Succès de connexion
    this.checkAuthenticationState();
    this.openPostLoginModal(result);
    this.showToast(`Bienvenue ${result.user.username} !`, "success");

    // Nettoyage temporisé pour laisser à Google Password Manager le temps d'enregistrer les identifiants
    setTimeout(() => {
      if (pwdInput) pwdInput.value = '';
    }, 2000);
  }

  openPostLoginModal(loginResult) {
    const modal = document.getElementById('post-login-modal');
    if (!modal) return;

    const user = (loginResult && loginResult.user) || (typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUser() : null);
    if (!user) return;

    const userSpan = document.getElementById('post-login-username');
    if (userSpan) userSpan.textContent = user.username;

    const roleSpan = document.getElementById('post-login-role');
    if (roleSpan) {
      if (user.role === 'admin') {
        roleSpan.textContent = 'Administrateur (Tous pouvoirs)';
        roleSpan.className = 'px-2 py-0.5 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300';
      } else if (user.role === 'test' || user.username === 'test') {
        roleSpan.textContent = 'Accès Découverte (Visiteur invité)';
        roleSpan.className = 'px-2 py-0.5 rounded-full font-bold text-[11px] bg-amber-100 text-amber-800 border border-amber-300';
      } else {
        roleSpan.textContent = 'Membre du club';
        roleSpan.className = 'px-2 py-0.5 rounded-full font-bold text-[11px] bg-slate-100 text-slate-700 border border-slate-300';
      }
    }

    const uploadSpan = document.getElementById('post-login-upload-right');
    if (uploadSpan) {
      const allowed = user.role === 'admin' || user.can_upload;
      uploadSpan.textContent = allowed ? '✅ Autorisé' : '❌ Non autorisé';
      uploadSpan.className = allowed ? 'font-bold text-emerald-700' : 'font-bold text-slate-400';
    }

    const editSpan = document.getElementById('post-login-edit-right');
    if (editSpan) {
      const allowed = user.role === 'admin' || user.can_edit;
      editSpan.textContent = allowed ? '✅ Autorisé' : '❌ Non autorisé';
      editSpan.className = allowed ? 'font-bold text-emerald-700' : 'font-bold text-slate-400';
    }

    // Avertissement mot de passe admin d'origine
    const adminWarn = document.getElementById('post-login-admin-warning');
    if (adminWarn) {
      adminWarn.classList.toggle('hidden', !(loginResult && loginResult.isInitialAdminPassword));
    }

    // Bouton de gestion des utilisateurs (Admin uniquement)
    const adminManageBtn = document.getElementById('btn-post-login-manage-users');
    if (adminManageBtn) {
      adminManageBtn.classList.toggle('hidden', user.role !== 'admin');
    }

    // Masquer le bouton de changement de mot de passe pour le compte invité test
    const postLoginChangePwdBtn = document.getElementById('btn-post-login-change-pwd');
    if (postLoginChangePwdBtn) {
      postLoginChangePwdBtn.classList.toggle('hidden', user.role === 'test' || user.username === 'test');
    }

    modal.classList.remove('hidden');
  }

  closePostLoginModal() {
    const modal = document.getElementById('post-login-modal');
    if (modal) modal.classList.add('hidden');
  }

  handleLogout() {
    if (typeof AuthManager !== 'undefined') {
      AuthManager.logout();
    }
    this.closePostLoginModal();
    this.closeChangePasswordModal();
    this.closeUserManagementModal();
    this.checkAuthenticationState();
    this.showToast("Vous avez été déconnecté.", "info");
  }

  openChangePasswordModal() {
    const user = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUser() : null;
    if (user && (user.username === 'test' || user.role === 'test')) {
      this.showToast("Le mot de passe du compte Invité 'test' est fixe et ne peut pas être modifié.", "warning");
      return;
    }

    const modal = document.getElementById('change-password-modal');
    if (!modal) return;
    const nameEl = document.getElementById('change-pwd-account-name');
    if (nameEl && user) nameEl.textContent = user.username;

    // Renseigner l'identifiant pour Google Password Manager
    const hiddenUser = document.getElementById('change-pwd-username');
    if (hiddenUser && user) hiddenUser.value = user.username;

    // Réinitialiser les champs
    const curInput = document.getElementById('change-pwd-current');
    const newInput = document.getElementById('change-pwd-new');
    const confInput = document.getElementById('change-pwd-confirm');
    const errBox = document.getElementById('change-pwd-error');

    if (curInput) curInput.value = '';
    if (newInput) newInput.value = '';
    if (confInput) confInput.value = '';
    if (errBox) errBox.classList.add('hidden');

    this.updatePasswordCriteriaCheck('change-pwd-new', 'change-pwd-criteria');
    modal.classList.remove('hidden');
  }

  closeChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.add('hidden');
  }

  async handleChangePasswordSubmit() {
    const curInput = document.getElementById('change-pwd-current');
    const newInput = document.getElementById('change-pwd-new');
    const confInput = document.getElementById('change-pwd-confirm');
    const errBox = document.getElementById('change-pwd-error');
    const errText = document.getElementById('change-pwd-error-text');

    const user = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUser() : null;
    if (!user) return;

    if (newInput.value !== confInput.value) {
      if (errBox && errText) {
        errText.textContent = "Les deux nouveaux mots de passe ne correspondent pas.";
        errBox.classList.remove('hidden');
      }
      return;
    }

    const res = await AuthManager.changePassword(user.username, curInput.value, newInput.value);
    if (!res.success) {
      if (errBox && errText) {
        errText.textContent = res.error;
        errBox.classList.remove('hidden');
      }
      return;
    }

    // Mise à jour auprès de Google Password Manager
    if (typeof window !== 'undefined' && window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
      try {
        const formEl = document.getElementById('form-change-password');
        const cred = formEl ? new PasswordCredential(formEl) : new PasswordCredential({
          id: user.username,
          password: newInput.value,
          name: user.username
        });
        if (cred) {
          navigator.credentials.store(cred).catch(() => {});
        }
      } catch (e) {
        console.info("Info Credential Management API (update) :", e);
      }
    }

    this.closeChangePasswordModal();
    this.showToast("🎉 Mot de passe modifié avec succès !", "success");
  }

  openUserManagementModal() {
    if (typeof AuthManager === 'undefined' || !AuthManager.isAdmin()) {
      this.showToast("Accès réservé à l'administrateur.", "error");
      return;
    }

    const modal = document.getElementById('user-management-modal');
    if (!modal) return;

    this._customTempPwd = false;

    // Réinitialiser formulaire création de façon sécurisée
    try {
      const userInp = document.getElementById('new-user-username');
      const pwdInp = document.getElementById('new-user-password');
      const upChk = document.getElementById('new-user-can-upload');
      const edChk = document.getElementById('new-user-can-edit');
      const errBox = document.getElementById('create-user-error');

      if (userInp) userInp.value = '';
      if (pwdInp) pwdInp.value = '';
      if (upChk) upChk.checked = true;
      if (edChk) edChk.checked = false;
      if (errBox) errBox.classList.add('hidden');
    } catch (e) {
      console.warn("Erreur réinitialisation formulaire création user :", e);
    }

    try {
      this.renderUsersTable();
    } catch (e) {
      console.error("Erreur lors du rendu de la table des utilisateurs :", e);
    }

    try {
      this.updateSupabaseUsersStatusBadge();
    } catch (e) {
      console.warn("Erreur badge statut Supabase :", e);
    }

    try {
      this.updateDatabaseStatusUI();
    } catch (e) {
      console.warn("Erreur mise à jour UI base :", e);
    }

    modal.classList.remove('hidden');
  }

  handleNewUserUsernameInput(val) {
    if (this._customTempPwd) return;
    const pwdInp = document.getElementById('new-user-password');
    if (pwdInp) {
      pwdInp.value = val;
    }
  }

  onUserTempPasswordEdited() {
    this._customTempPwd = true;
  }

  closeUserManagementModal() {
    const modal = document.getElementById('user-management-modal');
    if (modal) modal.classList.add('hidden');
  }

  generateTempPasswordForCreation() {
    if (typeof AuthManager === 'undefined') return;
    const pwdInp = document.getElementById('new-user-password');
    if (!pwdInp) return;

    const temp = AuthManager.generateTemporaryPassword();
    pwdInp.value = temp;
    pwdInp.type = 'text';
    this._customTempPwd = true;
    this.showToast(`Mot de passe temporaire généré : ${temp}`, "info");
  }

  async handleCreateUserSubmit() {
    const userInp = document.getElementById('new-user-username');
    const pwdInp = document.getElementById('new-user-password');
    const upChk = document.getElementById('new-user-can-upload');
    const edChk = document.getElementById('new-user-can-edit');
    const errBox = document.getElementById('create-user-error');

    if (!userInp || !pwdInp) return;

    if (errBox) errBox.classList.add('hidden');

    const createdUsername = userInp.value.trim();
    const createdPwd = pwdInp.value.trim();

    const res = await AuthManager.createUser({
      username: createdUsername,
      password: createdPwd,
      can_upload: upChk ? upChk.checked : false,
      can_edit: edChk ? edChk.checked : false
    });

    if (!res.success) {
      if (errBox) {
        errBox.textContent = res.error;
        errBox.classList.remove('hidden');
      }
      return;
    }

    userInp.value = '';
    pwdInp.value = '';
    this._customTempPwd = false;
    this.renderUsersTable();
    this.updateSupabaseUsersStatusBadge();

    // Feedback clair avec identifiants pour transmission au membre
    let credsSummary = `Compte créé avec succès !\n\n👤 Identifiant : ${createdUsername}\n🔑 Mot de passe temporaire : ${createdPwd}\n\n(Ces identifiants sont enregistrés. Le membre pourra se connecter et changer son mot de passe.)`;
    
    if (res.cloudSynced) {
      this.showToast(`✅ Utilisateur « ${createdUsername} » créé et synchronisé sur le Cloud !`, "success");
    } else {
      this.showToast(`⚠️ Utilisateur « ${createdUsername} » enregistré en LOCAL uniquement sur cet appareil.`, "warning");
      credsSummary += `\n\n⚠️ ATTENTION (Mode Local) :\nLa table Supabase Cloud n'étant pas encore active, ce compte n'est enregistré que sur CET appareil. Pour qu'il fonctionne sur d'autres téléphones ou ordinateurs, exécutez le script SQL dans Supabase (ou utilisez le bouton "Exporter les comptes").`;
    }

    setTimeout(() => {
      if (confirm(`${credsSummary}\n\nSouhaitez-vous copier ces identifiants dans le presse-papier pour les envoyer au membre ?`)) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(`Accès RandoFinder - Les Randonneurs Sanaryens\nIdentifiant : ${createdUsername}\nMot de passe : ${createdPwd}\nLien : https://jusitafu.github.io/RandoFinder/`);
          this.showToast("📋 Identifiants copiés dans le presse-papier !", "success");
        }
      }
    }, 150);
  }

  renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    const countBadge = document.getElementById('users-count-badge');
    if (!tbody || typeof AuthManager === 'undefined') return;

    const users = AuthManager.getAllUsers();
    if (countBadge) {
      countBadge.textContent = `${users.length} compte${users.length > 1 ? 's' : ''}`;
    }

    tbody.innerHTML = '';

    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';

      const isAdmin = u.role === 'admin';
      const isTest = u.role === 'test' || u.username === 'test';
      const canUploadBadge = (isAdmin || u.can_upload) 
        ? `<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">📤 Upload</span>`
        : `<span class="px-2 py-0.5 rounded font-medium text-[10px] bg-slate-100 text-slate-400">📤 Non</span>`;

      const canEditBadge = (isAdmin || u.can_edit)
        ? `<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">✏️ Édition</span>`
        : `<span class="px-2 py-0.5 rounded font-medium text-[10px] bg-slate-100 text-slate-400">✏️ Non</span>`;

      let roleBadgeHtml = '';
      if (isAdmin) {
        roleBadgeHtml = '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-300">Administrateur</span>';
      } else if (isTest) {
        roleBadgeHtml = '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-300">Invité (Découverte)</span>';
      } else {
        roleBadgeHtml = '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">Membre</span>';
      }

      tr.innerHTML = `
        <td class="py-3 px-4 font-bold text-slate-900">
          <div class="flex items-center gap-1.5">
            <span>👤</span>
            <span>${u.username}</span>
            ${isAdmin ? '<span class="text-[9px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">Principal</span>' : ''}
            ${isTest ? '<span class="text-[9px] text-amber-700 font-extrabold bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">Fixe</span>' : ''}
          </div>
        </td>
        <td class="py-3 px-3">
          ${roleBadgeHtml}
        </td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-1.5">
            ${canUploadBadge}
            ${canEditBadge}
          </div>
        </td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            ${isTest ? `
              <span class="text-[10px] text-amber-800 font-bold px-2 py-1 bg-amber-50 rounded-lg border border-amber-200">
                🔒 Compte fixe (test/test)
              </span>
            ` : `
              <button class="btn-user-reset-pwd px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition" title="Générer ou définir un mot de passe temporaire">
                🔑 Réinit. MDP
              </button>
              ${!isAdmin ? `
                <button class="btn-user-edit-perms px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-semibold transition" title="Modifier les droits">
                  ⚙️ Droits
                </button>
                <button class="btn-user-delete px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold transition" title="Supprimer cet utilisateur">
                  🗑️
                </button>
              ` : ''}
            `}
          </div>
        </td>
      `;

      const resetBtn = tr.querySelector('.btn-user-reset-pwd');
      if (resetBtn) {
        resetBtn.onclick = () => this.promptResetUserPassword(u.id, u.username);
      }
      const editEmailBtn = tr.querySelector('.btn-user-edit-email');
      if (editEmailBtn) {
        editEmailBtn.onclick = () => this.promptEditUserEmail(u.id, u.username, u.email);
      }

      const editPermsBtn = tr.querySelector('.btn-user-edit-perms');
      if (editPermsBtn) {
        editPermsBtn.onclick = () => this.promptEditUserPermissions(u);
      }

      const delBtn = tr.querySelector('.btn-user-delete');
      if (delBtn) {
        delBtn.onclick = () => this.confirmDeleteUser(u.id, u.username);
      }

      tbody.appendChild(tr);
    });
  }

  async promptEditUserEmail(userId, username, currentEmail) {
    if (typeof AuthManager === 'undefined') return;
    const input = prompt(
      `Adresse email associée à l'adhérent « ${username} » :\n(Laissez vide pour supprimer l'association)`,
      currentEmail || ''
    );
    if (input === null) return;
    const res = await AuthManager.updateUserEmail(userId, input.trim());
    if (res.success) {
      this.showToast(`Email mis à jour pour « ${username} »`, "success");
      this.renderUsersTable();
    } else {
      this.showToast(`Erreur : ${res.error}`, "error");
    }
  }

  openForgotPasswordModal() {
    const currentUsername = document.getElementById('login-username')?.value.trim() || '';
    const targetInp = document.getElementById('forgot-pwd-username');
    if (targetInp) targetInp.value = currentUsername;
    const msgBox = document.getElementById('forgot-pwd-msg');
    if (msgBox) {
      msgBox.className = 'hidden';
      msgBox.innerHTML = '';
    }
    const modal = document.getElementById('modal-forgot-password');
    if (modal) modal.classList.remove('hidden');
    const lockModal = document.getElementById('login-lock-modal');
    if (lockModal) lockModal.classList.add('hidden');
  }

  closeForgotPasswordModal() {
    const modal = document.getElementById('modal-forgot-password');
    if (modal) modal.classList.add('hidden');
    const lockModal = document.getElementById('login-lock-modal');
    if (lockModal) lockModal.classList.remove('hidden');
  }

  async handleForgotPasswordSubmit() {
    const userInp = document.getElementById('forgot-pwd-username');
    const msgBox = document.getElementById('forgot-pwd-msg');
    if (!userInp || !msgBox) return;

    const username = userInp.value.trim();
    if (!username) {
      msgBox.className = 'p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2';
      msgBox.innerHTML = '<span>⚠️</span> <span>Veuillez renseigner votre nom d\'utilisateur ou prénom.</span>';
      msgBox.classList.remove('hidden');
      return;
    }

    const res = await AuthManager.resetPasswordAndPrepareEmail(username);

    if (!res.success) {
      if (res.noEmail) {
        msgBox.className = 'p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold flex items-center gap-2.5';
        msgBox.innerHTML = '<span>⚠️</span> <span>pas d\'adresse mail associée à cet utilisateur</span>';
      } else {
        msgBox.className = 'p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2';
        msgBox.innerHTML = `<span>⚠️</span> <span>${res.error || "Utilisateur introuvable."}</span>`;
      }
      msgBox.classList.remove('hidden');
      return;
    }

    // Succès : mot de passe généré et envoyé
    msgBox.className = 'p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-slate-800 text-xs space-y-2.5';
    msgBox.innerHTML = `
      <div class="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
        <span>✉️</span> <span>Mot de passe renvoyé !</span>
      </div>
      <p class="text-slate-600 leading-relaxed">
        Un message a été préparé pour votre adresse email <strong class="text-slate-900">${res.email}</strong>.
      </p>
      <div class="p-3 bg-white border border-emerald-300 rounded-xl flex items-center justify-between gap-2 shadow-sm">
        <div>
          <div class="text-[10px] uppercase tracking-wider text-slate-400 font-black">Nouveau mot de passe temporaire :</div>
          <div class="font-mono text-base font-extrabold text-emerald-700 select-all">${res.tempPassword}</div>
        </div>
        <button type="button" onclick="navigator.clipboard.writeText('${res.tempPassword}'); App.showToast('Mot de passe copié !', 'success')" class="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer">
          <span>📋</span> <span>Copier</span>
        </button>
      </div>
      <div class="pt-1 flex flex-col gap-1.5">
        <button type="button" onclick="window.location.href='${res.mailtoUrl}'" class="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer">
          <span>📨</span> <span>Ouvrir ma messagerie (${res.email})</span>
        </button>
        <button type="button" onclick="document.getElementById('login-username').value='${res.username.replace(/'/g, "\\'")}'; document.getElementById('login-password').value='${res.tempPassword}'; App.closeForgotPasswordModal(); App.handleLoginSubmit();" class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer">
          <span>🔓</span> <span>Se connecter directement</span>
        </button>
      </div>
    `;
    msgBox.classList.remove('hidden');

    try {
      window.location.href = res.mailtoUrl;
    } catch (e) {}
  }

  async promptResetUserPassword(userId, username) {
    if (typeof AuthManager === 'undefined') return;
    const inputPwd = prompt(
      `Réinitialisation du mot de passe pour « ${username} ».\n\nMot de passe temporaire proposé par défaut (= nom d'utilisateur) :\n(Conservez-le ou saisissez-en un autre)`,
      username
    );
    if (inputPwd === null) return;
    const chosenPwd = inputPwd.trim() || username;

    const res = await AuthManager.resetUserPassword(userId, chosenPwd);
    if (res.success) {
      this.showToast(`Mot de passe réinitialisé pour « ${username} » : ${chosenPwd}`, "success");
      this.renderUsersTable();
    } else {
      this.showToast(`Erreur : ${res.error}`, "error");
    }
  }

  async promptEditUserPermissions(user) {
    if (typeof AuthManager === 'undefined') return;
    if (user.username === 'test' || user.role === 'test') {
      this.showToast("Les permissions du compte Invité 'test' sont fixes (lecture seule).", "warning");
      return;
    }
    const newUpload = confirm(`Droits pour « ${user.username} » :\n\n1. Autoriser le CHARGEMENT de nouveaux fichiers GPX ?\n\n(OK = Autoriser, Annuler = Refuser)`);
    const newEdit = confirm(`Droits pour « ${user.username} » :\n\n2. Autoriser l'ÉDITION et SUPPRESSION dans la bibliothèque ?\n\n(OK = Autoriser, Annuler = Refuser)`);

    await AuthManager.updateUserPermissions(user.id, {
      can_upload: newUpload,
      can_edit: newEdit
    });

    this.showToast(`Permissions mises à jour pour « ${user.username} »`, "success");
    this.renderUsersTable();
    this.applyPermissionGuards();
  }

  async confirmDeleteUser(userId, username) {
    if (typeof AuthManager === 'undefined') return;
    if (username === 'admin') {
      this.showToast("Le compte administrateur principal ne peut pas être supprimé.", "error");
      return;
    }
    if (username === 'test') {
      this.showToast("Le compte Invité 'test' est protégé et ne peut pas être supprimé.", "error");
      return;
    }
    const conf = confirm(`Êtes-vous certain de vouloir supprimer définitivement le compte utilisateur « ${username} » ?`);
    if (!conf) return;

    const res = await AuthManager.deleteUser(userId);
    if (res.success) {
      this.showToast(`Utilisateur « ${username} » supprimé.`, "info");
      this.renderUsersTable();
    } else {
      this.showToast(`Erreur : ${res.error}`, "error");
    }
  }

  copySupabaseSqlScript() {
    if (typeof AuthManager === 'undefined') return;
    const sql = AuthManager.getSupabaseTableSQL();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(sql).then(() => {
        this.showToast("📋 Script SQL Supabase copié dans le presse-papier !", "success");
      }).catch(() => {
        prompt("Copiez le script SQL Supabase ci-dessous :", sql);
      });
    } else {
      prompt("Copiez le script SQL Supabase ci-dessous :", sql);
    }
  }

  async testAndSyncSupabaseUsers() {
    if (typeof AuthManager === 'undefined') return;
    this.showToast("Vérification de la table Supabase app_users...", "info");
    const res = await AuthManager.syncFromSupabase();
    if (res && res.success) {
      this.showToast(`✅ Cloud connecté ! ${res.count} compte(s) synchronisé(s) avec Supabase.`, "success");
    } else if (res && res.reason === 'table_not_found') {
      this.showToast("⚠️ Table app_users inexistante sur Supabase. Cliquez sur « Copier le script SQL » puis « Ouvrir Supabase SQL Editor ».", "warning");
    } else if (res && res.reason === 'network_error') {
      this.showToast("⚠️ Projet Supabase inaccessible ou en pause. Rendez-vous sur supabase.com pour cliquer sur « Restore project ».", "warning");
    } else {
      this.showToast("ℹ️ Mode local actif (comptes enregistrés sur cet appareil).", "info");
    }
    this.updateSupabaseUsersStatusBadge();
    this.renderUsersTable();
  }

  updateSupabaseUsersStatusBadge() {
    const badge = document.getElementById('supa-users-status');
    if (!badge || typeof AuthManager === 'undefined') return;

    if (AuthManager.isSupabaseAvailable) {
      badge.textContent = '🟢 Cloud Supabase Connecté (Multi-appareils)';
      badge.className = 'px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300';
    } else {
      badge.textContent = '💾 Stockage Local (Cet appareil uniquement)';
      badge.className = 'px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-300';
    }
  }

  copyMapCoords() {
    if (this.mapManager && typeof this.mapManager.copyCurrentCoordsToClipboard === 'function') {
      this.mapManager.copyCurrentCoordsToClipboard();
    }
  }

  exportUsersToFile() {
    if (typeof AuthManager === 'undefined') return;
    const jsonStr = AuthManager.exportUsersJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `randofinder_comptes_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast("💾 Fichier des comptes utilisateurs téléchargé !", "success");
  }

  async handleImportUsersFile(event) {
    const file = event.target && event.target.files && event.target.files[0];
    if (!file || typeof AuthManager === 'undefined') return;
    try {
      const text = await file.text();
      const res = await AuthManager.importUsersJSON(text);
      if (res.success) {
        this.showToast(`🎉 ${res.imported} compte(s) importé(s) avec succès ! Total : ${res.count} comptes.`, "success");
        this.renderUsersTable();
      } else {
        this.showToast(`Erreur d'importation : ${res.error}`, "error");
      }
    } catch (e) {
      this.showToast(`Erreur de lecture du fichier : ${e.message}`, "error");
    }
    event.target.value = '';
  }

  openCguModal() {
    const modal = document.getElementById('cgu-modal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }
  }

  closeCguModal() {
    const modal = document.getElementById('cgu-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }
}

// Global bootstrap
function bootstrapApp() {
  if (!window.App) {
    window.App = new AppController();
    window.app = window.App;
    window.App.init();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}



/* =========================================================================
 * GESTIONNAIRE PLEINE PAGE, ASCENSEUR (STYLE WORD) & FLÈCHES CLIGNOTANTES
 * ========================================================================= */
class ScrollElevatorManager {
  constructor() {
    this.elevatorEl = null;
    this.trackEl = null;
    this.thumbEl = null;
    this.arrowDownEl = null;
    this.arrowUpEl = null;
    this.isDragging = false;
    this.dragStartY = 0;
    this.dragStartScrollTop = 0;
    this.activeTarget = null;
    this._rafPending = false;
    this._isUpdating = false;
    this.init();
  }

  toggleClassSafe(el, cls, force) {
    if (!el) return;
    const has = el.classList.contains(cls);
    if (force && !has) el.classList.add(cls);
    else if (!force && has) el.classList.remove(cls);
  }

  init() {
    if (document.getElementById('page-scroll-elevator')) return;

    // 1. Créer l'ascenseur latéral droit (comme dans Word)
    const elevator = document.createElement('div');
    elevator.id = 'page-scroll-elevator';
    elevator.className = 'elevator-hidden';
    elevator.setAttribute('aria-label', 'Ascenseur de défilement de la page');
    elevator.innerHTML = `
      <button type="button" id="elevator-btn-up" class="elevator-step-btn" title="Monter">▲</button>
      <div id="page-scroll-track" title="Cliquez ou faites glisser le curseur pour défiler">
        <div id="page-scroll-thumb" title="Faites glisser ce curseur (ascenseur) pour parcourir la page">
          <span class="thumb-grip-line"></span>
          <span class="thumb-grip-line"></span>
          <span class="thumb-grip-line"></span>
        </div>
      </div>
      <button type="button" id="elevator-btn-down" class="elevator-step-btn" title="Descendre">▼</button>
    `;
    document.body.appendChild(elevator);

    // 2. Créer la flèche clignotante vers le bas (quand le texte déborde en bas)
    const arrowDown = document.createElement('button');
    arrowDown.type = 'button';
    arrowDown.id = 'scroll-overflow-arrow-down';
    arrowDown.className = 'scroll-overflow-arrow arrow-hidden';
    arrowDown.title = 'Du contenu supplémentaire est disponible plus bas — Cliquez pour descendre';
    arrowDown.innerHTML = `<span style="font-size:15px;line-height:1;">⬇</span> <span>Défiler vers le bas</span>`;
    document.body.appendChild(arrowDown);

    // 3. Créer la flèche clignotante vers le haut (quand le texte déborde en haut)
    const arrowUp = document.createElement('button');
    arrowUp.type = 'button';
    arrowUp.id = 'scroll-overflow-arrow-up';
    arrowUp.className = 'scroll-overflow-arrow arrow-hidden';
    arrowUp.title = 'Remonter vers le haut de la page';
    arrowUp.innerHTML = `<span style="font-size:15px;line-height:1;">⬆</span> <span>Remonter</span>`;
    document.body.appendChild(arrowUp);

    this.elevatorEl = elevator;
    this.trackEl = elevator.querySelector('#page-scroll-track');
    this.thumbEl = elevator.querySelector('#page-scroll-thumb');
    this.arrowDownEl = arrowDown;
    this.arrowUpEl = arrowUp;

    this.bindEvents();
    this.fitMenuToFullPage();
    this.refresh();
    this.checkAndShowMobileWarning();
  }

  /**
   * Détecte si l'application est lancée sur un téléphone (iPhone ou Android)
   * et affiche un warning rouge clignotant 2 fois puis disparaissant :
   * "Fonctionne mieux sur PC ou Mac"
   */
  checkAndShowMobileWarning() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    const isAndroid = /Android/i.test(ua);
    const isIPhone = /iPhone|iPod/i.test(ua);
    const isMobileUA = /Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const forceTest = window.location.search.includes('mobile_warning=1') || window.location.hash.includes('mobile_warning=1');

    if (!(isAndroid || isIPhone || isMobileUA || forceTest)) {
      return; // Sur PC ou Mac : ne pas afficher le warning
    }

    const existing = document.getElementById('mobile-pc-mac-warning');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'mobile-pc-mac-warning';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;font-weight:900;font-size:14px;letter-spacing:0.02em;text-transform:uppercase;">
        <span style="font-size:20px;line-height:1;">⚠️</span>
        <span>Fonctionne mieux sur PC ou Mac</span>
      </div>
      <div style="font-size:11px;font-weight:600;color:#fee2e2;margin-top:3px;">
        Affichage mobile (iPhone / Android) détecté — Privilégiez un ordinateur pour le confort cartographique.
      </div>
    `;
    document.body.appendChild(banner);

    setTimeout(() => {
      if (banner && banner.parentNode) {
        banner.remove();
      }
    }, 6600);
  }

  /**
   * Détermine le conteneur de défilement actif (modale ouverte, onglet Randonner, ou page entière)
   */
  getScrollContext() {
    const modalSelectors = [
      '#modal-mode-emploi:not(.hidden) > div',
      '#modal-cgu:not(.hidden) > div',
      '#cgu-modal:not(.hidden) .overflow-y-auto',
      '#manual-modal:not(.hidden) .overflow-y-auto'
    ];
    for (const sel of modalSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null && el.scrollHeight > el.clientHeight + 8) {
        return {
          type: 'element',
          el,
          getScrollTop: () => el.scrollTop,
          setScrollTop: (val, smooth = false) => {
            if (smooth && el.scrollTo) el.scrollTo({ top: val, behavior: 'smooth' });
            else el.scrollTop = val;
          },
          getScrollHeight: () => el.scrollHeight,
          getClientHeight: () => el.clientHeight
        };
      }
    }

    const mapApp = document.getElementById('main-map-app-container');
    if (mapApp && !mapApp.classList.contains('hidden')) {
      const hash = (window.location.hash || '').replace('#', '').split('?')[0];
      if (hash === 'carte') {
        return null;
      }
      const tabIds = ['tab-content-upload', 'tab-content-manage', 'tab-content-settings'];
      for (const id of tabIds) {
        const tabEl = document.getElementById(id);
        if (tabEl && !tabEl.classList.contains('hidden') && tabEl.offsetParent !== null) {
          return {
            type: 'element',
            el: tabEl,
            getScrollTop: () => tabEl.scrollTop,
            setScrollTop: (val, smooth = false) => {
              if (smooth && tabEl.scrollTo) tabEl.scrollTo({ top: val, behavior: 'smooth' });
              else tabEl.scrollTop = val;
            },
            getScrollHeight: () => tabEl.scrollHeight,
            getClientHeight: () => tabEl.clientHeight
          };
        }
      }
      const tableContainer = document.getElementById('table-container');
      const tableCol = document.getElementById('table-column');
      if (tableContainer && tableCol && !tableCol.classList.contains('hidden') && tableContainer.offsetParent !== null) {
        return {
          type: 'element',
          el: tableContainer,
          getScrollTop: () => tableContainer.scrollTop,
          setScrollTop: (val, smooth = false) => {
            if (smooth && tableContainer.scrollTo) tableContainer.scrollTo({ top: val, behavior: 'smooth' });
            else tableContainer.scrollTop = val;
          },
          getScrollHeight: () => tableContainer.scrollHeight,
          getClientHeight: () => tableContainer.clientHeight
        };
      }
    }

    const docEl = document.scrollingElement || document.documentElement;
    return {
      type: 'window',
      el: docEl,
      getScrollTop: () => window.pageYOffset || docEl.scrollTop || 0,
      setScrollTop: (val, smooth = false) => {
        window.scrollTo({ top: val, behavior: smooth ? 'smooth' : 'auto' });
      },
      getScrollHeight: () => Math.max(docEl.scrollHeight, document.body ? document.body.scrollHeight : 0),
      getClientHeight: () => window.innerHeight || docEl.clientHeight
    };
  }

  /**
   * Ajuste automatiquement chaque page de menu (#accueil et #guides replié)
   * pour qu'elle s'affiche en pleine page (100% visible) sans débordement initial,
   * et aligne le cadre des pubs en haut et en bas avec les cadres de gauche.
   */
  fitMenuToFullPage() {
    if (this._isUpdating) return;
    this._isUpdating = true;
    try {
      const portalView = document.getElementById('portal-view');
      const guidesView = document.getElementById('guides-view');
      const vh = window.innerHeight || document.documentElement.clientHeight;

      // 1. Page d'accueil (#portal-view)
      if (portalView && !portalView.classList.contains('hidden')) {
        const mainEl = portalView.querySelector('main');
        if (mainEl) {
          mainEl.style.zoom = '1';
          const totalH = portalView.scrollHeight;
          if (totalH > vh + 2 && vh >= 500) {
            const scale = Math.max(0.72, Math.min(1, (vh - 8) / totalH));
            mainEl.style.zoom = scale.toFixed(3);
          }
        }
      }

      // 2. Page Guides & Savoirs (#guides-view) lorsque toutes les fiches sont repliées
      if (guidesView && !guidesView.classList.contains('hidden')) {
        const ficheIds = ['fiche-gps-content', 'fiche-lidar-content', 'fiche-ibp-content', 'fiche-checklist-content'];
        const anyExpanded = ficheIds.some(id => {
          const el = document.getElementById(id);
          return el && !el.classList.contains('hidden');
        });

        const mainGrid = document.getElementById('guides-main-grid');
        const gearPanel = document.getElementById('outdoor-gear-panel');
        if (mainGrid && gearPanel) {
          this.toggleClassSafe(mainGrid, 'items-stretch', !anyExpanded);
          this.toggleClassSafe(mainGrid, 'items-start', anyExpanded);
          this.toggleClassSafe(gearPanel, 'h-full', !anyExpanded);
          this.toggleClassSafe(gearPanel, 'lg:sticky', anyExpanded);
          this.toggleClassSafe(gearPanel, 'lg:top-4', anyExpanded);
        }

        const contentWrap = guidesView.children[1];
        if (contentWrap) {
          contentWrap.style.zoom = '1';
          if (!anyExpanded) {
            const totalH = guidesView.scrollHeight;
            if (totalH > vh + 2 && vh >= 500) {
              const scale = Math.max(0.72, Math.min(1, (vh - 10) / totalH));
              contentWrap.style.zoom = scale.toFixed(3);
            }
          }
        }
      }
    } finally {
      this._isUpdating = false;
    }
  }

  /**
   * Met à jour la visibilité et la position du curseur de l'ascenseur + flèches clignotantes
   */
  refresh() {
    if (!this.elevatorEl || !this.trackEl || !this.thumbEl || this._isUpdating) return;
    this._isUpdating = true;
    try {
      const ctx = this.getScrollContext();
      this.activeTarget = ctx;

      if (!ctx) {
        this.toggleClassSafe(this.elevatorEl, 'elevator-hidden', true);
        this.toggleClassSafe(this.arrowDownEl, 'arrow-hidden', true);
        this.toggleClassSafe(this.arrowUpEl, 'arrow-hidden', true);
        return;
      }

      const scrollHeight = ctx.getScrollHeight();
      const clientHeight = ctx.getClientHeight();
      const scrollTop = ctx.getScrollTop();
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 10) {
        this.toggleClassSafe(this.elevatorEl, 'elevator-hidden', true);
        this.toggleClassSafe(this.arrowDownEl, 'arrow-hidden', true);
        this.toggleClassSafe(this.arrowUpEl, 'arrow-hidden', true);
        return;
      }

      this.toggleClassSafe(this.elevatorEl, 'elevator-hidden', false);

      const trackHeight = this.trackEl.clientHeight || (window.innerHeight - 130);
      const ratioVisible = Math.min(1, Math.max(0.08, clientHeight / scrollHeight));
      const thumbHeight = Math.max(42, Math.round(trackHeight * ratioVisible));
      const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
      const scrollRatio = Math.min(1, Math.max(0, scrollTop / maxScroll));
      const thumbTop = Math.round(scrollRatio * maxThumbTop);

      this.thumbEl.style.height = `${thumbHeight}px`;
      this.thumbEl.style.top = `${thumbTop}px`;

      this.toggleClassSafe(this.arrowDownEl, 'arrow-hidden', !(scrollTop < maxScroll - 12));
      this.toggleClassSafe(this.arrowUpEl, 'arrow-hidden', !(scrollTop > 20));
    } finally {
      this._isUpdating = false;
    }
  }

  scheduleUpdate() {
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      this.fitMenuToFullPage();
      this.refresh();
    });
  }

  bindEvents() {
    window.addEventListener('scroll', () => this.refresh(), { passive: true, capture: true });
    window.addEventListener('resize', () => this.scheduleUpdate());
    window.addEventListener('hashchange', () => {
      setTimeout(() => this.scheduleUpdate(), 60);
    });

    const btnUp = this.elevatorEl.querySelector('#elevator-btn-up');
    const btnDown = this.elevatorEl.querySelector('#elevator-btn-down');

    if (btnUp) {
      btnUp.addEventListener('click', (e) => {
        e.stopPropagation();
        const ctx = this.getScrollContext();
        if (ctx) ctx.setScrollTop(Math.max(0, ctx.getScrollTop() - 220), true);
      });
    }
    if (btnDown) {
      btnDown.addEventListener('click', (e) => {
        e.stopPropagation();
        const ctx = this.getScrollContext();
        if (ctx) ctx.setScrollTop(ctx.getScrollTop() + 220, true);
      });
    }

    this.trackEl.addEventListener('mousedown', (e) => {
      if (e.target === this.thumbEl || this.thumbEl.contains(e.target)) return;
      const ctx = this.getScrollContext();
      if (!ctx) return;
      const rect = this.trackEl.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const thumbTop = parseFloat(this.thumbEl.style.top || '0');
      const pageStep = ctx.getClientHeight() * 0.75;
      if (clickY < thumbTop) {
        ctx.setScrollTop(Math.max(0, ctx.getScrollTop() - pageStep), true);
      } else {
        ctx.setScrollTop(ctx.getScrollTop() + pageStep, true);
      }
    });

    this.thumbEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ctx = this.getScrollContext();
      if (!ctx) return;
      this.isDragging = true;
      this.dragStartY = e.clientY;
      this.dragStartScrollTop = ctx.getScrollTop();
      this.thumbEl.classList.add('dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const ctx = this.getScrollContext();
      if (!ctx) return;
      const trackHeight = this.trackEl.clientHeight || 300;
      const thumbHeight = this.thumbEl.offsetHeight || 42;
      const maxThumbTop = Math.max(1, trackHeight - thumbHeight);
      const maxScroll = Math.max(1, ctx.getScrollHeight() - ctx.getClientHeight());
      const deltaY = e.clientY - this.dragStartY;
      const scrollDelta = (deltaY / maxThumbTop) * maxScroll;
      ctx.setScrollTop(Math.min(maxScroll, Math.max(0, this.dragStartScrollTop + scrollDelta)), false);
      this.refresh();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.thumbEl.classList.remove('dragging');
      }
    });

    this.arrowDownEl.addEventListener('click', () => {
      const ctx = this.getScrollContext();
      if (!ctx) return;
      const step = Math.round(ctx.getClientHeight() * 0.75);
      ctx.setScrollTop(ctx.getScrollTop() + step, true);
    });

    this.arrowUpEl.addEventListener('click', () => {
      const ctx = this.getScrollContext();
      if (!ctx) return;
      const step = Math.round(ctx.getClientHeight() * 0.75);
      const target = ctx.getScrollTop() - step;
      ctx.setScrollTop(target < 80 ? 0 : target, true);
    });

    document.addEventListener('click', () => {
      setTimeout(() => this.scheduleUpdate(), 40);
    });
  }
}

function initScrollElevator() {
  if (!window.ScrollElevatorInstance) {
    window.ScrollElevatorInstance = new ScrollElevatorManager();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScrollElevator);
} else {
  setTimeout(initScrollElevator, 50);
}
