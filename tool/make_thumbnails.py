"""Compose the 1920x1080 promo thumbnails in docs/thumbnails/.

    python tool/make_thumbnails.py

Uses docs/screenshots/ledgerline/{mobile,desktop}/*.png, docs/branding/logo.svg
and the app's own typefaces (Fraunces for headings, Inter for text) in
docs/fonts/, from github.com/google/fonts. Pages are plain HTML rendered with
Playwright, with every image and font embedded, so the output is reproducible.
Writes ledgerline-thumb-1-hero.png, -2-devices.png, -3-gallery.png.
"""
import base64
import glob
import io
import os

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'docs', 'screenshots', 'ledgerline')
OUT = os.path.join(ROOT, 'docs', 'thumbnails')

# Copy from README.md (no invented features or numbers).
TAGLINE = 'Every entry balanced. Every report live.'
BLURB = ('Double-entry accounting for small businesses. Record balanced journal entries '
         'and get the ledger, trial balance, P&amp;L and balance sheet instantly.')
PILLS = ['Journal &amp; ledger', 'Live reports', 'Bank reconciliation', 'Invoices &amp; GST']

# The desktop screenshots are captured at 1440x1650. A laptop shows the top of
# the page: crop to 1440x940, which ends in the gap below the overview's stat
# cards (nothing is cut through). Frames use the cropped size's real ratio.
DESKTOP_CROP = {'desktop/01-dashboard': (0, 0, 1440, 940)}


def load(name):
    im = Image.open(shot_path(name)).convert('RGB')
    if name in DESKTOP_CROP:
        im = im.crop(DESKTOP_CROP[name])
    return im


def data_uri(im, max_w=1000):
    """Downscale + embed an image (keeps the HTML small)."""
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=95, subsampling=0)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def logo_uri():
    with open(os.path.join(ROOT, 'docs', 'branding', 'logo.svg'), 'rb') as f:
        return 'data:image/svg+xml;base64,' + base64.b64encode(f.read()).decode()


