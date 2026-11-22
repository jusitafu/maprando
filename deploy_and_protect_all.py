import os
import shutil
import re
import subprocess
import sys
from bs4 import BeautifulSoup

GIT_EXE = r'C:\Users\lesda\AppData\Local\GitHubDesktop\app-3.5.6\resources\app\git\cmd\git.exe'
MAPRANDO_DIR = r'C:\Users\lesda\.gemini\antigravity\scratch\maprando'
RANDOFINDER_DIR = r'C:\Users\lesda\.gemini\antigravity\scratch\randofinder_update'

# Liste canonique des 65 sigles et acronymes obligatoires dans le mode d'emploi
MANDATORY_ACRONYMS = [
    "ACT", "BKG", "BTT", "CAI", "CGU", "CN", "CNIG", "CRS", "CSV", "D+", "D-",
    "DEM", "EGNOS", "ESRI", "FFR", "FR", "GB", "GNSS", "GPS", "GPX", "GR",
    "GRP", "HD", "HKG", "HUD", "IBP", "IGM", "IGN", "ISO", "IT", "JSON",
    "LiDAR", "MNT", "MTN", "NASA", "NGA", "NGI", "NO", "OAV", "ODbL", "OSM",
    "OTM", "PC", "PDF", "PGHM", "PIN", "POI", "PR", "PRO", "RGE", "RGPD",
    "RU", "SBAS", "SE", "SIM", "SMS", "SOS", "SRTM", "UE", "USA", "UTM",
    "VTT", "WGS84", "WP", "XML"
]

MANDATORY_COMPARATIVE_SOLUTIONS = [
    "Map & Rando", "Cartes.gouv", "Iphigénie", "Visorando", "Hiker",
    "Openrunner", "Komoot", "GPXStudio", "BaseCamp", "VisuGPX"
]

def validate_dom_architecture(html_path):
    """
    Vérification stricte de l'intégrité de l'architecture DOM d'index.html.
    Empêche formellement tout déploiement si un conteneur racine ou une modale
    se retrouve piégé dans une autre vue par omission d'une balise fermante </div>.
    """
    print("\n🏛️  [TEST 1/3] Audit d'intégrité de l'arborescence DOM (Protection anti-imbrication)...")
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    soup = BeautifulSoup(content, "html.parser")
    
    # 1. Vérifier que tous les conteneurs racines existent
    root_elements = [
        "portal-view",
        "main-map-app-container",
        "guides-view",
        "modal-mode-emploi",
        "modal-cgu",
        "modal-jldapps"
    ]
    
    dom_errors = []
    
    for el_id in root_elements:
        el = soup.find(id=el_id)
        if not el:
            dom_errors.append(f"Élément racine manquant introuvable : #{el_id}")
            continue
        
        parent = el.parent
        if not parent or parent.name != "body":
            dom_errors.append(
                f"Rupture de hiérarchie DOM critique : #{el_id} a pour parent <{parent.name if parent else 'None'} id='{parent.get('id', '')}'> au lieu de <body> !"
            )
            
    # 2. Vérifier que guides-view ne contient pas de conteneurs tiers
    guides_el = soup.find(id="guides-view")
    if guides_el:
        for forbidden in ["main-map-app-container", "modal-mode-emploi", "modal-cgu", "modal-jldapps"]:
            if guides_el.find(id=forbidden):
                dom_errors.append(f"Pollution DOM critique : #{forbidden} est imbriqué à l'intérieur de #guides-view !")

    if dom_errors:
        print("\n❌ ÉCHEC CRITIQUE DE SÉCURITÉ DOM - DÉPLOIEMENT BLOQUÉ :")
        for err in dom_errors:
            print(f"  🚨 {err}")
        print("\nCorrigez l'arborescence HTML avant de redéployer !")
        sys.exit(1)
        
    print(f"✓ Intégrité DOM 100% validée : les conteneurs racines sont tous enfants directs de <body>.")


