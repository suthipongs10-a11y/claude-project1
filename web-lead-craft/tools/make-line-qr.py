#!/usr/bin/env python3
"""Write a LINE add-friend QR into a site as an inline SVG partial.

A QR on a web page has to be drawn, not photographed. The image a client
sends is a screenshot of their phone: JPEG artefacts, a fixed size, and a
few hundred KB that has to travel to every visitor. The same code drawn as
SVG is about 2 KB, stays sharp at any size, inherits the page's colours,
and — unlike a photograph — is guaranteed to still scan after the browser
scales it down on a phone.

So we never embed the client's picture of their QR. We take the URL it
encodes and redraw it.

    python3 tools/make-line-qr.py sites/spm-live "https://lin.ee/xxxxxx"

Writes <site>/src/line-qr.svg, which the page holding the markers includes. Re-run whenever
the LINE account changes.
"""
import sys, pathlib
try:
    import qrcode
except ImportError:
    sys.exit('need `pip install qrcode` first')

if len(sys.argv) != 3:
    sys.exit(__doc__)
site, url = pathlib.Path(sys.argv[1]), sys.argv[2]
if not url.startswith(('https://line.me/', 'https://lin.ee/', 'https://page.line.me/')):
    sys.exit(f'that does not look like a LINE add-friend link: {url}\n'
             'expected https://lin.ee/… or https://line.me/R/ti/p/@… or https://page.line.me/…')

# High error correction: a QR gets photographed off a screen at an angle,
# and the extra redundancy is what makes that still work.
q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=1, border=2)
q.add_data(url)
q.make(fit=True)
m = q.get_matrix()
n = len(m)

# One <path> for the whole code rather than n² rects — smaller, and it means
# the colour is a single currentColor the page can theme.
d = []
for y, row in enumerate(m):
    x = 0
    while x < n:
        if row[x]:
            run = x
            while run < n and row[run]:
                run += 1
            d.append(f'M{x} {y}h{run - x}v1h-{run - x}z')
            x = run
        else:
            x += 1

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" '
       f'role="img" aria-label="LINE QR code" shape-rendering="crispEdges">'
       f'<rect width="{n}" height="{n}" fill="#fff"/>'
       f'<path fill="currentColor" d="{"".join(d)}"/></svg>\n')

# Read it back before writing anything. A QR that encodes the wrong string,
# or none, looks exactly like a working one — nobody finds out until a
# customer points a phone at it and nothing happens. Decoding the modules we
# are about to draw is the only way to know.
try:
    import cv2, numpy as np
    px = 8
    img = np.full(((n + 2) * px, (n + 2) * px), 255, dtype=np.uint8)
    for y, row in enumerate(m):
        for x, on in enumerate(row):
            if on:
                img[(y + 1) * px:(y + 2) * px, (x + 1) * px:(x + 2) * px] = 0
    got, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    if got != url:
        sys.exit(f'the code does not read back as the url it was given.\n'
                 f'  wanted: {url}\n  decoded: {got!r}\nnothing written.')
    print(f'verified: decodes back to {url}')
except ImportError:
    print('note: opencv not installed, skipping the read-back check '
          '(`pip install opencv-python-headless` to enable it)')

out = site / 'src' / 'line-qr.svg'
out.write_text(svg)
print(f'{out}  {n}x{n} modules, {len(svg)} bytes  <- {url}')

# Drop it straight into the page between the markers, so there is no build
# step to remember and no second copy to fall out of date. A one-page site
# keeps them in body.html; a multi-page one in whichever page shows the code,
# with the LINE buttons spread across its pages and partials.
src = site / 'src'
files = [f for f in [src / 'body.html', *sorted((src / 'pages').glob('*.html')),
                     *sorted((src / 'partials').glob('*.html'))] if f.exists()]
START, END = '<!-- line-qr:start -->', '<!-- line-qr:end -->'
body = next((f for f in files if START in f.read_text() and END in f.read_text()), None)
if body is None:
    sys.exit(f'no {START} … {END} markers in {src} — nothing to fill in')
t = body.read_text()
a = t.index(START) + len(START)
b = t.index(END)
body.write_text(t[:a] + '\n          ' + svg.strip() + '\n          ' + t[b:])
print(f'{body}  QR inlined between markers')

# And the href everywhere it appears.
import re
for f in files:
    t = f.read_text()
    before = t
    # Both the placeholder anchor and any previous LINE url, so the button works
    # whether this is the first run or a change of account.
    t = re.sub(r'href="#line"', f'href="{url}"', t)
    t = re.sub(r'href="https://(?:lin\.ee|line\.me|page\.line\.me)/[^"]*"', f'href="{url}"', t)
    if t != before:
        f.write_text(t)
        print(f'{f}  LINE links pointed at {url}')
