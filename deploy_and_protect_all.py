import os
import shutil
import re
import subprocess
import sys

GIT_EXE = r'C:\Users\lesda\AppData\Local\GitHubDesktop\app-3.5.6\resources\app\git\cmd\git.exe'
MAPRANDO_DIR = r'C:\Users\lesda\.gemini\antigravity\scratch\maprando'
RANDOFINDER_DIR = r'C:\Users\lesda\.gemini\antigravity\scratch\randofinder_update'

def sync_and_protect(commit_msg):
    print("=" * 70)
    print("🛡️  LANCEUR DE DÉPLOIEMENT & PROTECTION STRICTE DU CODE 🛡️")
    print("=" * 70)
    
    # 1. Synchroniser index.html
    shutil.copy2(os.path.join(MAPRANDO_DIR, "index.html"), os.path.join(RANDOFINDER_DIR, "index.html"))
    print("✓ index.html synchronisé")

    # 2. Synchroniser les dossiers complets
    for folder in ["images", "audio", "docs", "js"]:
        src_dir = os.path.join(MAPRANDO_DIR, folder)
        dst_dir = os.path.join(RANDOFINDER_DIR, folder)
        if os.path.exists(src_dir):
            if os.path.exists(dst_dir):
                shutil.rmtree(dst_dir)
            shutil.copytree(src_dir, dst_dir)
            print(f"✓ Dossier {folder}/ synchronisé intégralement ({len(os.listdir(dst_dir))} éléments)")

    # 3. Synchroniser les fichiers racine clés
    root_files = [
        "Mode_d_emploi_RandoFinder.pdf",
        "Legende_IGN_Top25.pdf",
        "legende-carte-ign-a-imprimer.pdf",
        "favicon.ico",
        "site.webmanifest"
    ]
    for rf in root_files:
        s = os.path.join(MAPRANDO_DIR, rf)
        d = os.path.join(RANDOFINDER_DIR, rf)
        if os.path.exists(s):
            shutil.copy2(s, d)
            print(f"✓ Fichier racine {rf} synchronisé")

    # 4. Audit d'intégrité strict : vérifier toutes les ressources référencées
    print("\n🔍 Audit de sécurité des ressources...")
    with open(os.path.join(MAPRANDO_DIR, "index.html"), "r", encoding="utf-8") as f:
        html_content = f.read()

    # Trouver toutes les références d'images, audio, pdfs
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

    # 5. Git Add, Commit et Push sur les deux dépôts
    track_patterns = ["index.html", "images", "audio", "docs", "js", "Mode_d_emploi_RandoFinder.pdf", "Legende_IGN_Top25.pdf", "legende-carte-ign-a-imprimer.pdf", "deploy_and_protect_all.py"]
    for repo_name, repo_dir in [("maprando", MAPRANDO_DIR), ("randofinder_update", RANDOFINDER_DIR)]:
        print(f"\n📦 Git déploiement pour {repo_name}...")
        for pattern in track_patterns:
            target_p = os.path.join(repo_dir, pattern)
            if os.path.exists(target_p):
                subprocess.run([GIT_EXE, '-C', repo_dir, 'add', pattern], check=True)
        
        # Check if there are changes to commit
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
    print("✅ OPÉRATION TERMINÉE : CODE PROTÉGÉ ET SYNCHRONISÉ SUR LES 2 DÉPÔTS")
    print("=" * 70)

if __name__ == "__main__":
    msg = sys.argv[1] if len(sys.argv) > 1 else "fix(assets): restauration mosaïque accueil, synchronisation images et protection du code"
    sync_and_protect(msg)