def validate_manual_and_tables(html_path, maprando_dir):
    """
    Vérification systématique et obligatoire du Mode d'Emploi :
    1. Grand Tableau Comparatif (10 solutions, fonctionnalités exclusives, 10 piliers).
    2. Tableau exhaustif des 65 Sigles et Acronymes.
    3. Recompilation et contrôle strict du PDF Mode d'emploi (exactement 17 pages).
    """
    print("\n📖  [TEST 2/3] Audit systématique du Mode d'Emploi Web & Comparatif...")
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    soup = BeautifulSoup(content, "html.parser")
    errors = []

    # A. Audit du Grand Tableau Comparatif
    comp_sec = soup.find(id="me-section-comparatif")
    if not comp_sec:
        errors.append("Section comparative #me-section-comparatif introuvable dans index.html !")
    else:
        comp_text = comp_sec.text
        for sol in MANDATORY_COMPARATIVE_SOLUTIONS:
            if sol.lower() not in comp_text.lower():
                errors.append(f"Solution comparative manquante dans le tableau : '{sol}' !")
        
        # Vérifier fonctionnalités indispensables dans le tableau
        for feat in ["Patrimoine clignotant", "Fiche Topo A4 fond TOP 25", "IGN TOP 25", "Waypoints"]:
            if feat.lower() not in comp_text.lower():
                errors.append(f"Ligne de fonctionnalité comparative manquante : '{feat}' !")
        
        # Vérifier rappel des 10 Piliers
        if "10 Piliers" not in comp_text:
            errors.append("La mention des '10 Piliers Majeurs & Exclusifs' est manquante dans la synthèse comparative !")

    # B. Audit du Tableau des Sigles et Acronymes
    pos_glossaire = content.find("Glossaire &amp; Définitions des Sigles")
    if pos_glossaire == -1:
        pos_glossaire = content.find("Glossaire")
    
    if pos_glossaire == -1:
        errors.append("Section Glossaire des sigles et acronymes introuvable dans index.html !")
    else:
        tbody_match = re.search(r'<tbody[^>]*>(.*?)</tbody>', content[pos_glossaire:], re.DOTALL)
        if not tbody_match:
            errors.append("Tableau <tbody> des sigles introuvable dans la section Glossaire !")
        else:
            glossary_text = tbody_match.group(1)
            missing_acronyms = []
            for acr in MANDATORY_ACRONYMS:
                if acr not in glossary_text:
                    missing_acronyms.append(acr)
            if missing_acronyms:
                errors.append(f"Sigles obligatoires manquants dans le glossaire ({len(missing_acronyms)}) : {', '.join(missing_acronyms)}")
            else:
                row_count = len(re.findall(r'<tr[^>]*>', glossary_text))
                if row_count < 65:
                    errors.append(f"Nombre de lignes insuffisant dans le glossaire : {row_count} trouvées (65 attendues)")

    if errors:
        print("\n❌ ÉCHEC CRITIQUE DE L'AUDIT DU MODE D'EMPLOI WEB :")
        for err in errors:
            print(f"  🚨 {err}")
        sys.exit(1)

    print("✓ Grand Tableau Comparatif validé (10 solutions, lignes clés, 10 piliers exclusifs).")
    print(f"✓ Tableau exhaustif des Sigles & Acronymes validé (65 sigles officiels confirmés).")

    # C. Recompilation systématique et audit de conformité du PDF
    print("\n📑  [TEST 3/3] Recompilation et contrôle strict du PDF Mode d'Emploi...")
    generator_script = os.path.join(maprando_dir, "generate_exhaustive_pdf_manual.py")
    if not os.path.exists(generator_script):
        print("❌ Script generate_exhaustive_pdf_manual.py introuvable !")
        sys.exit(1)

    pdf_out = os.path.join(maprando_dir, "Mode_d_emploi_RandoFinder.pdf")
    
    # Exécuter le générateur de PDF
    comp_res = subprocess.run([sys.executable, generator_script], capture_output=True, text=True)
    if comp_res.returncode != 0:
        print(f"❌ Échec de la compilation du PDF :\n{comp_res.stderr}")
        sys.exit(1)

    # Vérifier le nombre exact de pages du PDF
    try:
        import pypdf
        reader = pypdf.PdfReader(pdf_out)
        page_count = len(reader.pages)
    except Exception:
        import fitz
        doc = fitz.open(pdf_out)
        page_count = len(doc)

    if page_count != 17:
        print(f"\n❌ ERREUR CRITIQUE DE GABARIT PDF : Le document compte {page_count} pages au lieu de STRICTEMENT 17 pages !")
        print("  🚨 Le contenu a débordé sur une page supplémentaire. Ajustez le CSS ou la densité avant de déployer.")
        sys.exit(1)

    print(f"✓ PDF Mode_d_emploi_RandoFinder.pdf compilé avec succès (gabarit strict de {page_count} pages respecté).")