def font_face(family, rel, weight='100 900'):
    with open(os.path.join(ROOT, rel), 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    return (f"@font-face{{font-family:'{family}';font-weight:{weight};"
            f"src:url(data:font/ttf;base64,{b64}) format('truetype');}}")


def shot_path(name):
    return os.path.join(SHOTS, *name.split('/')) + '.png'


def shot(name, **kw):
    return data_uri(load(name), **kw)


def ratio(name):
    """height / width of a screenshot (after any crop), read from the file itself."""
    if name in DESKTOP_CROP:
        l, t, r, b = DESKTOP_CROP[name]
        return (b - t) / (r - l)
    with Image.open(shot_path(name)) as im:
        return im.height / im.width


# Palette from src/app/globals.css (dark theme) + docs/branding/logo.svg: "Emerald & Gold".
BG = '#0a1511'                     # --background (dark)
SURFACE = '#11201a'                # --surface (dark)
FG = '#e9f3ec'                     # --foreground (dark)
EMERALD_DEEP, EMERALD, GREEN, MINT = '#064e3b', '#0e8a5b', '#12a06a', '#3dd598'
GOLD, GOLD_LIGHT, GOLD_WARM = '#f2c14e', '#ffe9a8', '#f5b83d'
GRAD = f'linear-gradient(135deg,{EMERALD_DEEP},{EMERALD} 52%,#1fa971)'  # .bg-brand-gradient
GOLD_GRAD = f'linear-gradient(135deg,{GOLD_LIGHT},{GOLD_WARM})'          # .bg-gold-gradient

CSS = f'''
* {{ box-sizing: border-box; margin: 0; }}
html, body {{ width: 1920px; height: 1080px; overflow: hidden; }}
body {{
  font-family: Inter, "Segoe UI", Arial, sans-serif; color: {FG}; position: relative;
  background:
    radial-gradient(1100px 760px at 10% -12%, rgba(18,160,106,.24), transparent 60%),
    radial-gradient(900px 640px at 98% 2%, rgba(242,193,78,.15), transparent 60%),
    radial-gradient(900px 700px at 55% 118%, rgba(61,213,152,.12), transparent 60%),
    {BG};
}}
/* faint ledger ruling */
body::before {{
  content: ""; position: absolute; inset: 0; opacity: .55;
  background-image: linear-gradient(rgba(233,243,236,.05) 1.5px, transparent 1.5px);
  background-size: 100% 44px;
  -webkit-mask-image: radial-gradient(ellipse at 60% 40%, #000 15%, transparent 75%);
  mask-image: radial-gradient(ellipse at 60% 40%, #000 15%, transparent 75%);
}}
.abs {{ position: absolute; }}
.glow {{ position: absolute; border-radius: 50%; filter: blur(30px); pointer-events: none; }}
.vig {{ position: absolute; inset: 0; background: radial-gradient(1400px 900px at 60% 50%, transparent 55%, rgba(0,0,0,.4) 100%); pointer-events: none; z-index: 8; }}
.spark {{ position: absolute; width: 56px; height: 56px; z-index: 6; }}
.logo {{ filter: drop-shadow(0 18px 40px rgba(0,0,0,.55)) drop-shadow(0 0 40px rgba(18,160,106,.35)); }}
h1 {{ font-family: Fraunces, Georgia, serif; font-weight: 700; letter-spacing: -4px; line-height: 1; white-space: nowrap;
  font-variation-settings: "opsz" 144, "SOFT" 0, "WONK" 0; }}
h1 b {{ font-weight: 700; background: linear-gradient(90deg,{MINT},{GOLD});
  -webkit-background-clip: text; background-clip: text; color: transparent; padding-right: 6px; }}
.tag {{ font-family: Fraunces, Georgia, serif; font-weight: 600; letter-spacing: -.5px; white-space: nowrap;
  font-variation-settings: "opsz" 72;
  background: linear-gradient(90deg,{MINT},#b8e986 55%,{GOLD}); -webkit-background-clip: text; background-clip: text; color: transparent; }}
.blurb {{ color: rgba(233,243,236,.74); line-height: 1.42; }}
.pills {{ display: flex; flex-wrap: wrap; gap: 14px; width: 800px; }}
.pill {{
  display: inline-flex; align-items: center; gap: 12px; padding: 10px 22px;
  border-radius: 999px; border: 2px solid rgba(233,243,236,.13);
  background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03)); font-size: 26px; font-weight: 600;
}}
.pill i {{ width: 12px; height: 12px; border-radius: 50%; background: {GOLD_GRAD}; display: block; box-shadow: 0 0 10px rgba(242,193,78,.6); }}
.chip {{ display: inline-flex; align-items: center; gap: 12px; padding: 12px 26px;
  border-radius: 999px; background: {GRAD}; color: #fff; font-weight: 700; font-size: 26px; white-space: nowrap;
  border: 2px solid rgba(61,213,152,.45); box-shadow: 0 10px 30px -8px rgba(18,160,106,.6); }}
.chip i {{ width: 12px; height: 12px; border-radius: 50%; background: {GOLD}; display: block; }}
.plat {{ white-space: nowrap; font-size: 25px; font-weight: 600; color: rgba(233,243,236,.68); letter-spacing: .3px; }}
.phone {{
  position: absolute; background: #050a08; border-radius: 64px; padding: 14px;
  box-shadow: 0 0 0 3px #2a3a33, 0 40px 90px rgba(0,0,0,.7), 0 0 0 1px #000 inset;
}}
.phone .scr {{ position: relative; border-radius: 50px; overflow: hidden; background: #f4f3ec; width: 100%; height: 100%; }}
.phone .bar {{ height: 44px; background: #f4f3ec; }}
.phone img {{ width: 100%; height: auto; display: block; }}
.phone .notch {{ position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  width: 30%; height: 24px; background: #000; border-radius: 99px; z-index: 2; }}
.laptop-screen {{
  position: absolute; background: #050a08; border-radius: 24px; padding: 14px;
  box-shadow: 0 0 0 3px #2a3a33, 0 40px 90px rgba(0,0,0,.65);
}}
.laptop-screen img {{ width: 100%; height: auto; display: block; border-radius: 10px; }}
.laptop-base {{ position: absolute; height: 22px; border-radius: 0 0 26px 26px;
  background: linear-gradient(#3a4a43, #18211d); box-shadow: 0 30px 50px rgba(0,0,0,.5); }}
.laptop-base::after {{ content: ""; position: absolute; left: 50%; top: 0; transform: translateX(-50%);
  width: 160px; height: 8px; border-radius: 0 0 10px 10px; background: #111814; }}
.card {{
  position: absolute; display: flex; align-items: center; gap: 22px; padding: 22px 34px 22px 22px;
  border-radius: 28px; background: rgba(17,32,26,.95); border: 2px solid rgba(233,243,236,.12);
  box-shadow: 0 24px 60px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.06) inset; z-index: 7; white-space: nowrap;
}}
.card .ic {{ width: 78px; height: 78px; border-radius: 20px; display: grid; place-items: center; }}
.card small {{ display: block; font-size: 26px; color: rgba(233,243,236,.62); letter-spacing: .3px; }}
.card strong {{ display: block; font-size: 38px; font-weight: 800; letter-spacing: -.5px; font-variant-numeric: tabular-nums; }}
'''

SPARK = ('<svg class="spark" style="{s}" viewBox="0 0 100 100"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">'
         '<stop offset="0" stop-color="#fff4cf"/><stop offset="1" stop-color="#f2c14e"/></linearGradient></defs>'
         '<path d="M50 2 C54 38 62 46 98 50 C62 54 54 62 50 98 C46 62 38 54 2 50 C38 46 46 38 50 2 Z" fill="url(#sg)" opacity=".92"/></svg>')


def icon(path, stroke='#fff', size=44):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{stroke}" stroke-width="2.4" '
            f'stroke-linecap="round" stroke-linejoin="round">{path}</svg>')


