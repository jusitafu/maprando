import sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--window-size=1920,1080")

driver = webdriver.Chrome(options=chrome_options)
try:
    url = "https://jusitafu.github.io/maprando/#accueil"
    driver.get(url)
    time.sleep(3)
    out_path = r"C:\Users\lesda\.gemini\antigravity\brain\234519d8-f927-43d3-91e7-0ba7ea503a12\screenshot_accueil_live.png"
    driver.save_screenshot(out_path)
    print("Screenshot saved to:", out_path)
finally:
    driver.quit()