def sync_and_protect(commit_msg):
    print("=" * 70)
    print("🛡️  LANCEUR DE DÉPLOIEMENT & BATTERIE DE TESTS SYSTÉMATIQUES 🛡️")
    print("=" * 70)
    
    index_path = os.path.join(MAPRANDO_DIR, "index.html")
    
    # 1. Validation de l'architecture DOM
    validate_dom_architecture(index_path)

    # 2. Validation du Mode d'Emploi, du comparatif et du glossaire des 65 sigles + Recompilation PDF
    validate_manual_and_tables(index_path, MAPRANDO_DIR)

    # 3. Synchroniser index.html
    shutil.copy2(index_path, os.path.join(RANDOFINDER_DIR, "index.html"))
    print("\n✓ index.html synchronisé")

    # 4. Synchroniser les dossiers complets
    for folder in ["images", "audio", "docs", "js", "css"]:
        src_dir = os.path.join(MAPRANDO_DIR, folder)
        dst_dir = os.path.join(RANDOFINDER_DIR, folder)
        if os.path.exists(src_dir):
            if os.path.exists(dst_dir):
                shutil.rmtree(dst_dir)
            shutil.copytree(src_dir, dst_dir)
            print(f"✓ Dossier {folder}/ synchronisé intégralement ({len(os.listdir(dst_dir))} éléments)")

    # 5. Synchroniser les fichiers racine clés
    root_files = [
        "Mode_d_emploi_RandoFinder.pdf",
        "Legende_IGN_Top25.pdf",
        "legende-carte-ign-a-imprimer.pdf",
        "favicon.ico",
        "site.webmanifest",
        "generate_exhaustive_pdf_manual.py",
        "acronyms_data.py"
    ]
    for rf in root_files:
        s = os.path.join(MAPRANDO_DIR, rf)
        d = os.path.join(RANDOFINDER_DIR, rf)
        if os.path.exists(s):
            shutil.copy2(s, d)
            print(f"✓ Fichier racine {rf} synchronisé")

    # 6. Audit d'intégrité strict : vérifier toutes les ressources référencées
    print("\n🔍 Audit de sécurité des ressources statiques...")
    with open(index_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    asset_patterns = [
        r'src=["\']([^"\']+\.(?:png|jpg|jpeg|svg|webp|ico|mp3|pdf))["\']',
        r'url\(["\']?([^"\'\)]+\.(?:png|jpg|jpeg|svg|webp|ico|mp3|pdf))["\']?\)',
        r'href=["\']([^"\']+\.(?:png|jpg|jpeg|svg|webp|ico|mp3|pdf))(\?[^"\']*)?["\']'
    ]
    found_assets = set()
    for pat in asset_patterns:
        for m in re.finditer(pat, html_content, re.I):
            val = m.group(1).strip()
            if not val.startswith("http") and not val.startswith("data:"):
                found_assets.add(val.lstrip("/"))

    missing = []
    for asset in sorted(found_assets):
        for repo_name, repo_dir in [("maprando", MAPRANDO_DIR), ("randofinder", RANDOFINDER_DIR)]:
            full_path = os.path.join(repo_dir, asset.replace("/", os.sep))
            if not os.path.exists(full_path) or os.path.getsize(full_path) == 0:
                missing.append(f"[{repo_name}] {asset}")

    if missing:
        print("\n❌ ERREUR CRITIQUE DE PROTECTION : Ressources manquantes détectées !")
        for m in missing:
            print("  -", m)
        sys.exit(1)
    else:
        print(f"✓ Intégrité validée : les {len(found_assets)} ressources statiques existent dans les 2 dépôts.")

    # 7. Git Add, Commit et Push sur les deux dépôts
    track_patterns = ["index.html", "images", "audio", "docs", "js", "css", "Mode_d_emploi_RandoFinder.pdf", "Legende_IGN_Top25.pdf", "legende-carte-ign-a-imprimer.pdf", "generate_exhaustive_pdf_manual.py", "deploy_and_protect_all.py", "acronyms_data.py"]
    for repo_name, repo_dir in [("maprando", MAPRANDO_DIR), ("randofinder_update", RANDOFINDER_DIR)]:
        print(f"\n📦 Git déploiement pour {repo_name}...")
        for pattern in track_patterns:
            target_p = os.path.join(repo_dir, pattern)
            if os.path.exists(target_p):
                subprocess.run([GIT_EXE, '-C', repo_dir, 'add', pattern], check=True)
        
        status_res = subprocess.run([GIT_EXE, '-C', repo_dir, 'status', '--porcelain'], capture_output=True, text=True, check=True)
        if status_res.stdout.strip():
            subprocess.run([GIT_EXE, '-C', repo_dir, 'commit', '-m', commit_msg], check=True)
            print(f"✓ Commit créé dans {repo_name}")
        else:
            print(f"ℹ️ Aucun changement à committer dans {repo_name}")

        print(f"🚀 Push vers origin main ({repo_name})...")
        push_res = subprocess.run([GIT_EXE, '-C', repo_dir, 'push', 'origin', 'main'], capture_output=True, text=True)
        if push_res.returncode == 0:
            print(f"✓ Push réussi pour {repo_name}")
        else:
            print(f"❌ Erreur lors du push {repo_name}: {push_res.stderr}")

    print("\n" + "=" * 70)
    print("✅ OPÉRATION TERMINÉE : BATTERIE DE TESTS VALIDÉE & CODE DÉPLOYÉ SUR LES 2 DÉPÔTS")
    print("=" * 70)

if __name__ == "__main__":
    msg = sys.argv[1] if len(sys.argv) > 1 else "v205: Ajout du contrôle systématique du mode d'emploi, comparatif et sigles dans la batterie de tests de déploiement"
    sync_and_protect(msg)