ICON_SCALE = icon('<path d="M12 3v18M7 21h10M3 7h18"/><path d="m6 7-3 7a3 3 0 0 0 6 0Z"/><path d="m18 7-3 7a3 3 0 0 0 6 0Z"/>')
ICON_FILE = icon('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
                 stroke='#3d2a05')
ICON_LOCK = icon('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>')
ICON_RECEIPT = icon('<path d="M5 3v18l2.5-1.5L10 21l2-1.5 2 1.5 2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5Z"/>'
                    '<path d="M9 9h6M9 13h6"/>', stroke='#3d2a05')


def card(style, ic, bg, small, strong):
    return (f'<div class="card" style="{style}"><div class="ic" style="background:{bg}">{ic}</div>'
            f'<div><small>{small}</small><strong>{strong}</strong></div></div>')


def phone(name, left, top, w, rot=0, z=1):
    """Phone frame sized from the screenshot's real aspect ratio (no cropping)."""
    h = phone_h(name, w)
    return (f'<div class="phone" style="left:{left}px;top:{top}px;width:{w}px;height:{h}px;'
            f'transform:rotate({rot}deg);z-index:{z}"><div class="scr"><div class="notch"></div><div class="bar"></div>'
            f'<img src="{shot("mobile/" + name)}"></div></div>')


def phone_h(name, w):
    return round((w - 28) * ratio('mobile/' + name)) + 44 + 28


def laptop(name, left, top, w):
    name = 'desktop/' + name
    h = round((w - 28) * ratio(name)) + 28
    return (f'<div class="laptop-screen" style="left:{left}px;top:{top}px;width:{w}px;height:{h}px">'
            f'<img src="{shot(name, max_w=1440)}"></div>'
            f'<div class="laptop-base" style="left:{left - 50}px;top:{top + h}px;width:{w + 100}px"></div>')


TITLE = 'Ledger<b>line</b>'


def left_block(t):
    pills = ''.join(f'<span class="pill"><i></i>{p}</span>' for p in PILLS)
    return f'''
  <img class="logo abs" src="{logo_uri()}" style="left:96px;top:{t - 14}px;width:188px;height:188px">
  <h1 class="abs" style="left:104px;top:{t + 190}px;font-size:150px">{TITLE}</h1>
  <div class="tag abs" style="left:110px;top:{t + 372}px;font-size:46px">{TAGLINE}</div>
  <div class="blurb abs" style="left:110px;top:{t + 452}px;width:820px;font-size:30px">{BLURB}</div>
  <div class="pills abs" style="left:110px;top:{t + 620}px">{pills}</div>
  <div class="abs" style="left:110px;top:{t + 790}px;display:flex;align-items:center;gap:24px">
    <span class="chip"><i></i>Built with Next.js</span>
    <span class="plat">Web &nbsp;&middot;&nbsp; Installable PWA &nbsp;&middot;&nbsp; Phone &amp; desktop</span>
  </div>'''


