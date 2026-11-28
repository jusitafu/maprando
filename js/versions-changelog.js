/**
 * Historique officiel des versions de Map & Rando (depuis α2.0)
 * JLDApps 2026 — Mis à jour systématiquement à chaque modification.
 */
(function () {
  window.MAPRANDO_CURRENT_VERSION = 'α3.10';
  window.MAPRANDO_CURRENT_DATE = '28/11/2026';

  window.MAPRANDO_VERSION_HISTORY = [
    {
      version: 'α3.10',
      date: '28/11/2026',
      builds: 'v256',
      title: 'Agrandissement proportionnel des barres basses & ordre échelle/Leaflet',
      details: 'Poignée d\'agrandissement (⇕) au survol du bord supérieur de la barre noire et des boutons blancs : glisser vers le haut/bas agrandit ou réduit proportionnellement toutes les barres (100 % à 145 %, mémorisé, double-clic = 100 %) sans chevauchement ; échelle graphique placée à gauche de l\'indication Leaflet.'
    },
    {
      version: 'α3.9',
      date: '28/11/2026',
      builds: 'v255',
      title: 'Alignement des barres basses anti-chevauchement & nettoyage en-tête',
      details: 'Barre noire (Échelle/GPS/UTM/Altitude) et boutons blancs (Légende, Imprimer, Cap, Mesurer) unifiés sur la même hauteur (44 px) sans chevauchement ; bouton Cadastre « Parcelles (0/50) » placé juste au-dessus de « Mesurer » ; échelle graphique et mention Leaflet alignées juste au-dessus de la barre noire ; suppression du badge v95 en haut à droite des cartes.'
    },
    {
      version: 'α3.8',
      date: '27/11/2026',
      builds: 'v253 – v254',
      title: 'Historique interactif des versions & harmonisation branding',
      details: 'Tableau interactif de l\'historique des versions depuis α2.0 accessible au clic sur « Map & Rando », mise à jour de la date officielle (27/11/2026), logo JLDApps restauré dans l\'en-tête d\'accueil et placement épuré sur la couverture du PDF (17 pages).'
    },
    {
      version: 'α3.7',
      date: '27/11/2026',
      builds: 'v245 – v252',
      title: 'Catalogue pleine page des 1 538 cartes IGN & Calanques',
      details: 'Nouvelle fiche pleine page (100vw × 100vh) dans Guides & Savoirs recensant les 1 537 feuilles IGN France métropolitaine (580 TOP 25 ET/OT + 957 Série Bleue SB) étendues à la carte spéciale IGN 89035 – Les Calanques (éd. 2025). Recherche instantanée, tri par colonne, info-bulles explicatives au survol et bouton « Voir sur la carte ».'
    },
    {
      version: 'α3.6',
      date: '27/11/2026',
      builds: 'v236 – v244',
      title: 'Clic direct cours d\'eau (IGN BD TOPO) & GR®, logo JLDApps, PPT',
      details: 'Détection et illumination instantanées au clic direct sur un cours d\'eau via l\'API officielle IGN WFS BDTOPO_V3:cours_d_eau et sur les GR® sur toutes les cartes (priorité au cours d\'eau sous le clic), fenêtre d\'info à droite du tracé, effacement complet via la croix ✕, logo JLDApps à gauche de chaque mention et présentation PowerPoint 17 slides.'
    },
    {
      version: 'α3.5',
      date: '26/11/2026',
      builds: 'v232 – v235',
      title: 'Recherche universelle des cours d\'eau & altitude LiDAR GPS',
      details: 'Recherche des cours d\'eau (IGN Hydrographie + OSM) avec classification (Fleuve, Rivière, Ruisseau, Torrent, Canal, Cascade) et animation d\'écoulement haute visibilité, altitude IGN RGE ALTI dans « Ma position GPS », et tracé affiné de la frontière franco-belge.'
    },
    {
      version: 'α3.4',
      date: '25/11/2026',
      builds: 'v226 – v231',
      title: 'Profil altimétrique avancé, pentes paramétrables & impression A4/A3',
      details: 'Auto-enrichissement altimétrique IGN RGE ALTI si profil à 0 m, impression pleine page A4/A3 paysage du profil, projection des sommets/waypoints/POI nommés, coloration et motifs hachurés paramétrables par tranches de pente % (montée & descente) et décodage XML complet.'
    },
    {
      version: 'α3.3',
      date: '24/11/2026',
      builds: 'v220 – v225',
      title: 'Cadastre officiel IGN France & gestionnaire de 50 parcelles',
      details: 'Intégration du calque transparent Cadastre officiel IGN (Parcellaire Express) avec lettres de sections, interrogation au clic (fenêtre flottante déplaçable/minimisable), recherche IGN par commune/section/numéro, coloration personnalisée jusqu\'à 50 parcelles et calcul de surface cumulée.'
    },
    {
      version: 'α3.2',
      date: '23/11/2026',
      builds: 'v209 – v219',
      title: 'Ma position GPS, Satellite IGN BD ORTHO 20 cm & étanchéité vues',
      details: 'Bouton « Ma position GPS » dans les 2 barres de recherche, dissociation stricte Satellite IGN BD ORTHO 20 cm (avec date de prise de vue) vs Esri, bouton œil individuel en multi-traces, étanchéité absolue Randonner / Cartes & Outils et enrichissement Wikipédia conditionnel du patrimoine.'
    },
    {
      version: 'α3.1',
      date: '22/11/2026',
      builds: 'v200 – v208',
      title: 'Patrimoine touristique, 65 sigles officiels & comparatif 10 solutions',
      details: 'Module Patrimoine & Curiosités touristiques (pastilles dorées clignotantes, ajout en 1 clic comme jalon, copie GPS), glossaire exhaustif des 65 sigles & acronymes officiels, grand comparatif 10 solutions dans le Mode d\'Emploi Web & PDF (17 pages) et aperçu des 2 chemins retour au départ.'
    },
    {
      version: 'α3.0',
      date: '22/11/2026',
      builds: 'v190 – v199',
      title: 'Refonte majeure α3.0, Fiche Topo IGN A4 & modale JLDApps',
      details: 'Nouvelle ergonomie en 2 étapes, réduction/agrandissement des panneaux (−/□), Fiche Topo sur fond IGN TOP 25 officiel A4 paysage, modale « Autres applications JLDApps » (WaterMetrics, FuelCoPilot) et ouverture optimisée de Cartes & Outils au 1:25 000.'
    },
    {
      version: 'α2.5',
      date: '22/11/2026',
      builds: 'v189',
      title: 'RGPD complet & politique de confidentialité',
      details: 'Mise à jour exhaustive du paragraphe RGPD (absence de géolocalisation serveur, traitement des emails et stockage des traces du module club).'
    },
    {
      version: 'α2.4',
      date: '22/11/2026',
      builds: 'v188',
      title: 'Info-bulles du comparatif & synchronisation des ressources',
      details: 'Clarification des mentions et info-bulles du tableau comparatif et synchronisation complète CSS / générateur PDF / déploiement.'
    },
    {
      version: 'α2.3',
      date: '22/11/2026',
      builds: 'v187',
      title: 'RGPD dans les CGU & mise à jour waypoints',
      details: 'Intégration des mentions RGPD dans les Mentions Légales & CGU et mise à jour de la section waypoints dans le mode d\'emploi et le comparatif.'
    },
    {
      version: 'α2.2',
      date: '21/11/2026',
      builds: 'v186',
      title: 'Normalisation du contact email RandoFinder',
      details: 'Harmonisation de l\'objet d\'email de contact vers RandoFinder dans la fenêtre de suggestions.'
    },
    {
      version: 'α2.1',
      date: '21/11/2026',
      builds: 'v185',
      title: 'Stabilisation du panneau de contact mailto',
      details: 'Correction de la fermeture intempestive de la bulle de contact email au survol avec pontage fluide.'
    },
    {
      version: 'α2.0',
      date: '21/11/2026',
      builds: 'v184',
      title: 'Waypoints en mode édition & bascule coordonnées GPS',
      details: 'Ajout interactif de waypoints directement en mode édition GPX et bascule rapide d\'affichage des coordonnées GPS sur les traces.'
    }
  ];

  window.openVersionHistoryModal = function () {
    let modal = document.getElementById('modal-version-history');
    if (modal) {
      modal.remove();
    }

    const esc = (s) => String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const rowsHtml = window.MAPRANDO_VERSION_HISTORY.map((item, idx) => {
      const isCurrent = idx === 0;
      const rowBg = isCurrent
        ? 'bg-emerald-950/45 hover:bg-emerald-900/45'
        : 'hover:bg-slate-800/50';
      const badgeCls = isCurrent
        ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200'
        : 'bg-slate-800 border-slate-700 text-slate-200';
      const currentTag = isCurrent
        ? '<span class="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">Actuelle</span>'
        : '';
      return `
        <tr class="${rowBg} transition">
          <td class="px-4 py-3 whitespace-nowrap align-top">
            <span class="inline-block px-2.5 py-1 rounded-lg border font-mono text-sm font-black ${badgeCls}">${esc(item.version)}</span>${currentTag}
            <div class="text-[11px] text-slate-400 font-mono mt-1">${esc(item.builds)}</div>
          </td>
          <td class="px-4 py-3 whitespace-nowrap align-top font-mono text-sm text-slate-300">${esc(item.date)}</td>
          <td class="px-4 py-3 align-top">
            <div class="font-extrabold text-white text-sm sm:text-[15px] mb-0.5">${esc(item.title)}</div>
            <div class="text-xs sm:text-sm text-slate-300 leading-relaxed">${esc(item.details)}</div>
          </td>
        </tr>`;
    }).join('');

    modal = document.createElement('div');
    modal.id = 'modal-version-history';
    modal.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(2,6,23,0.88); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:16px;';

    modal.innerHTML = `
      <div class="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        <div class="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex-shrink-0">
          <div>
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase tracking-wider mb-1">
              <span>HISTORIQUE DES VERSIONS &bull; DEPUIS α2.0 &bull; <img src="images/logo_jldapps.png" alt="JLDApps" class="inline-block w-[1.2em] h-[1.2em] rounded-[3px] align-[-0.18em] mr-1 select-none" />JLDApps 2026</span>
            </div>
            <h3 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span>🗺️</span>
              <span>Évolution de Map &amp; Rando</span>
              <span class="text-xs sm:text-sm font-extrabold text-emerald-300 bg-emerald-950/90 px-2.5 py-0.5 rounded-full border border-emerald-500/40">${esc(window.MAPRANDO_CURRENT_VERSION)} (${esc(window.MAPRANDO_CURRENT_DATE)})</span>
            </h3>
          </div>
          <button type="button" id="btn-close-version-history"
                  class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-sm cursor-pointer transition border border-slate-700"
                  title="Fermer (Échap)">✕</button>
        </div>

        <div class="flex-1 min-h-0 overflow-auto p-4 sm:p-6">
          <div class="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/50">
            <table class="w-full text-left border-collapse">
              <thead class="sticky top-0 z-10 bg-slate-900 text-slate-200 border-b border-slate-700 text-xs font-extrabold uppercase tracking-wider">
                <tr>
                  <th class="px-4 py-3 whitespace-nowrap">Version</th>
                  <th class="px-4 py-3 whitespace-nowrap">Date</th>
                  <th class="px-4 py-3">Principales évolutions &amp; nouveautés</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/70">
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>

        <div class="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3 flex-shrink-0">
          <span class="text-xs text-slate-400">
            ${window.MAPRANDO_VERSION_HISTORY.length} jalons recensés depuis α2.0 (21/11/2026) — mis à jour automatiquement à chaque évolution.
          </span>
          <button type="button" id="btn-close-version-history-footer"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm cursor-pointer transition shadow-md">
            Fermer
          </button>
        </div>
      </div>
    `;

    const closeModal = () => {
      modal.remove();
      document.removeEventListener('keydown', onEsc);
    };
    const onEsc = (ev) => {
      if (ev.key === 'Escape') closeModal();
    };

    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) closeModal();
    });
    modal.querySelector('#btn-close-version-history').addEventListener('click', closeModal);
    modal.querySelector('#btn-close-version-history-footer').addEventListener('click', closeModal);
    document.addEventListener('keydown', onEsc);

    document.body.appendChild(modal);
  };
})();
