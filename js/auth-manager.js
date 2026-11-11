/**
 * Auth & User Permissions Manager
 * Les Randonneurs Sanaryens - RandoFinder - JLD Apps 2026
 * 
 * Supports:
 * - Admin and Member accounts
 * - Mode B2: Full private lock screen on opening
 * - Strict Password Policy (8-26 chars, uppercase, lowercase, digit, special char)
 * - WebCrypto SHA-256 + Salt hashing (no external libraries)
 * - Granular permissions: can_upload, can_edit
 * - Dual persistence: LocalStorage cache + Automatic Supabase Cloud sync (app_users table)
 */

class AuthManager {
  static STORAGE_KEY = 'randofinder_users_v1';
  static SESSION_KEY = 'randofinder_session_v1';
  static SALT = 'sanary_salt_2026';

  // Hash SHA-256 pré-calculé pour 'JLDApps#2026' avec salt 'sanary_salt_2026'
  static DEFAULT_ADMIN_HASH = '43b8058a90e45ee18f465adfea6bcfad03871c8ca6f736381b95669265c95715';

  static DEFAULT_ADMIN = {
    id: 'user_admin',
    username: 'admin',
    password_hash: '43b8058a90e45ee18f465adfea6bcfad03871c8ca6f736381b95669265c95715',
    role: 'admin',
    can_upload: true,
    can_edit: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  };

  // Hash SHA-256 pré-calculé pour 'test' avec salt 'sanary_salt_2026'
  static DEFAULT_TEST_HASH = '250e312ff25a26c92fd9f381c65090e077fdc1a471e7fd98c567b768674f0946';

  static DEFAULT_TEST_USER = {
    id: 'user_test',
    username: 'test',
    password_hash: '250e312ff25a26c92fd9f381c65090e077fdc1a471e7fd98c567b768674f0946',
    email: null,
    role: 'test',
    can_upload: false,
    can_edit: false,
    is_protected: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  };

  static users = [];
  static currentUser = null;
  static isSupabaseAvailable = false;

  /**
   * Validation rigoureuse des règles de mot de passe :
   * - Longueur : 8 à 26 caractères
   * - Au moins 1 majuscule
   * - Au moins 1 minuscule
   * - Au moins 1 chiffre
   * - Au moins 1 caractère spécial
   */
  static validatePassword(password) {
    const pwd = password || '';
    const lengthOk = pwd.length >= 8 && pwd.length <= 26;
    const uppercaseOk = /[A-Z]/.test(pwd);
    const lowercaseOk = /[a-z]/.test(pwd);
    const numberOk = /[0-9]/.test(pwd);
    const specialOk = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?#~`]/.test(pwd);

    const errors = [];
    if (pwd.length < 8) errors.push("Au moins 8 caractères requis");
    if (pwd.length > 26) errors.push("Maximum 26 caractères autorisés");
    if (!uppercaseOk) errors.push("Au moins une majuscule (A-Z) requise");
    if (!lowercaseOk) errors.push("Au moins une minuscule (a-z) requise");
    if (!numberOk) errors.push("Au moins un chiffre (0-9) requis");
    if (!specialOk) errors.push("Au moins un caractère spécial requis (!@#$%^&*...)");

    const isValid = lengthOk && uppercaseOk && lowercaseOk && numberOk && specialOk;

    return {
      isValid,
      lengthOk,
      uppercaseOk,
      lowercaseOk,
      numberOk,
      specialOk,
      errors
    };
  }

  /**
   * Génération automatique d'un mot de passe temporaire robuste respectant les règles
   */
  static generateTemporaryPassword() {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const specials = '!@#$%&*';

    let pwd = '';
    pwd += uppers[Math.floor(Math.random() * uppers.length)];
    pwd += lowers[Math.floor(Math.random() * lowers.length)];
    pwd += digits[Math.floor(Math.random() * digits.length)];
    pwd += specials[Math.floor(Math.random() * specials.length)];

    const all = uppers + lowers + digits + specials;
    for (let i = 0; i < 8; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }

    return pwd.split('').sort(() => 0.5 - Math.random()).join('');
  }