def hero():
    return (
        '<div class="glow" style="left:1060px;top:120px;width:820px;height:820px;background:radial-gradient(circle,rgba(18,160,106,.26),rgba(242,193,78,.07) 45%,transparent 68%)"></div>'
        + left_block(50)
        + SPARK.format(s='left:905px;top:110px;width:44px;height:44px')
        + SPARK.format(s='left:1010px;top:960px;width:38px;height:38px')
        + SPARK.format(s='left:1850px;top:420px;width:44px;height:44px')
        + phone('09-profit-and-loss', 1010, 270, 350, rot=-9, z=1)
        + phone('13-reconciliation-workspace', 1525, 260, 350, rot=8, z=1)
        + phone('04-journal-entry-balanced', 1245, 130, 420, rot=0, z=3)
        + card('left:1000px;top:40px', ICON_SCALE, GRAD, 'Every entry', 'Debits = credits')
        + card('left:1300px;top:905px', ICON_FILE, GOLD_GRAD, 'Export any report', 'PDF &amp; CSV')
        + '<div class="vig"></div>'
    )


def devices():
    return (
        '<div class="glow" style="left:1000px;top:160px;width:860px;height:760px;background:radial-gradient(circle,rgba(18,160,106,.22),transparent 66%)"></div>'
        + left_block(50)
        + SPARK.format(s='left:905px;top:110px;width:44px;height:44px')
        + SPARK.format(s='left:1835px;top:150px;')
        + laptop('01-dashboard', 990, 250, 800)
        + phone('19-quick-money-in', 1585, 330, 290, rot=0, z=3)
        + card('left:1010px;top:70px', ICON_LOCK, GRAD, 'Posted entries', 'Never edited, only reversed')
        + card('left:1000px;top:880px', ICON_RECEIPT, GOLD_GRAD, 'GST rates', '0 · 5 · 12 · 18 · 28%')
        + '<div class="vig"></div>'
    )


def gallery():
    specs = [  # name, width, top
        ('03-journal', 290, 410),
        ('09-profit-and-loss', 310, 370),
        ('13-reconciliation-workspace', 340, 308),
        ('21-invoices', 310, 370),
        ('10-balance-sheet', 290, 410),
    ]
    gap = 40
    total = sum(w for _, w, _ in specs) + gap * (len(specs) - 1)
    x = (1920 - total) // 2
    phones = ''
    for i, (n, w, y) in enumerate(specs):
        phones += phone(n, x, y, w, z=3 if i == 2 else 1)
        x += w + gap
    return f'''
  <div class="glow" style="left:560px;top:260px;width:800px;height:800px;background:radial-gradient(circle,rgba(18,160,106,.22),transparent 66%)"></div>
  <div class="abs" style="left:0;top:50px;width:1920px;display:flex;justify-content:center;align-items:center;gap:30px">
    <img class="logo" src="{logo_uri()}" style="width:150px;height:150px">
    <h1 style="font-size:136px">{TITLE}</h1>
  </div>
  <div class="tag abs" style="left:0;top:222px;width:1920px;text-align:center;font-size:50px">{TAGLINE}</div>
  {SPARK.format(s='left:160px;top:110px;')}
  {SPARK.format(s='left:1720px;top:200px;width:44px;height:44px')}
  {phones}
  <div class="vig"></div>'''


PAGES = {
    'ledgerline-thumb-1-hero.png': hero,
    'ledgerline-thumb-2-devices.png': devices,
    'ledgerline-thumb-3-gallery.png': gallery,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    css = font_face('Inter', 'docs/fonts/Inter.ttf') + font_face('Fraunces', 'docs/fonts/Fraunces.ttf') + CSS
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception:
            exe = sorted(glob.glob(os.path.join(os.environ.get('LOCALAPPDATA', ''), 'ms-playwright',
                                                'chromium-*', 'chrome-win*', 'chrome.exe')))[-1]
            browser = p.chromium.launch(executable_path=exe)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        for name, build in PAGES.items():
            page.set_content(f'<html><head><meta charset="utf-8"><style>{css}</style></head><body>{build()}</body></html>')
            page.wait_for_timeout(700)
            path = os.path.join(OUT, name)
            page.screenshot(path=path)
            with Image.open(path) as im:
                assert im.size == (1920, 1080), im.size
            print('saved', path)
        browser.close()


if __name__ == '__main__':
    main()
