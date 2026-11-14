import asyncio
import os
import http.server
import socketserver
import threading
from PIL import Image
from playwright.async_api import async_playwright

WORKDIR = r"C:\Users\lesda\.gemini\antigravity\scratch\maprando"
SCREEN_DIR = os.path.join(WORKDIR, "manual_screens")
PORT = 8911

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WORKDIR, **kwargs)

async def capture():
    os.makedirs(SCREEN_DIR, exist_ok=True)
    server = socketserver.TCPServer(("", PORT), Handler)
    thread = threading.Thread(target=server.serve_forever)
    thread.daemon = True
    thread.start()
    print(f"Serveur local démarré sur port {PORT}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        print("1. Chargement de l'application sur #carte...")
        await page.goto(f"http://localhost:{PORT}/index.html#carte", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        # -------------------------------------------------------------
        # CAPTURE 1 : CRÉATEUR D'ITINÉRAIRE GPX
        # -------------------------------------------------------------
        print("2. Préparation capture Créateur d'itinéraire GPX...")
        await page.evaluate("""() => {
            if (window.MapManagerInstance && window.MapManagerInstance.map) {
                window.MapManagerInstance.map.setView([43.1230, 5.7900], 15);
            }
        }""")
        await page.wait_for_timeout(1000)

        await page.click("#btn-create-gpx")
        await page.wait_for_selector("#gpx-creator-floating-panel", timeout=5000)

        # Ajouter 4 waypoints A, B, C, D réalistes
        await page.evaluate("""() => {
            const editor = window.GpxCreatorEditorInstance;
            editor.handleCreateMapClick(L.latLng(43.1217, 5.7856)); // A: Départ
            editor.handleCreateMapClick(L.latLng(43.1235, 5.7865)); // B: Étape
            editor.handleCreateMapClick(L.latLng(43.1245, 5.7910)); // C: Étape
            editor.handleCreateMapClick(L.latLng(43.1250, 5.7955)); // D: Arrivée
        }""")
        await page.wait_for_timeout(2000)

        # Repositionner le panneau flottant proprement sur le côté pour bien voir la carte et le tracé
        await page.evaluate("""() => {
            const panel = document.getElementById('gpx-creator-floating-panel');
            if (panel) {
                panel.style.left = '30px';
                panel.style.top = '75px';
                panel.style.transform = 'none';
            }
        }""")
        await page.wait_for_timeout(500)

        png_creator = os.path.join(SCREEN_DIR, "fig07b_creer_gpx.png")
        jpg_creator = os.path.join(SCREEN_DIR, "fig07b_creer_gpx.jpg")
        await page.screenshot(path=png_creator)
        im = Image.open(png_creator).convert("RGB")
        im.save(jpg_creator, "JPEG", quality=92)
        print(f"Capture Créateur GPX enregistrée: {jpg_creator}")

        # Quitter le mode création
        await page.click("#btn-close-gpx-creator")
        await page.wait_for_timeout(800)

        # -------------------------------------------------------------
        # CAPTURE 2 : MODIFICATION DE TRACE GPX
        # -------------------------------------------------------------
        print("3. Préparation capture Modification de Trace GPX...")
        await page.evaluate("""() => {
            const sampleTrackXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MapRando">
  <trk><name>Sentier Littoral & Baie de Sanary</name><trkseg>
    <trkpt lat="43.1200" lon="5.7840"><ele>12</ele></trkpt>
    <trkpt lat="43.1210" lon="5.7850"><ele>15</ele></trkpt>
    <trkpt lat="43.1217" lon="5.7856"><ele>20</ele></trkpt>
    <trkpt lat="43.1225" lon="5.7865"><ele>24</ele></trkpt>
    <trkpt lat="43.1232" lon="5.7880"><ele>28</ele></trkpt>
    <trkpt lat="43.1235" lon="5.7900"><ele>32</ele></trkpt>
    <trkpt lat="43.1240" lon="5.7925"><ele>30</ele></trkpt>
    <trkpt lat="43.1248" lon="5.7950"><ele>22</ele></trkpt>
    <trkpt lat="43.1255" lon="5.7980"><ele>15</ele></trkpt>
  </trkseg></trk>
</gpx>`;
            window.MapManagerInstance.loadStandaloneGpxContent(sampleTrackXml, "Sentier_Littoral.gpx");
        }""")
        await page.wait_for_timeout(1000)

        await page.click("#btn-edit-gpx")
        await page.wait_for_selector("#gpx-editor-floating-panel", timeout=5000)

        # Simuler une déviation de poignée vers un chemin voisin
        await page.evaluate("""() => {
            const editor = window.GpxCreatorEditorInstance;
            if (editor && editor.currentEditCoords && editor.currentEditCoords.length > 4) {
                editor.saveEditHistorySnapshot();
                // Déplacer poignée 4 vers le nord pour montrer la déviation
                editor.currentEditCoords[4] = [43.1260, 5.7895, 45];
                const latlngs = editor.currentEditCoords.map(c => [c[0], c[1]]);
                if (editor.editingTrack && editor.editingTrack.polyline) {
                    editor.editingTrack.polyline.setLatLngs(latlngs);
                }
                editor.generateEditHandles();
                const stats = editor.computeTrackStats(editor.currentEditCoords);
                const dEl = document.getElementById('gpx-edit-dist');
                if (dEl) dEl.innerText = `${stats.distanceKm.toFixed(2)} km`;
                const eEl = document.getElementById('gpx-edit-ele');
                if (eEl) eEl.innerText = `+${stats.elevationGain} m`;
            }

            const panel = document.getElementById('gpx-editor-floating-panel');
            if (panel) {
                panel.style.left = '30px';
                panel.style.top = '75px';
                panel.style.transform = 'none';
            }
        }""")
        await page.wait_for_timeout(1000)

        png_editor = os.path.join(SCREEN_DIR, "fig07c_modifier_gpx.png")
        jpg_editor = os.path.join(SCREEN_DIR, "fig07c_modifier_gpx.jpg")
        await page.screenshot(path=png_editor)
        im2 = Image.open(png_editor).convert("RGB")
        im2.save(jpg_editor, "JPEG", quality=92)
        print(f"Capture Modification GPX enregistrée: {jpg_editor}")

        await browser.close()
    server.shutdown()

if __name__ == "__main__":
    asyncio.run(capture())
