# -*- coding: utf-8 -*-
"""
Générateur du Mode d'Emploi PDF Exhaustif - Map & Rando by JLDApps 2026
Document haute définition 14 pages, 100% conforme à la réalité :
- Zéro fonction d'administration (création de comptes supprimée)
- Copies d'écran réelles issues de l'application
- Visualiseur Multi-traces GPX (1 à 3 traces)
- NOUVEAU Chapitre 8 : Créateur d'Itinéraire GPX (Auto-routage IGN/BRouter, ruban d'étapes A, B..., suppression 1-clic, déplacement à la souris et annulation par CTRL+Z)
- NOUVEAU Chapitre 9 : Modification de Trace GPX (Poignées de manipulation, déviation sur sentiers voisins, annulation par CTRL+Z et export GPX)
- Réciprocité complète Trace ↔ Profil Altimétrique
- Outils Cap, Mesure, 1 cm vrai, Imprimer une zone A4/A3
- Recherche universelle GR clignotants
- Carte spéciale Calanques 89035
- Module Randonner et 6 Fiches Guides & Savoirs
"""

import os
import sys
import base64
import subprocess
import shutil

WORKDIR = r"C:\Users\lesda\.gemini\antigravity\scratch\maprando"
SCREEN_DIR = os.path.join(WORKDIR, "manual_screens")
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(EDGE_EXE):
    EDGE_EXE = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"

def get_base64_img(path):
    if os.path.exists(path):
        mime = "image/png" if path.lower().endswith(".png") else "image/jpeg"
        with open(path, "rb") as f:
            return f"data:{mime};base64," + base64.b64encode(f.read()).decode("utf-8")
    return ""

logo_b64 = get_base64_img(os.path.join(WORKDIR, "logo.png"))

fig1_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig01_accueil.jpg"))
fig2_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig03_cartotheque_calques.jpg"))
fig3_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig04_carte_calanques.jpg"))
fig4_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig02_carte_globale_hud.jpg"))
fig5_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig05_recherche_sentier.jpg"))
fig6_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig06_mesure_cap_distance.jpg"))
fig7_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig07_traces_gpx_multi.jpg"))
fig7b_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig07b_creer_gpx.jpg"))
fig7c_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig07c_modifier_gpx.jpg"))
fig7d_b64 = get_base64_img(os.path.join(SCREEN_DIR, "v163_verified_slope_coloration.png"))
fig7e_b64 = get_base64_img(os.path.join(SCREEN_DIR, "v163_verified_merge_modal.png"))
fig8_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig08_profil_alti_synchro.jpg"))
fig9_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig09_impression_zone.jpg"))
fig10_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig10_module_randonner.jpg"))
fig11_b64 = get_base64_img(os.path.join(SCREEN_DIR, "fig11_guides_savoirs.jpg"))

print("Toutes les captures d'écran (dont les outils Pentes et Fusion GPX v163) sont chargées en mémoire.")

html_content = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Map & Rando - Mode d'Emploi Détaillé</title>
<style>
  @page {{
    size: A4 portrait;
    margin: 10mm 12mm 12mm 12mm;
  }}

  * {{
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }}

  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1e293b;
    background-color: #ffffff;
    font-size: 8.7pt;
    line-height: 1.33;
    margin: 0;
    padding: 0;
  }}

  .page-section {{
    height: 100%;
    min-height: 265mm;
    max-height: 272mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-before: always;
    break-before: page;
  }}

  .page-section.first-page {{
    page-break-before: avoid;
    break-before: avoid;
  }}

  .page-body {{
    flex: 1 1 auto;
  }}

  /* Typography */
  h1, h2, h3, h4 {{
    color: #0f172a;
    font-weight: 700;
    margin-top: 0;
  }}

  h1 {{
    font-size: 19pt;
    line-height: 1.15;
    margin-bottom: 3pt;
  }}

  h2 {{
    font-size: 12pt;
    color: #047857;
    border-bottom: 2px solid #047857;
    padding-bottom: 2pt;
    margin-bottom: 5pt;
  }}

  h3 {{
    font-size: 9.6pt;
    color: #0369a1;
    margin-top: 5pt;
    margin-bottom: 2pt;
  }}

  p {{
    margin: 0 0 4pt 0;
    text-align: justify;
  }}

  ul, ol {{
    margin: 2pt 0 4pt 14pt;
    padding: 0;
  }}

  li {{
    margin-bottom: 1.8pt;
  }}

  code {{
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
    background-color: #f1f5f9;
    padding: 1px 3px;
    border-radius: 3px;
    font-size: 8pt;
    color: #0f172a;
  }}

  /* Page Header & Footer */
  .page-header {{
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 2.5mm;
    margin-bottom: 3mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 8pt;
    color: #64748b;
    font-weight: 600;
  }}

  .page-header .brand {{
    display: flex;
    align-items: center;
    gap: 6px;
    color: #047857;
    font-weight: 700;
  }}

  .page-header img {{
    height: 14px;
    width: auto;
  }}

  .page-footer {{
    border-top: 1px solid #cbd5e1;
    padding-top: 2.5mm;
    margin-top: 2.5mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 7.5pt;
    color: #94a3b8;
  }}

  .page-footer .page-number {{
    font-weight: 700;
    color: #047857;
  }}

  /* Callout Boxes */
  .callout {{
    background-color: #f0fdf4;
    border-left: 3.5px solid #10b981;
    border-radius: 4px;
    padding: 4.5pt 7pt;
    margin: 4.5pt 0;
    font-size: 8.2pt;
  }}

  .callout.info {{
    background-color: #f0f9ff;
    border-left-color: #0284c7;
  }}

  .callout.warning {{
    background-color: #fffbeb;
    border-left-color: #f59e0b;
  }}

  .callout-title {{
    font-weight: 700;
    color: #065f46;
    margin-bottom: 1.5pt;
    display: flex;
    align-items: center;
    gap: 4px;
  }}

  .callout.info .callout-title {{
    color: #0369a1;
  }}

  .callout.warning .callout-title {{
    color: #b45309;
  }}

  /* Image Box */
  .figure-box {{
    margin: 4pt 0;
    background-color: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 3.5pt;
    text-align: center;
  }}

  .figure-box img {{
    max-width: 100%;
    max-height: 94mm;
    height: auto;
    border-radius: 4px;
    display: block;
    margin: 0 auto;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }}

  .figure-caption {{
    font-size: 7.3pt;
    color: #64748b;
    margin-top: 2.5pt;
    font-style: italic;
  }}

  /* Badges */
  .badge {{
    display: inline-block;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 7.5pt;
    font-weight: 700;
  }}
  .badge-green {{ background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }}
  .badge-blue {{ background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }}
  .badge-purple {{ background-color: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe; }}
  .badge-amber {{ background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; }}

  /* Cover Grid */
  .toc-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4pt;
    margin-top: 4pt;
  }}

  .toc-item {{
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #047857;
    border-radius: 4px;
    padding: 3.5pt 6pt;
  }}

  .toc-item .num {{
    font-weight: 800;
    color: #047857;
    font-size: 8.5pt;
  }}

  .toc-item .title {{
    font-weight: 700;
    color: #0f172a;
    font-size: 8.2pt;
  }}

  .toc-item .desc {{
    font-size: 7.2pt;
    color: #64748b;
    margin-top: 1pt;
    line-height: 1.25;
  }}