  /**
   * Hachage cryptographique sécurisé SHA-256 avec sel via WebCrypto
   */
  static async hashPassword(password) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("L'API WebCrypto n'est pas supportée sur ce navigateur.");
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(this.SALT + (password || ''));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Initialisation du gestionnaire d'authentification
   */
  static async init() {
    // 1. Chargement du cache local
    this.loadFromLocalStorage();

    // 2. Vérification / Restauration de la session active
    this.restoreSession();

    // 3. Tentative de synchronisation avec Supabase en arrière-plan sans bloquer l'initialisation
    try {
      this.syncFromSupabase().catch(e => {
        console.info("Info Supabase app_users (mode local actif) :", e ? e.message : e);
      });
    } catch (e) {
      console.info("Info Supabase app_users (mode local actif) :", e ? e.message : e);
    }
  }

  static loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.users = parsed;
        }
      }
    } catch (e) {
      console.warn("Erreur lecture utilisateurs locaux :", e);
    }

    if (!this.users) this.users = [];

    // Si 'admin' n'existe pas, on l'injecte
    if (!this.users.some(u => u.username.toLowerCase() === 'admin')) {
      this.users = [this.DEFAULT_ADMIN, ...this.users.filter(u => u.username.toLowerCase() !== 'admin')];
    }

    // S'assurer que le compte test invité est toujours présent et intègre
    const testIdx = this.users.findIndex(u => u.username.toLowerCase() === 'test');
    if (testIdx === -1) {
      this.users.push(this.DEFAULT_TEST_USER);
    } else {
      this.users[testIdx].password_hash = this.DEFAULT_TEST_HASH;
      this.users[testIdx].role = 'test';
      this.users[testIdx].can_upload = false;
      this.users[testIdx].can_edit = false;
      this.users[testIdx].is_protected = true;
    }

    this.saveToLocalStorage();
  }

  static saveToLocalStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.users));
    } catch (e) {
      console.warn("Erreur sauvegarde utilisateurs locaux :", e);
    }
  }

  static restoreSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        // Vérifie si l'utilisateur existe toujours dans la liste
        const matchedUser = this.users.find(u => u.id === session.id || u.username === session.username);
        if (matchedUser) {
          this.currentUser = {
            id: matchedUser.id,
            username: matchedUser.username,
            role: matchedUser.role,
            can_upload: matchedUser.can_upload,
            can_edit: matchedUser.can_edit
          };
          return;
        }
      }
    } catch (e) {
      console.warn("Erreur restauration session :", e);
    }
    this.currentUser = null;
  }

  static isAuthenticated() {
    return this.currentUser !== null;
  }

  static isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  }

  static hasPermission(permissionName) {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'admin') return true;
    return Boolean(this.currentUser[permissionName]);
  }

  static getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Connexion utilisateur
   */
  static async login(username, password) {
    const rawUser = (username || '').trim().normalize('NFC');
    const cleanUser = rawUser.toLowerCase();
    const cleanPwd = (password || '').trim().normalize('NFC');

    if (!cleanUser || !cleanPwd) {
      return { success: false, error: "Veuillez saisir votre identifiant et votre mot de passe." };
    }

    // Normalisation pour gestion des séparateurs (espaces, tirets, points)
    const normUser = cleanUser.replace(/[-.]/g, ' ').replace(/\s+/g, ' ');

    // 1. Chercher d'abord une correspondance exacte du nom d'utilisateur (insensible à la casse et accents)
    let candidateUsers = (this.users || []).filter(u => {
      const uClean = (u.username || '').trim().normalize('NFC').toLowerCase();
      const uNorm = uClean.replace(/[-.]/g, ' ').replace(/\s+/g, ' ');
      return uClean === cleanUser || uNorm === normUser;
    });

    // 2. Si aucune correspondance exacte, chercher par prénom (ex: 'Serge' correspond à 'Serge Nicolas' ou 'Serge Martinet')
    if (candidateUsers.length === 0) {
      candidateUsers = (this.users || []).filter(u => {
        const parts = (u.username || '').trim().normalize('NFC').toLowerCase().split(/\s+/);
        return parts.length > 0 && parts[0] === cleanUser;
      });
    }

    if (candidateUsers.length === 0) {
      return { success: false, error: "Identifiant ou mot de passe incorrect." };
    }

    // 3. Tester chaque candidat avec le mot de passe fourni
    let matchedUser = null;
    for (const user of candidateUsers) {
      // A. Hash principal exact
      const inputHash = await this.hashPassword(cleanPwd);
      let isMatch = (inputHash === user.password_hash);

      // B. Variantes de casse
      if (!isMatch) {
        const lowerHash = await this.hashPassword(cleanPwd.toLowerCase());
        if (lowerHash === user.password_hash) isMatch = true;
      }
      if (!isMatch) {
        const upperHash = await this.hashPassword(cleanPwd.toUpperCase());
        if (upperHash === user.password_hash) isMatch = true;
      }

      // C. Mot de passe initial égal au nom complet ou au prénom
      if (!isMatch && (cleanPwd.toLowerCase() === user.username.trim().normalize('NFC').toLowerCase() || cleanPwd.toLowerCase() === cleanUser)) {
        const targetUserHash = await this.hashPassword(user.username.trim());
        const targetUserLowerHash = await this.hashPassword(user.username.trim().toLowerCase());
        if (user.password_hash === targetUserHash || user.password_hash === targetUserLowerHash) {
          isMatch = true;
        }
      }

      if (isMatch) {
        matchedUser = user;
        break;
      }
    }

    // 4. Si aucun mot de passe n'a correspondu
    if (!matchedUser) {
      if (candidateUsers.length > 1) {
        const names = candidateUsers.map(u => u.username).join(' ou ');
        return { 
          success: false, 
          error: `Plusieurs adhérents portent le prénom « ${rawUser} ». Veuillez préciser votre nom complet (ex : ${names}).` 
        };
      }
      return { success: false, error: "Identifiant ou mot de passe incorrect." };
    }

    // Session validée
    this.currentUser = {
      id: matchedUser.id,
      username: matchedUser.username,
      role: matchedUser.role,
      can_upload: matchedUser.can_upload,
      can_edit: matchedUser.can_edit
    };

    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(this.currentUser));
    } catch (e) {}

    return {
      success: true,
      user: this.currentUser,
      isInitialAdminPassword: (matchedUser.username === 'admin' && matchedUser.password_hash === this.DEFAULT_ADMIN_HASH)
    };
  }

  /**
   * Déconnexion
   */
  static logout() {
    this.currentUser = null;
    try {
      localStorage.removeItem(this.SESSION_KEY);
    } catch (e) {}
  }

  /**
   * Changement de mot de passe par l'utilisateur connecté
   */
  static async changePassword(username, currentPassword, newPassword) {
    const cleanUser = (username || '').trim().toLowerCase();
    if (cleanUser === 'test') {
      return { success: false, error: "Le mot de passe du compte Invité 'test' est fixe et ne peut pas être modifié." };
    }
    const user = this.users.find(u => u.username.toLowerCase() === cleanUser);

    if (!user) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    // Vérification de l'ancien mot de passe
    const currentHash = await this.hashPassword(currentPassword);
    if (currentHash !== user.password_hash) {
      return { success: false, error: "L'ancien mot de passe est incorrect." };
    }

    // Validation du nouveau mot de passe
    const val = this.validatePassword(newPassword);
    if (!val.isValid) {
      return { success: false, error: val.errors.join(' • ') };
    }

    // Application du nouveau hash
    user.password_hash = await this.hashPassword(newPassword);
    user.updated_at = new Date().toISOString();

    this.saveToLocalStorage();

    // Push vers Supabase si disponible
    await this.pushUserToSupabase(user);

    return { success: true };
  }

  /**
   * Création d'un nouvel utilisateur par l'administrateur
   */
  static async createUser({ username, password, email = null, can_upload, can_edit, role = 'user' }) {
    if (!this.isAdmin()) {
      return { success: false, error: "Action réservée à l'administrateur." };
    }

    const cleanUser = (username || '').trim();
    if (!cleanUser || cleanUser.length < 2) {
      return { success: false, error: "Le nom d'utilisateur doit comporter au moins 2 caractères." };
    }

    if (cleanUser.length > 50) {
      return { success: false, error: "Le nom d'utilisateur ne peut pas dépasser 50 caractères." };
    }

    // Autorise lettres (avec accents français), chiffres, espaces, tirets, apostrophes et underscores
    if (!/^[a-zA-ZÀ-ÿ0-9\s_\-'.]{2,50}$/.test(cleanUser)) {
      return { 
        success: false, 
        error: "Règle non respectée : Le nom d'utilisateur peut contenir des lettres (avec accents), chiffres, espaces, tirets (-), apostrophes (') et underscores (_)." 
      };
    }

    if (this.users.some(u => u.username.toLowerCase() === cleanUser.toLowerCase())) {
      return { success: false, error: `L'utilisateur « ${cleanUser} » existe déjà.` };
    }

    const cleanPwd = (password || '').trim();
    if (!cleanPwd) {
      return { success: false, error: "Veuillez renseigner un mot de passe temporaire." };
    }

    // Validation email si renseigné (optionnel)
    const cleanEmail = (email || '').trim().toLowerCase() || null;
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: "Format d'adresse email invalide." };
    }

    // Si le mot de passe est égal au nom d'utilisateur (par défaut club), il est accepté directement.
    // Sinon, il doit faire au moins 4 caractères (ou satisfaire les critères).
    const isEqualToUsername = (cleanPwd.toLowerCase() === cleanUser.toLowerCase());
    if (!isEqualToUsername && cleanPwd.length < 4) {
      return { success: false, error: "Le mot de passe temporaire doit comporter au moins 4 caractères (ou être identique au nom d'utilisateur)." };
    }

    const newUser = {
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      username: cleanUser,
      email: cleanEmail,
      password_hash: await this.hashPassword(cleanPwd),
      role: role || 'user',
      can_upload: Boolean(can_upload),
      can_edit: Boolean(can_edit),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.users.push(newUser);
    this.saveToLocalStorage();

    // Push vers Supabase
    const isSynced = await this.pushUserToSupabase(newUser);

    return { success: true, user: newUser, cloudSynced: Boolean(isSynced) };
  }

  /**
   * Mise à jour de l'email d'un utilisateur par l'admin
   */
  static async updateUserEmail(userId, email) {
    if (!this.isAdmin()) {
      return { success: false, error: "Action réservée à l'administrateur." };
    }

    const user = this.users.find(u => u.id === userId);
    if (!user) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    const cleanEmail = (email || '').trim().toLowerCase() || null;
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: "Format d'adresse email invalide." };
    }

    user.email = cleanEmail;
    user.updated_at = new Date().toISOString();
    this.saveToLocalStorage();
    await this.pushUserToSupabase(user);

    return { success: true, email: cleanEmail };
  }

  /**
   * Recherche un utilisateur pour la procédure mot de passe oublié
   */
  static findUserForPasswordReset(username) {
    const rawUser = (username || '').trim().normalize('NFC');
    const cleanUser = rawUser.toLowerCase();
    if (!cleanUser) return null;
    const normUser = cleanUser.replace(/[-.]/g, ' ').replace(/\s+/g, ' ');

    let user = (this.users || []).find(u => {
      const uClean = (u.username || '').trim().normalize('NFC').toLowerCase();
      const uNorm = uClean.replace(/[-.]/g, ' ').replace(/\s+/g, ' ');
      return uClean === cleanUser || uNorm === normUser;
    });

    if (!user) {
      const matches = (this.users || []).filter(u => {
        const parts = (u.username || '').trim().normalize('NFC').toLowerCase().split(/\s+/);
        return parts.length > 0 && parts[0] === cleanUser;
      });
      if (matches.length === 1) user = matches[0];
    }
    return user;
  }

  /**
   * Procédure 'Mot de passe oublié' : génère un mot de passe temporaire et prépare l'email
   */
  static async resetPasswordAndPrepareEmail(username) {
    const user = this.findUserForPasswordReset(username);
    if (!user) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    if (user.username.toLowerCase() === 'test') {
      return { success: false, error: "Le compte Invité 'test' est un compte fixe. Son mot de passe est 'test'." };
    }

    if (!user.email || !user.email.trim()) {
      return { 
        success: false, 
        noEmail: true, 
        error: "pas d'adresse mail associée à cet utilisateur" 
      };
    }

    const tempPwd = this.generateTemporaryPassword();
    user.password_hash = await this.hashPassword(tempPwd);
    user.updated_at = new Date().toISOString();

    this.saveToLocalStorage();
    await this.pushUserToSupabase(user);

    const subject = "Votre mot de passe Map & Rando / RandoFinder";
    const body = `Bonjour ${user.username},\n\nVoici votre nouveau mot de passe temporaire pour vous connecter à Map & Rando / RandoFinder :\n\nIdentifiant : ${user.username}\nMot de passe : ${tempPwd}\n\nVous pourrez modifier ce mot de passe à tout moment après votre connexion.\n\nBonne randonnée !\nLes Randonneurs Sanaryens\nhttps://jusitafu.github.io/RandoFinder/`;

    const mailtoUrl = `mailto:${encodeURIComponent(user.email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    return {
      success: true,
      username: user.username,
      email: user.email.trim(),
      tempPassword: tempPwd,
      mailtoUrl: mailtoUrl
    };
  }

  static async updateUserPermissions(userId, { can_upload, can_edit, role }) {
    if (!this.isAdmin()) {
      return { success: false, error: "Action réservée à l'administrateur." };
    }

    const user = this.users.find(u => u.id === userId);
    if (!user) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    if (user.username === 'admin') {
      // L'administrateur principal garde tous les droits
      user.can_upload = true;
      user.can_edit = true;
      user.role = 'admin';
    } else if (user.username === 'test') {
      user.can_upload = false;
      user.can_edit = false;
      user.role = 'test';
      user.is_protected = true;
    } else {
      if (can_upload !== undefined) user.can_upload = Boolean(can_upload);
      if (can_edit !== undefined) user.can_edit = Boolean(can_edit);
      if (role !== undefined) user.role = role;
    }

    user.updated_at = new Date().toISOString();
    this.saveToLocalStorage();

    await this.pushUserToSupabase(user);

    // Mettre à jour la session courante si l'utilisateur modifié est soi-même
    if (this.currentUser && this.currentUser.id === user.id) {
      this.currentUser.can_upload = user.can_upload;
      this.currentUser.can_edit = user.can_edit;
      this.currentUser.role = user.role;
      try {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(this.currentUser));
      } catch (e) {}
    }

    return { success: true, user };
  }

  /**
   * Réinitialisation de mot de passe par l'admin (avec génération ou valeur définie)
   */
  static async resetUserPassword(userId, newTempPassword) {
    if (!this.isAdmin()) {
      return { success: false, error: "Action réservée à l'administrateur." };
    }

    const user = this.users.find(u => u.id === userId);
    if (!user) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    if (user.username === 'test' || user.role === 'test') {
      return { success: false, error: "Le mot de passe du compte Invité 'test' est fixe et ne peut pas être réinitialisé." };
    }

    const tempPwd = (newTempPassword || user.username || this.generateTemporaryPassword()).trim();
    if (!tempPwd) {
      return { success: false, error: "Le mot de passe temporaire ne peut pas être vide." };
    }

    user.password_hash = await this.hashPassword(tempPwd);
    user.updated_at = new Date().toISOString();

    this.saveToLocalStorage();
    await this.pushUserToSupabase(user);

    return { success: true, tempPassword: tempPwd, username: user.username };
  }

  /**
   * Suppression d'un utilisateur par l'admin
   */
  static async deleteUser(userId) {
    if (!this.isAdmin()) {
      return { success: false, error: "Action réservée à l'administrateur." };
    }

    const user = this.users.find(u => u.id === userId);
    if (!user) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    if (user.username === 'admin') {
      return { success: false, error: "Le compte administrateur principal ne peut pas être supprimé." };
    }
    if (user.username === 'test' || user.is_protected) {
      return { success: false, error: "Le compte Invité 'test' est un compte système protégé et ne peut pas être supprimé." };
    }

    this.users = this.users.filter(u => u.id !== userId);
    this.saveToLocalStorage();

    await this.deleteUserFromSupabase(userId);

    return { success: true };
  }

  /**
   * Liste tous les utilisateurs (pour affichage admin)
   */
  static getAllUsers() {
    return (this.users || []).map(u => ({
      id: u.id,
      username: u.username,
      email: u.email || '',
      role: u.role,
      can_upload: u.can_upload,
      can_edit: u.can_edit,
      is_protected: Boolean(u.is_protected || u.username === 'admin' || u.username === 'test'),
      created_at: u.created_at,
      updated_at: u.updated_at
    }));
  }

  // =========================================================================
  // SUPABASE CLOUD USER SYNC
  // =========================================================================

  static getSupabaseConfig() {
    try {
      const url = localStorage.getItem('sanary_supabase_url') || (window.APP_CONFIG && window.APP_CONFIG.supabaseUrl) || '';
      const key = localStorage.getItem('sanary_supabase_key') || (window.APP_CONFIG && window.APP_CONFIG.supabaseKey) || '';
      return { url: url.replace(/\/+$/, ''), key: key.trim() };
    } catch (e) {
      const url = (window.APP_CONFIG && window.APP_CONFIG.supabaseUrl) || '';
      const key = (window.APP_CONFIG && window.APP_CONFIG.supabaseKey) || '';
      return { url: url.replace(/\/+$/, ''), key: key.trim() };
    }
  }

  /**
   * Synchronisation depuis la table Supabase `app_users`
   */
  static async syncFromSupabase() {
    const { url, key } = this.getSupabaseConfig();
    if (!url || !key) return { success: false, reason: 'config_missing' };

    try {
      const apiUrl = `${url}/rest/v1/app_users?select=*`;
      const resp = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      });

      if (resp.status === 404) {
        // Table non existante pour le moment, fallback local transparent
        this.isSupabaseAvailable = false;
        return { success: false, reason: 'table_not_found' };
      }

      if (!resp.ok) {
        this.isSupabaseAvailable = false;
        return { success: false, reason: 'http_error', status: resp.status };
      }

      const cloudRows = await resp.json();
      if (Array.isArray(cloudRows)) {
        this.isSupabaseAvailable = true;

        // Fusion : les comptes distants font foi
        const mergedMap = new Map();
        
        // Charge d'abord le local
        this.users.forEach(u => mergedMap.set(u.username.toLowerCase(), u));
        
        // Remplace/Ajoute avec les données du cloud
        cloudRows.forEach(row => {
          mergedMap.set(row.username.toLowerCase(), {
            id: row.id,
            username: row.username,
            password_hash: row.password_hash,
            role: row.role || 'user',
            can_upload: Boolean(row.can_upload),
            can_edit: Boolean(row.can_edit),
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString()
          });
        });

        this.users = Array.from(mergedMap.values());

        // S'assurer que le compte admin existe
        if (!this.users.some(u => u.username === 'admin')) {
          this.users.unshift(this.DEFAULT_ADMIN);
          await this.pushUserToSupabase(this.DEFAULT_ADMIN);
        }

        // S'assurer que le compte invité test existe
        if (!this.users.some(u => u.username === 'test')) {
          this.users.push(this.DEFAULT_TEST_USER);
          await this.pushUserToSupabase(this.DEFAULT_TEST_USER);
        } else {
          const t = this.users.find(u => u.username === 'test');
          if (t) {
            t.password_hash = this.DEFAULT_TEST_HASH;
            t.role = 'test';
            t.can_upload = false;
            t.can_edit = false;
            t.is_protected = true;
          }
        }

        this.saveToLocalStorage();
        return { success: true, count: cloudRows.length };
      }
      return { success: false, reason: 'invalid_format' };
    } catch (e) {
      this.isSupabaseAvailable = false;
      return { success: false, reason: 'network_error', message: e.message };
    }
  }

  /**
   * Push d'un utilisateur vers Supabase
   */
  static async pushUserToSupabase(user) {
    const { url, key } = this.getSupabaseConfig();
    if (!url || !key) return false;

    const payload = [{
      id: user.id,
      username: user.username,
      password_hash: user.password_hash,
      role: user.role,
      can_upload: user.can_upload,
      can_edit: user.can_edit,
      updated_at: new Date().toISOString()
    }];

    try {
      const resp = await fetch(`${url}/rest/v1/app_users?on_conflict=username`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });
      return resp.ok;
    } catch (e) {
      return false;
    }
  }

  /**
   * Export des utilisateurs en JSON pour sauvegarde ou transfert multi-appareils
   */
  static exportUsersJSON() {
    return JSON.stringify(this.users, null, 2);
  }

  /**
   * Importation de comptes utilisateurs depuis un fichier JSON
   */
  static async importUsersJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data)) return { success: false, error: "Format JSON invalide (un tableau est attendu)." };
      const mergedMap = new Map();
      this.users.forEach(u => mergedMap.set(u.username.toLowerCase(), u));
      let added = 0;
      for (const item of data) {
        if (item && item.username && item.password_hash) {
          const uObj = {
            id: item.id || ('user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
            username: item.username,
            password_hash: item.password_hash,
            role: item.role || 'user',
            can_upload: Boolean(item.can_upload),
            can_edit: Boolean(item.can_edit),
            created_at: item.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          mergedMap.set(item.username.toLowerCase(), uObj);
          added++;
          await this.pushUserToSupabase(uObj);
        }
      }
      this.users = Array.from(mergedMap.values());
      if (!this.users.some(u => u.username === 'admin')) {
        this.users.unshift(this.DEFAULT_ADMIN);
      }
      this.saveToLocalStorage();
      return { success: true, count: this.users.length, imported: added };
    } catch (e) {
      return { success: false, error: "Erreur JSON : " + e.message };
    }
  }

  /**
   * Suppression d'un utilisateur sur Supabase
   */
  static async deleteUserFromSupabase(userId) {
    const { url, key } = this.getSupabaseConfig();
    if (!url || !key) return false;

    try {
      const resp = await fetch(`${url}/rest/v1/app_users?id=eq.${userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      return resp.ok;
    } catch (e) {
      return false;
    }
  }

  /**
   * Code SQL à exécuter dans Supabase pour créer la table app_users
   */
  static getSupabaseTableSQL() {
    return `-- ===============================================================
-- 1. TABLE DES UTILISATEURS (Comptes, mots de passe cryptés, droits)
-- ===============================================================
CREATE TABLE IF NOT EXISTS public.app_users (
  id text PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'user',
  can_upload boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for app_users" ON public.app_users;
CREATE POLICY "Allow public read-write for app_users"
  ON public.app_users FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

INSERT INTO public.app_users (id, username, password_hash, role, can_upload, can_edit)
VALUES ('user_admin', 'admin', '43b8058a90e45ee18f465adfea6bcfad03871c8ca6f736381b95669265c95715', 'admin', true, true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO public.app_users (id, username, password_hash, role, can_upload, can_edit)
VALUES ('user_test', 'test', '250e312ff25a26c92fd9f381c65090e077fdc1a471e7fd98c567b768674f0946', 'test', false, false)
ON CONFLICT (username) DO NOTHING;

-- ===============================================================
-- 2. TABLE DES RANDONNÉES SANARYENS (Base active officielle)
-- ===============================================================
CREATE TABLE IF NOT EXISTS public.randonnees_sanaryens (
  id text PRIMARY KEY,
  name text NOT NULL,
  distance_km numeric,
  elevation_gain numeric,
  elevation_loss numeric DEFAULT 0,
  min_elevation numeric DEFAULT 0,
  max_elevation numeric DEFAULT 0,
  start_lat numeric,
  start_lon numeric,
  estimated_duration text,
  notes text,
  gpx_url text,
  raw_gpx text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.randonnees_sanaryens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for randonnees_sanaryens" ON public.randonnees_sanaryens;
CREATE POLICY "Allow public read-write for randonnees_sanaryens"
  ON public.randonnees_sanaryens FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- ===============================================================
-- 3. TABLE DES RANDONNÉES JLDAPPS (Base historique sanctuarisée)
-- ===============================================================
CREATE TABLE IF NOT EXISTS public.randonnees (
  id text PRIMARY KEY,
  name text NOT NULL,
  distance_km numeric,
  elevation_gain numeric,
  elevation_loss numeric DEFAULT 0,
  min_elevation numeric DEFAULT 0,
  max_elevation numeric DEFAULT 0,
  start_lat numeric,
  start_lon numeric,
  estimated_duration text,
  notes text,
  gpx_url text,
  raw_gpx text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.randonnees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for randonnees" ON public.randonnees;
CREATE POLICY "Allow public read-write for randonnees"
  ON public.randonnees FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- ===============================================================
-- 4. BUCKET DE STOCKAGE DES FICHIERS GPX
-- ===============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('traces-gpx', 'traces-gpx', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public uploads on traces-gpx" ON storage.objects;
CREATE POLICY "Allow public uploads on traces-gpx"
  ON storage.objects FOR ALL TO anon, authenticated
  USING (bucket_id = 'traces-gpx') WITH CHECK (bucket_id = 'traces-gpx');
`;
  }
}

// Export global pour RandoFinder
window.AuthManager = AuthManager;