</style>
</head>
<body>

  <!-- ===================================================================== -->
  <!-- PAGE 1 : COUVERTURE & SOMMAIRE OFFICIEL DES 13 CHAPITRES              -->
  <!-- ===================================================================== -->
  <section class="page-section first-page">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>GUIDE OFFICIEL DE L'UTILISATEUR</div>
    </div>

    <div class="page-body">
      <div style="text-align: center; margin-top: 6pt; margin-bottom: 8pt;">
        <div class="badge badge-green" style="font-size: 8pt; padding: 2px 10px; margin-bottom: 4pt;">MANUEL TECHNIQUE &amp; PRATIQUE OFFICIEL • ÉDITION 2026</div>
        <h1 style="font-size: 18pt; margin-bottom: 2pt; color: #047857;">Map &amp; Rando by JLDApps</h1>
        <div style="font-size: 10.5pt; font-weight: 700; color: #0369a1; margin-bottom: 4pt;">Mode d'Emploi Détaillé de l'Application</div>
        <p style="text-align: center; max-width: 480pt; margin: 0 auto; color: #475569; font-size: 8.5pt;">
          Cartographie Topographique Mondiale, Réseau National des GR®, Visualiseur &amp; Créateur de Traces GPX,
          Modification Interactive avec Auto-Routage Sentiers, Profils Altimétriques et Impression Grand Format.
        </p>
      </div>

      <div class="callout" style="margin-bottom: 6pt; padding: 4pt 7pt;">
        <div class="callout-title">🌿 La cartographie d'excellence au service de vos pas</div>
        <p style="margin: 0; font-size: 8.2pt;">
          Ce guide détaillé décrit l'intégralité des fonctionnalités, des outils et des indicateurs visuels disponibles sur chaque écran de <strong>Map &amp; Rando</strong>. Conçu pour tous les randonneurs, il détaille la cartothèque officielle, la création et la modification de traces GPX le long des sentiers, l'analyse altimétrique bidirectionnelle et les règles de sécurité indispensables en montagne.
        </p>
      </div>

      <div style="font-weight: 800; font-size: 9.5pt; color: #0f172a; margin-bottom: 2pt; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 2pt;">
        📑 SOMMAIRE GÉNÉRAL DES 14 CHAPITRES (15 PAGES)
      </div>

      <div class="toc-grid">
        <div class="toc-item">
          <div class="num">Chapitre 1 • Page 2</div>
          <div class="title">Écran d'Accueil &amp; Musique d'Ambiance</div>
          <div class="desc">Portail général, bouton musique sobre, alertes secours 112/114 et 3 espaces.</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 2 • Page 3</div>
          <div class="title">Cartothèque Officielle &amp; Calques Nationaux</div>
          <div class="desc">Fonds classés par drapeaux (France, Europe alphabétique), mondial et satellites HD.</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 3 • Page 4</div>
          <div class="title">Carte Spéciale IGN 89035 des Calanques</div>
          <div class="desc">Détection automatique au 1:15 000, emprise bordeaux et bouton retour ✕.</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 4 • Page 5</div>
          <div class="title">Bandeau HUD, Commune &amp; Altitude LiDAR HD</div>
          <div class="desc">Échelle 1/25000, 1 cm vrai, commune au curseur (Sanary), WGS84 et UTM.</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 5 • Page 6</div>
          <div class="title">Barre de Recherche Universelle &amp; GR® Clignotants</div>
          <div class="desc">Recherche de lieux, de GR® (GR 20, GR 34) et chemins célèbres (Stevenson).</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 6 • Page 7</div>
          <div class="title">Mesure de Cap (Azimut), Distance &amp; Carroyage UTM</div>
          <div class="desc">Outil Boussole (0-360°), règle métrique et grille kilométrique universelle.</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 7 • Page 8</div>
          <div class="title">Visualiseur Multi-traces GPX (1 à 3 traces)</div>
          <div class="desc">Palette de 6 couleurs, calcul IBP Index officiel, centrage 🎯 et suppression ✕.</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 8 • Page 9</div>
          <div class="title">Pentes &amp; Fusion GPX (Outils Avancés)</div>
          <div class="desc">Coloration 4 gradients de pente lissée &amp; fusion avec auto-routage des sentiers.</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 9 • Page 10</div>
          <div class="title">Créateur d'Itinéraire GPX (Auto-Routage)</div>
          <div class="desc">Tracé automatique sur sentiers IGN, ruban d'étapes (A, B...), déplacement et Ctrl+Z.</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 10 • Page 11</div>
          <div class="title">Modification de Trace GPX &amp; Découpage</div>
          <div class="desc">Poignées dynamiques, rectangle Supprimer zone et reconnexion automatique par sentiers.</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 11 • Page 12</div>
          <div class="title">Profil Altimétrique Interactif &amp; Synchronisé</div>
          <div class="desc">Réciprocité complète bidirectionnelle Trace ↔ Profil avec point rouge mobile.</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 12 • Page 13</div>
          <div class="title">Impression Haute Définition (« Imprimer une zone »)</div>
          <div class="desc">Tracé par rectangle ou 2 clics A4/A3, carroyage UTM, cartouche IGN officiel.</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 13 • Page 14</div>
          <div class="title">Module « Randonner » &amp; Catalogue Club</div>
          <div class="desc">Filtres multicritères, IBP 1 à 5, tableau triable et colonne « Ajoutée par ».</div>
        </div>

        <div class="toc-item">
          <div class="num">Chapitre 14 • Page 15</div>
          <div class="title">Guides &amp; Savoirs — 6 Fiches &amp; Sécurité</div>
          <div class="desc">GNSS/SBAS, LiDAR HD, barème IBP, check-list, secours satellite et montres.</div>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 1 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 2 : ÉCRAN D'ACCUEIL & MUSIQUE D'AMBIANCE                         -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 1 • ÉCRAN D'ACCUEIL</div>
    </div>

    <div class="page-body">
      <h2>🏠 1. Portail d'Accueil &amp; Ambiance Sonore Randonnée</h2>
      <p>
        Dès l'ouverture, <strong>Map &amp; Rando</strong> accueille le randonneur dans un univers épuré et immersif. L'écran principal présente une composition visuelle en 4 cadrans illustrant la variété des terrains (falaises maritimes, sentiers forestiers, crêtes calcaires et haute montagne).
      </p>

      <div class="figure-box">
        <img src="{fig1_b64}" alt="Écran d'Accueil">
        <div class="figure-caption">Figure 1 : Portail d'accueil avec les 3 portes d'accès, le lecteur audio d'ambiance et les bandeaux d'urgence 112 / 114.</div>
      </div>

      <h3>Les 3 Espaces Principaux de l'Application</h3>
      <ul>
        <li><strong>🗺️ Cartes &amp; Outils (Accès Libre) :</strong> la cartographie intégrale, l'affichage multi-traces GPX, les outils de mesure de cap, d'azimut, de carroyage UTM, de création et de modification de traces GPX.</li>
        <li><strong>🥾 Espace Randonner (Accès Club) :</strong> la base de données associative des randonnées validées, filtrable par rayon géographique, dénivelé et indice d'effort IBP Index.</li>
        <li><strong>📚 Guides &amp; Savoirs (Accès Libre) :</strong> 6 fiches didactiques sur le GPS différentiel, le LiDAR forestier, la sécurité en zone blanche, le secours satellite et les montres de sport.</li>
      </ul>

      <h3>Lecteur Audio d'Ambiance Sobre &amp; Respectueux</h3>
      <p>
        Un bouton discret situé en haut à droite permet d'activer une musique d'ambiance pastorale (vents, cloches et guitare acoustique). Ce lecteur respecte scrupuleusement le choix de l'utilisateur : il ne démarre jamais automatiquement, mémorise son état et se coupe immédiatement au clic.
      </p>

      <div class="callout warning">
        <div class="callout-title">🚨 Rappel des Numéros d'Urgence en Pleine Nature</div>
        En pied de page, deux boutons d'appel direct rappellent le <strong>112</strong> (numéro d'urgence européen accessible même sans carte SIM ni code PIN) et le <strong>114</strong> (numéro d'urgence national accessible par SMS en zone de couverture minimale).
      </div>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 2 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 3 : CARTOTHÈQUE OFFICIELLE & CALQUES NATIONAUX                   -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 2 • CARTOTHÈQUE OFFICIELLE</div>
    </div>

    <div class="page-body">
      <h2>🌍 2. Cartothèque Officielle &amp; Calques Internationaux</h2>
      <p>
        Map &amp; Rando fédère les serveurs cartographiques nationaux les plus rigoureux d'Europe et du Monde. L'icône des calques (en haut à droite) ouvre un menu hiérarchisé orné des drapeaux officiels pour un repérage immédiat.
      </p>

      <div class="figure-box">
        <img src="{fig2_b64}" alt="Sélecteur de Calques">
        <div class="figure-caption">Figure 2 : Menu des calques officiel avec drapeaux nationaux (France, Italie CAI, Suisse Swisstopo, Espagne IGN, etc.).</div>
      </div>

      <h3>Cartographie Nationale par Drapeaux</h3>
      <ul>
        <li><strong>🇫🇷 France (IGN Géoportail &amp; GeoPF) :</strong> Carte Topographique IGN (SCAN 25® au 1:25 000 classique et Plan IGN v2 haute lisibilité).</li>
        <li><strong>🇮🇹 Italie (Sentieri CAI &amp; IGM) :</strong> cartes officielles du Club Alpin Italien (CAI) et de l'Istituto Geografico Militare.</li>
        <li><strong>🇨🇭 Suisse (Swisstopo) :</strong> le standard mondial d'orfèvrerie cartographique avec estompage alpin au 1:25 000.</li>
        <li><strong>🇪🇸 Espagne (IGN Iberpix &amp; MTN) :</strong> cartographie de l'Instituto Geográfico Nacional avec les sentiers balisés GR®.</li>
        <li><strong>🇧🇪 Belgique (IGN/NGI Topo) :</strong> échelle 1:25 000 de l'Institut Géographique National de Belgique.</li>
        <li><strong>🇬🇧 Royaume-Uni (Ordnance Survey) :</strong> célèbre série Explorer au 1:25 000 pour l'Angleterre, le Pays de Galles et l'Écosse.</li>
        <li><strong>🇳🇴 Norvège (Kartverket) &amp; 🇸🇪 Suède (Lantmäteriet) :</strong> cartes scandinaves haute précision pour les grands treks polaires.</li>
      </ul>

      <h3>Fonds Mondiaux &amp; Imagerie Satellite Haute Résolution</h3>
      <ul>
        <li><strong>OpenTopoMap &amp; OSM Outdoors :</strong> sentiers balisés mondiaux avec courbes de niveau tous les 10 à 20 mètres.</li>
        <li><strong>Imagerie Satellite HD Orthophoto :</strong> photographies aériennes haute résolution (IGN BD ORTHO® 20 cm en France et ESRI World Imagery à l'international).</li>
      </ul>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 3 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 4 : CARTE SPÉCIALE IGN 89035 DES CALANQUES                       -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 3 • CARTE DES CALANQUES</div>
    </div>

    <div class="page-body">
      <h2>🌊 3. Carte Spéciale IGN 89035 des Calanques au 1:15 000</h2>
      <p>
        Le Parc National des Calanques présente une topographie côtière d'une verticalité extrême exigeant une précision supérieure au standard 1:25 000. Map &amp; Rando intègre la célébrissime carte d'exception <strong>IGN 89035 au 1:15 000</strong>.
      </p>

      <div class="figure-box">
        <img src="{fig3_b64}" alt="Carte des Calanques">
        <div class="figure-caption">Figure 3 : Affichage de la carte IGN 89035 des Calanques au 1:15 000 avec emprise géographique bordeaux et bouton croix de fermeture ✕.</div>
      </div>

      <h3>Détection Géographique Automatique</h3>
      <p>
        Dès que votre navigation amène la carte au-dessus du massif des Calanques, <strong>Map &amp; Rando</strong> détecte la zone géographique et affiche un bandeau discret proposant d'activer la carte 89035 en 1 clic.
      </p>

      <h3>Caractéristiques d'Excellence de l'Édition 89035</h3>
      <ul>
        <li><strong>Échelle ultra-précise au 1:15 000 :</strong> 1 cm sur la carte représente exactement 150 mètres sur le terrain, permettant de distinguer chaque vire rocheuse, ressaut et calanque encaissée (En-Vau, Sormiou, Sugiton, Port-Pin, Morgiou).</li>
        <li><strong>Emprise géographique matérialisée :</strong> un cadre bordeaux élégant matérialise le périmètre exact de la carte spéciale de Marseille à La Ciotat.</li>
        <li><strong>Tracé exhaustif des sentiers balisés &amp; cotations :</strong> balisages officiels du Parc National, sentiers vertigineux, passages équipés de chaînes et voies d'escalade côtières.</li>
        <li><strong>Bouton de fermeture immédiate (✕) :</strong> un bouton flottant permet de revenir instantanément à votre carte de base précédente dès que vous le souhaitez.</li>
      </ul>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 4 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 5 : BANDEAU HUD, COMMUNE & ALTITUDE LIDAR HD                     -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 4 • BANDEAU HUD & REPERES</div>
    </div>

    <div class="page-body">
      <h2>📏 4. Bandeau HUD Inférieur, Commune &amp; Altimétrie LiDAR HD</h2>
      <p>
        En bas de l'écran, le bandeau d'instrumentation (HUD) regroupe les paramètres topographiques essentiels en direct. Entièrement dynamique, il s'actualise au moindre mouvement de la souris ou déplacement de la carte.
      </p>

      <div class="figure-box">
        <img src="{fig4_b64}" alt="Bandeau HUD">
        <div class="figure-caption">Figure 4 : Bandeau HUD inférieur avec ratio d'échelle dynamique, étalonnage 1 cm vrai, coordonnées GPS WGS84, altitude LiDAR HD et commune survolée.</div>
      </div>

      <h3>Détail des Indicateurs Topographiques</h3>
      <ul>
        <li><strong>Échelle dynamique saisissable (<code>Échelle ~ 1 :</code>) :</strong> affiche l'échelle courante et accepte directement n'importe quelle saisie (<code>1/25000</code>, <code>1/25 000</code>, <code>25000</code>, <code>25k</code>). Le moteur ajuste le zoom sans aucun à-coup grâce à son algorithme de zoom continu.</li>
        <li><strong>Bouton de calibrage « 📏 1 cm vrai » :</strong> permet d'étalonner précisément la résolution de votre moniteur (diagonale d'écran ou étalonnage par carte bancaire de 85,6 mm) pour garantir qu'un centimètre mesuré à la règle sur votre écran corresponde rigoureusement à 1 cm sur la carte papier !</li>
        <li><strong>Commune au curseur (🏛️) :</strong> affiche en continu le nom de la ville ou commune survolée ainsi que son département (ex. <code>🏛️ Sanary-sur-Mer (83)</code>). Hors de France, l'indicateur se masque automatiquement pour éviter toute imprécision.</li>
        <li><strong>Altitude LiDAR HD (⛰️) :</strong> interroge le Modèle Numérique de Terrain haute définition pour fournir l'altitude réelle au mètre près sous votre curseur.</li>
        <li><strong>Coordonnées WGS84 &amp; Grille UTM :</strong> affichage simultané en degrés décimaux et en coordonnées métriques militaires UTM (fuseau, bande et coordonnées métriques Est/Nord).</li>
      </ul>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 5 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 6 : BARRE DE RECHERCHE UNIVERSELLE & GR CLIGNOTANTS              -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 5 • RECHERCHE UNIVERSELLE</div>
    </div>

    <div class="page-body">
      <h2>🔍 5. Barre de Recherche Universelle &amp; GR® Clignotants</h2>
      <p>
        Située en haut à gauche de la carte, la barre de recherche universelle permet de localiser instantanément une commune, un col, un sommet montagneux, mais aussi les célèbres <strong>Sentiers de Grande Randonnée (GR®)</strong> et chemins historiques.
      </p>

      <div class="figure-box">
        <img src="{fig5_b64}" alt="Recherche de Sentiers">
        <div class="figure-caption">Figure 5 : Recherche du Chemin de Stevenson (GR 70) avec mise en surbrillance rouge/blanc clignotante animée sur toute la chaîne des Cévennes.</div>
      </div>

      <h3>Recherche de Sentiers Mythiques &amp; Chemins Historiques</h3>
      <p>
        Tapez simplement quelques lettres dans la boîte de recherche :
      </p>
      <ul>
        <li><strong>Recherche par numéro de GR :</strong> <code>GR 20</code> (Corse), <code>GR 34</code> (Sentier des Douaniers breton), <code>GR 5</code> (Grande Traversée des Alpes), <code>GR 54</code> (Tour de l'Oisans), <code>GR 98</code> (Calanques), etc.</li>
        <li><strong>Recherche par nom historique célèbre :</strong> <code>Chemin de Stevenson</code> (GR 70), <code>Via Francigena</code>, <code>Tour du Mont-Blanc</code>, <code>West Highland Way</code>, <code>Chemin de Saint-Jacques de Compostelle</code>, <code>Chemin des Bonshommes</code> (GR 107).</li>
      </ul>

      <h3>Mise en Surbrillance Clignotante Animée</h3>
      <p>
        Dès la sélection d'un GR ou sentier remarquable, Map &amp; Rando cadre automatiquement la carte sur l'itinéraire complet et active une <strong>surbrillance rouge et blanche clignotante animée</strong>. Ce signalement visuel dynamique permet d'identifier d'un seul coup d'œil l'axe majeur de votre trek sans le confondre avec les chemins secondaires.
      </p>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 6 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 7 : OUTILS MESURE DE CAP, DISTANCE & CARROYAGE UTM               -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 6 • OUTILS DE MESURE</div>
    </div>

    <div class="page-body">
      <h2>🧭 6. Outils de Mesure de Cap (Azimut), Distance &amp; Grille UTM</h2>
      <p>
        La navigation à la boussole reste la compétence de base de tout montagnard. Map &amp; Rando intègre des instruments de visée directe permettant de déterminer les azimuts et les distances sur la carte.
      </p>

      <div class="figure-box">
        <img src="{fig6_b64}" alt="Mesure de Cap et Distance">
        <div class="figure-caption">Figure 6 : Mesure d'azimut magnétique et de distance entre deux points avec ligne de visée orientée et boîte de résultat en direct.</div>
      </div>

      <h3>Mesure de Cap &amp; Relèvement (Azimut 0° à 360°)</h3>
      <p>
        Cliquez sur le bouton <strong>🧭 Cap</strong> puis sélectionnez successivement deux points sur la carte (par exemple votre position et un sommet de repère). L'outil trace une droite orientée et affiche instantanément dans un bandeau dédié :
      </p>
      <ul>
        <li><strong>L'azimut en degrés (0° à 360°) :</strong> valeur exacte du cap géographique à reporter sur votre boussole de visée de terrain.</li>
        <li><strong>Le secteur cardinal :</strong> indication textuelle immédiate (Nord, Sud-Est, Ouest-Nord-Ouest, etc.).</li>
        <li><strong>La distance métrique à vol d'oiseau :</strong> distance exprimée en mètres et en kilomètres.</li>
        <li><strong>Gestion jusqu'à 3 visées simultanées :</strong> comparez 3 relèvements pour effectuer une triangulation parfaite.</li>
      </ul>

      <h3>Règle de Mesure de Distance Pédestre</h3>
      <p>
        Le bouton <strong>📏 Mesurer</strong> permet de cliquer une succession de points pour mesurer la longueur cumulée d'une piste ou d'une crête sinueuse, avec affichage de chaque segment partiel.
      </p>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 7 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 8 : GESTIONNAIRE MULTI-TRACES GPX (CHARGER 1 À 3 TRACES)         -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 7 • MULTI-TRACES GPX</div>
    </div>

    <div class="page-body">
      <h2>📁 7. Visualiseur Multi-traces GPX (« Charger 1 à 3 traces GPX »)</h2>
      <p>
        Le module <strong>Cartes &amp; Outils</strong> intègre un visualiseur multi-traces performant capable de charger et de superposer simultanément jusqu'à <strong>3 fichiers GPX distincts</strong> pour comparer des variantes ou préparer une sortie de groupe.
      </p>

      <div class="figure-box">
        <img src="{fig7_b64}" alt="Boîte Traces GPX">
        <div class="figure-caption">Figure 7 : Panneau flottant TRACES GPX (3/3) avec pastilles de couleur individuelles, métriques physiques complètes, bouton cible 🎯 et croix de suppression ✕.</div>
      </div>

      <h3>Chargement &amp; Boîte Flottante « TRACES GPX »</h3>
      <p>
        Cliquez sur le bouton orange <strong>📁 Charger 1 à 3 traces GPX</strong> (dans le bandeau d'outils supérieur) ou glissez-déposez vos fichiers <code>.gpx</code> directement sur la carte. Une boîte flottante sombre apparaît en haut de la carte. Vous pouvez déplacer cette fenêtre en tirant son contour haut avec la souris.
      </p>

      <h3>Fonctionnalités de Chaque Ligne de Trace</h3>
      <ul>
        <li><strong>Pastille de couleur personnalisable :</strong> cliquez sur la pastille circulaire ou directement sur l'une des touches de la palette de <strong>7 couleurs vives</strong> (rouge, bleu, vert, orange, violet, cyan, noir) pour modifier instantanément la couleur du tracé et de son point de départ sur la carte afin de distinguer clairement des variantes d'itinéraires.</li>
        <li><strong>Données physiques clés :</strong> distance totale (km), dénivelé cumulé positif (D+ en mètres) et <strong>Indice IBP Index officiel</strong> calculé automatiquement.</li>
        <li><strong>Bouton Cible (🎯) :</strong> centre immédiatement la carte sur la trace concernée.</li>
        <li><strong>Bouton Croix (✕) de suppression individuelle :</strong> retire la trace sélectionnée de l'écran sans affecter les autres traces affichées.</li>
        <li><strong>Bouton « Tout effacer » :</strong> vide la carte de l'ensemble des parcours en 1 clic.</li>
        <li><strong>Mode Réduit / Développé :</strong> cliquez sur le bouton de réduction pour compacter le panneau en un bandeau discret libérant la vision sur la carte.</li>
      </ul>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 8 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 9 : OUTILS AVANCÉS : COLORATION DES PENTES & FUSION DE TRACES GPX-->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 8 • PENTES &amp; FUSION DE TRACES GPX</div>
    </div>

    <div class="page-body">
      <h2>📈 8. Outils Cartographiques Avancés : Pentes &amp; Fusion GPX</h2>
      <p>
        Pour pousser l'analyse du terrain et préparer des traversées complexes, <strong>Map &amp; Rando</strong> intègre deux outils exclusifs directement accessibles depuis le panneau HUD des traces GPX.
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; margin: 3pt 0;">
        <div class="figure-box" style="margin: 0;">
          <img src="{fig7d_b64}" alt="Coloration des pentes" style="max-height: 68mm; width: 100%; object-fit: contain;">
          <div class="figure-caption">Figure 7b : Coloration des pentes en 4 paliers d'effort avec légende intégrée et infobulle au survol.</div>
        </div>
        <div class="figure-box" style="margin: 0;">
          <img src="{fig7e_b64}" alt="Fusion de traces GPX" style="max-height: 68mm; width: 100%; object-fit: contain;">
          <div class="figure-caption">Figure 7c : Modal de fusion avec diagnostic d'écart, inversion de sens et auto-routage des sentiers.</div>
        </div>
      </div>

      <h3>📈 1. Coloration Interactive des Pentes le Long de la Trace</h3>
      <p>
        Cliquez sur le bouton <strong>📈 Pentes</strong> : le tracé unicolore se transforme instantanément en segments colorés reflétant le pourcentage réel de dénivelé ressenti par le randonneur.
      </p>
      <ul>
        <li><strong>Calcul lissé sans saccades :</strong> un algorithme par fenêtre glissante (25 à 30 mètres) absorbe le bruit GPS et fournit une pente fidèle à la réalité du terrain.</li>
        <li><strong>Échelle à 4 paliers d'effort :</strong> 
          <span style="color:#10b981; font-weight:700;">🟩 &lt; 5%</span> Plat / Roulant • 
          <span style="color:#ca8a04; font-weight:700;">🟨 5-12%</span> Montée modérée • 
          <span style="color:#ea580c; font-weight:700;">🟧 12-20%</span> Montée soutenue / Raide • 
          <span style="color:#dc2626; font-weight:700;">🟥 &gt; 20%</span> Très raide / Escarpé.
        </li>
        <li><strong>Légende dynamique &amp; Infobulle :</strong> une réglette de rappel s'affiche sous le HUD et le survol d'un tronçon indique la pente précise (ex. <code>+14.2%</code>).</li>
      </ul>

      <h3>🔀 2. Fusion Intelligente de 2 Traces GPX</h3>
      <p>
        Dès que 2 traces au moins sont affichées, le bouton violet <strong>🔀 Fusionner</strong> ouvre la console d'assemblage en itinéraire continu.
      </p>
      <ul>
        <li><strong>Contrôle du sens &amp; de l'ordre :</strong> sélectionnez la Trace 1 (Départ) et la Trace 2 (Arrivée). Cliquez sur <code>⇄ Intervertir l'ordre</code> ou cochez <code>🔄 Inverser le sens</code> pour chaque segment indépendamment si l'une des traces a été parcourue en sens inverse.</li>
        <li><strong>Diagnostic d'écart automatique :</strong> si les deux traces se touchent (&lt; 35 m), la jonction est directe. Si un écart existe, l'option <strong>🥾 Relier par sentiers</strong> calcule automatiquement le tracé intermédiaire le long des sentiers réels via le moteur hybride IGN/BRouter.</li>
        <li><strong>Affichage ou Téléchargement :</strong> basculez le parcours fusionné directement sur la carte ou téléchargez le fichier avec nommage normalisé (<code>YYYYMMDDHHMM - Ville - Dist - D+</code>).</li>
      </ul>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 9 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 9 : CRÉATEUR D'ITINÉRAIRE GPX (AUTO-ROUTAGE SENTIERS)             -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 9 • CRÉATEUR D'ITINÉRAIRE GPX</div>
    </div>

    <div class="page-body">
      <h2>✏️ 9. Créateur d'Itinéraire GPX (Auto-Routage Sentiers &amp; Étapes Dynamiques)</h2>
      <p>
        Pour créer une nouvelle randonnée sur mesure sans passer par un logiciel tiers complexe, cliquez sur le bouton bleu ciel <strong>✏️ Créer un GPX</strong>. L'outil vous permet de concevoir en quelques clics un fichier <code>.gpx</code> de haute précision prêt pour votre montre GPS.
      </p>

      <div class="figure-box">
        <img src="{fig7b_b64}" alt="Créateur d'Itinéraire GPX">
        <div class="figure-caption">Figure 8 : Panneau flottant Créateur d'Itinéraire GPX avec tracé automatique épousant les sentiers réels, ruban interactif des étapes successives (A ➔ B ➔ C ➔ D), suppression 1-clic ✕, déplacement à la souris, annulation multi-niveaux par CTRL+Z et export GPX.</div>
      </div>

      <h3>Tracé Automatique sur Sentiers Réels (Moteur Hybride IGN &amp; BRouter)</h3>
      <p>
        Cliquez successivement sur la carte pour déposer vos étapes : le point <strong>A (Départ en vert)</strong>, les étapes intermédiaires <strong>B, C, D... (en bleu)</strong> et le point d'arrivée <strong>(en rouge)</strong>.
        Le moteur de routage hybride calcule instantanément l'itinéraire le plus fidèle en <strong>épousant automatiquement les sentiers de randonnée, chemins et pistes réels</strong> de la base IGN BD TOPO®.
        Un bouton permet de basculer en mode <em>« Ligne Droite : OUI »</em> si vous traversez des zones hors sentiers répertoriés.
      </p>

      <h3>Ruban Visuel d'Étapes &amp; Suppression en 1 Clic</h3>
      <ul>
        <li><strong>Ruban chronologique des étapes :</strong> les badges <code>[🟢 A Départ] ➔ [🔵 B Étape ✕] ➔ [🔴 C Arrivée ✕]</code> visualisent exactement l'enchaînement de votre parcours.</li>
        <li><strong>Suppression instantanée d'une étape :</strong> cliquez sur la petite croix <strong>`[✕]`</strong> d'un badge ou faites un clic droit sur sa lettre sur la carte : l'étape est retirée et l'itinéraire est immédiatement recalculé entre les étapes restantes.</li>
        <li><strong>Déplacement libre d'un point à la souris :</strong> attrapez n'importe quel point ($A, B, C...$) et glissez-le vers un autre sentier pour corriger la trajectoire en direct.</li>
      </ul>

      <h3>Annulation par Raccourci Clavier Universel CTRL + Z</h3>
      <p>
        Une fausse manipulation ? Appuyez simplement sur <strong>CTRL + Z</strong> (ou <strong>Cmd + Z</strong> sur Mac, ou le bouton <em>« ↶ Annuler (Ctrl+Z) »</em>) : un historique complet mémorise vos 30 dernières actions pour annuler l'ajout d'un point, annuler un déplacement ou restaurer un point supprimé par erreur.
      </p>

      <h3>Statistiques en Direct &amp; Exportation GPX</h3>
      <p>
        La distance et le dénivelé D+ sont mis à jour en temps réel. Cliquez sur <strong>💾 Exporter le GPX</strong> : le fichier est téléchargé et s'ouvre instantanément dans le visualiseur avec son profil altimétrique complet.
      </p>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 10 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 10 : MODIFICATION DE TRACE GPX (DÉVIATION SUR SENTIERS VOISINS)   -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 10 • MODIFICATION DE TRACE GPX</div>
    </div>

    <div class="page-body">
      <h2>🛠️ 10. Modification de Trace GPX (Déviation, Suppression de Zone &amp; Reconnexion Auto)</h2>
      <p>
        Vous disposez d'une trace GPX existante mais vous souhaitez éviter un tronçon difficile, contourner un obstacle ou emprunter une variante panoramique ? Le bouton violet <strong>🛠️ Modifier une trace GPX</strong> transforme votre trace en un objet malléable et interactif.
      </p>

      <div class="figure-box">
        <img src="{fig7c_b64}" alt="Modification de Trace GPX">
        <div class="figure-caption">Figure 9 : Panneau flottant Modification de Trace GPX avec poignées de manipulation le long du parcours (D, 1, 2, 3... A), magnétisme auto-routage vers un sentier voisin, annulation par CTRL+Z et export du GPX modifié.</div>
      </div>

      <h3>Poignées de Manipulation Réparties le Long de la Trace</h3>
      <p>
        Dès l'activation, Map &amp; Rando dispose automatiquement des <strong>poignées circulaires déplaçables</strong> réparties sur le tracé : <strong>D</strong> (Départ vert), <strong>1, 2, 3...</strong> (numéros intermédiaires violets) et <strong>A</strong> (Arrivée rouge).
      </p>

      <h3>Magnétisme Auto-Routage vers les Sentiers Voisins</h3>
      <ul>
        <li><strong>Tirer un point vers un chemin voisin :</strong> attrapez avec la souris l'une des poignées et glissez-la vers un sentier parallèle ou une variante.</li>
        <li><strong>Recalcul automatique du tronçon :</strong> grâce à l'algorithme d'auto-routage activé par défaut (<em>Auto-routage : OUI</em>), le système reconnecte la poignée déplacée aux poignées adjacentes amont et aval en <strong>suivant scrupuleusement la géométrie du nouveau sentier</strong>.</li>
        <li><strong>Recalcul en direct des métriques :</strong> le panneau affiche instantanément la nouvelle distance modifiée et le nouveau dénivelé D+ recalculé.</li>
      </ul>

      <h3>✂️ Découpage de Zone &amp; Reconnexion Automatique par Sentiers</h3>
      <ul>
        <li><strong>Outil « Supprimer zone » (Rectangle de coupe) :</strong> cliquez sur le bouton rouge <em>« ✂️ Supprimer zone »</em> puis étirez un rectangle à la souris sur la carte englobant le tronçon à retirer : tous les points inclus sont instantanément coupés.</li>
        <li><strong>Reconnexion intelligente par les sentiers :</strong> grâce au moteur d'auto-routage activé par défaut, Map &amp; Rando <strong>reconnecte immédiatement les 2 extrémités coupées en empruntant les vrais sentiers de liaison IGN BD TOPO®</strong> (avec bouton de secours <em>« 🥾 Relier par sentiers »</em>), évitant toute ligne droite artificielle à travers le relief.</li>
      </ul>

      <h3>Annulation CTRL + Z &amp; Export Intelligent Normalisé</h3>
      <ul>
        <li><strong>Annulation multi-niveaux par CTRL + Z :</strong> chaque suppression de zone ou déplacement est annulable instantanément avec <strong>Ctrl+Z</strong> ou le bouton <em>« Rétablir l'original »</em>.</li>
        <li><strong>Export avec dialogue de nommage normalisé :</strong> cliquez sur <em>« 💾 Télécharger le GPX modifié »</em> pour ouvrir la boîte de dialogue proposant le format officiel <code>YYYYMMDDHHMM - Commune - Dist - D+</code> personnalisable.</li>
      </ul>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 11 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 11 : PROFIL ALTIMÉTRIQUE INTERACTIF & SYNCHRONISÉ                -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 11 • PROFIL ALTIMÉTRIQUE</div>
    </div>

    <div class="page-body">
      <h2>📈 11. Profil Altimétrique Interactif &amp; Synchronisé Bidirectionnel</h2>
      <p>
        L'analyse du relief est cruciale pour doser son effort en randonnée. Map &amp; Rando propose un profil altimétrique de haute précision bénéficiant d'une <strong>réciprocité complète et bidirectionnelle</strong> avec la carte.
      </p>

      <div class="figure-box">
        <img src="{fig8_b64}" alt="Profil Altimétrique">
        <div class="figure-caption">Figure 10 : Profil altimétrique synchronisé sur les crêtes de la Sainte-Baume & Saint-Pilon (12.4 km • +680 m) avec altitude au curseur : survol du profil animant le point rouge et l'altitude sur la trace cartographique, et vice versa.</div>
      </div>

      <h3>Réciprocité Totale &amp; Double Suivi Trace ↔ Profil</h3>
      <p>
        Le suivi de position fonctionne simultanément dans les deux sens :
      </p>
      <ul>
        <li><strong>Du Profil vers la Trace :</strong> lorsque vous promenez votre curseur sur la courbe du profil altimétrique, <strong>un point rouge mobile et une infobulle d'altitude</strong> parcourent exactement la trace sur la carte en temps réel.</li>
        <li><strong>De la Trace vers le Profil :</strong> inversement, lorsque vous déplacez votre souris le long de la trace affichée sur la carte, <strong>une ligne repère verticale et l'altitude correspondante</strong> s'animent en miroir sur le graphique altimétrique.</li>
      </ul>

      <h3>Maintien au Clic &amp; Fermeture par Croix ✕</h3>
      <ul>
        <li><strong>Clic sur la trace pour maintenir le profil :</strong> un simple clic sur un tracé cartographique épingle le panneau altimétrique, vous permettant d'inspecter sereinement les passages escarpés et les cols.</li>
        <li><strong>Fermeture par la croix ✕ :</strong> un bouton de fermeture situé en haut à droite du panneau altimétrique permet de le masquer dès que vous avez terminé votre analyse.</li>
      </ul>

      <div class="callout info">
        <div class="callout-title">💡 Calcul du Dénivelé Réel Lissé</div>
        Pour éviter les micro-sauts d'altitude inhérents aux puces GPS grand public, Map &amp; Rando applique un algorithme de lissage de seuil validé par les fédérations de randonnée, garantissant un dénivelé positif D+ d'une remarquable fidélité.
      </div>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 12 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 12 : IMPRESSION HAUTE DÉFINITION (« IMPRIMER UNE ZONE »)         -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 12 • IMPRESSION HAUTE DÉFINITION</div>
    </div>

    <div class="page-body">
      <h2>🖨️ 12. Outil d'Impression sur Mesure (« Imprimer une zone »)</h2>
      <p>
        Sur le terrain, la batterie d'un smartphone peut s'épuiser ou tomber en panne par grand froid. Disposer d'un <strong>extrait cartographique papier</strong> dans son fond de sac est une règle de sécurité absolue.
      </p>

      <div class="figure-box">
        <img src="{fig9_b64}" alt="Impression sur Mesure">
        <div class="figure-caption">Figure 11 : Boîte de dialogue d'impression A4/A3 avec carroyage UTM kilométrique, cartouche officiel et millésime papier IGN TOP 25.</div>
      </div>

      <h3>Sélection par Rectangle Glissé, 2 Clics ou Cadrage Automatique</h3>
      <p>
        Cliquez sur le bouton <strong>🖨️ Imprimer une zone</strong> (en bas à droite). Vous pouvez soit <strong>étirer directement un rectangle à la souris par glisser-déposer</strong>, soit cliquer deux coins opposés sur la carte, soit laisser l'outil cadrer automatiquement vos traces GPX affichées.
      </p>

      <h3>Paramètres de la Boîte d'Impression</h3>
      <ul>
        <li><strong>Format &amp; Orientation :</strong> choix entre <strong>A4</strong> (standard) et <strong>A3</strong> (grand format de table d'orientation), en mode <strong>Paysage</strong> ou <strong>Portrait</strong>.</li>
        <li><strong>Échelle rigoureuse :</strong> mode cadrage automatique ou échelle normalisée stricte (<strong>1:25 000</strong> pour les cartes TOP 25, <strong>1:50 000</strong> pour les grandes traversées).</li>
        <li><strong>Carroyage UTM Kilométrique en Périphérie :</strong> le document PDF imprimé intègre automatiquement les croisillons kilométriques et les valeurs chiffrées en marge.</li>
        <li><strong>Cartouche Cartographique Officiel :</strong> mention automatique de la référence de la coupure papier IGN TOP 25 (ex. <code>3245 ET</code>), de son titre, de <strong>l'année de dernière édition</strong> (ex. <code>Éd. 2023</code>), de la déclinaison magnétique et du profil altimétrique intégré.</li>
      </ul>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 13 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 13 : MODULE « RANDONNER » & CATALOGUE CLUB                       -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 13 • MODULE RANDONNER</div>
    </div>

    <div class="page-body">
      <h2>🥾 13. Module « Randonner » &amp; Catalogue Associatif</h2>
      <p>
        Protégé par le mot de passe de l'association, le module <strong>Randonner</strong> regroupe la bibliothèque complète des circuits reconnus par les adhérents du club.
      </p>

      <div class="figure-box">
        <img src="{fig10_b64}" alt="Module Randonner">
        <div class="figure-caption">Figure 12 : Catalogue de randonnées en écran scindé avec filtres multicritères, tableau triable et colonne « Ajoutée par » (nom de l'adhérent).</div>
      </div>

      <h3>Disposition en Écran Scindé (Split-Screen)</h3>
      <p>
        L'interface sépare harmonieusement les commandes : le volet gauche accueille le moteur de recherche et la liste des parcours, tandis que le volet droit affiche la carte interactive synchronisée.
      </p>

      <h3>Filtres Multicritères &amp; Colonne « Ajoutée par »</h3>
      <ul>
        <li><strong>Centre de recherche &amp; Curseur de rayon :</strong> définissez votre point de départ (adresse, GPS ou clic carte) et ajustez le rayon de 10 km jusqu'au monde entier.</li>
        <li><strong>Difficulté IBP Index (Niveaux 1 à 5 FFRandonnée) :</strong> filtrez en un clic les sorties faciles, moyennes ou très sportives.</li>
        <li><strong>Colonne 👤 « Ajoutée par » :</strong> le tableau affiche clairement le nom ou le pseudonyme de l'adhérent ayant partagé le fichier GPX.</li>
        <li><strong>Téléchargement &amp; Fiches Topo :</strong> téléchargez le fichier <code>.gpx</code> brut pour votre montre ou exportez la <strong>Fiche Randonnée PDF détaillée</strong>.</li>
        <li><strong>Onglet « Charger une randonnée » :</strong> déposez un nouveau fichier GPX, renseignez votre nom d'utilisateur et profitez du calcul automatique certifié de l'IBP et de l'anti-doublon spatial.</li>
      </ul>

      <div class="callout warning">
        <div class="callout-title">🔒 Protection des Données &amp; Usage Club</div>
        Ce catalogue est strictement réservé à un usage privé et associatif bénévole. Toute revente commerciale des fiches ou des traces est interdite.
      </div>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 14 / 15</div>
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- PAGE 14 : MODULE « GUIDES & SAVOIRS » — 6 FICHES & SÉCURITÉ           -->
  <!-- ===================================================================== -->
  <section class="page-section">
    <div class="page-header">
      <div class="brand">
        <img src="{logo_b64}" alt="Map & Rando">
        <span>Map &amp; Rando • JLDApps 2026</span>
      </div>
      <div>CHAPITRE 14 • GUIDES &amp; SAVOIRS</div>
    </div>

    <div class="page-body">
      <h2>📚 14. Module « Guides &amp; Savoirs » — 6 Fiches &amp; Sécurité</h2>
      <p>
        Le module <strong>Guides &amp; Savoirs</strong> rassemble 6 dossiers techniques de référence rédigés pour perfectionner votre autonomie et votre sécurité en pleine nature. Chaque fiche est consultable directement à l'écran et téléchargeable en 1 clic au format PDF officiel haute définition.
      </p>

      <div class="figure-box">
        <img src="{fig11_b64}" alt="Guides et Savoirs">
        <div class="figure-caption">Figure 13 : Les fiches techniques de référence consultables en mode accordéon et téléchargeables en PDF imprimable.</div>
      </div>

      <h3>Les 6 Fiches Techniques de Référence</h3>
      <ul>
        <li><strong>🛰️ Fiche 1 : Technologies GPS, SBAS (EGNOS) &amp; Montres de Sport :</strong> précision GNSS multi-constellations, correction différentielle SBAS et double fréquence L1+L5.</li>
        <li><strong>🌲 Fiche 2 : Programme National IGN LiDAR HD :</strong> modélisation laser 3D à 10 pts/m² traversant la canopée pour restituer le relief réel à 50 cm.</li>
        <li><strong>📊 Fiche 3 : Indice IBP Index &amp; Échelle d'Effort Physique :</strong> calcul officiel FFRandonnée croisant dénivelé et distance selon 5 niveaux d'effort.</li>
        <li><strong>✅ Fiche 4 : Check-list de Départ Randonnée :</strong> vérifications indispensables de J-1 à H-0 (3 couches, eau, boussole, powerbank, secours).</li>
        <li><strong>🚨 Fiche 5 : Secours en Randonnée, Zone Blanche &amp; SOS Satellite :</strong> appel 112 sans SIM, SMS 114, balises Iridium et SOS satellite direct smartphone.</li>
        <li><strong>⌚ Fiche 6 : Randonner avec un Fichier GPX &amp; Montres Connectées :</strong> anatomie XML/WGS84 (&lt;trk&gt;, &lt;rte&gt;, &lt;wpt&gt;), plateformes de téléchargement fiables (Visorando, AllTrails, Komoot, IGNrando') et éditeurs (VisuGPX, OpenRunner, BRouter), transfert Bluetooth sur Garmin, Coros, Suunto, Polar, Apple Watch et navigation sécurisée.</li>
      </ul>

      <h3>Sauvegarde &amp; Restauration</h3>
      <p>
        Le module permet d'exporter une sauvegarde complète au format <code>.json</code> pour archiver vos données localement ou de les synchroniser avec le Cloud Supabase de l'association.
      </p>
    </div>

    <div class="page-footer">
      <div>Map &amp; Rando by JLDApps 2026 • Document Utilisateur Officiel</div>
      <div class="page-number">Page 15 / 15</div>
    </div>
  </section>

</body>
</html>
"""

html_file = os.path.join(WORKDIR, "manual_compiled.html")
with open(html_file, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"HTML manual generated at {html_file}")

output_pdf = os.path.join(WORKDIR, "Mode_d_emploi_RandoFinder.pdf")
cmd = [
    EDGE_EXE,
    "--headless",
    "--disable-gpu",
    "--run-all-compositor-stages-before-draw",
    f"--print-to-pdf={output_pdf}",
    "--no-pdf-header-footer",
    html_file
]

print("Compiling PDF with Microsoft Edge headless...")
result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode == 0 and os.path.exists(output_pdf):
    print(f"PDF successfully compiled! Size: {os.path.getsize(output_pdf)} bytes")
    # Also copy to randofinder_update
    targets = [
        r"C:\Users\lesda\.gemini\antigravity\scratch\maprando\docs\Mode_d_emploi_RandoFinder.pdf",
        r"C:\Users\lesda\.gemini\antigravity\scratch\randofinder_update\Mode_d_emploi_RandoFinder.pdf",
        r"C:\Users\lesda\.gemini\antigravity\scratch\randofinder_update\docs\Mode_d_emploi_RandoFinder.pdf",
    ]
    for t in targets:
        os.makedirs(os.path.dirname(t), exist_ok=True)
        shutil.copy2(output_pdf, t)
        print(f"Copied to {t}")
else:
    print(f"Error compiling PDF: {result.stderr}")
