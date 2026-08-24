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

Writes <site>/src/line-qr.svg, which body.html includes. Re-run whenever
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

out = site / 'src' / 'line-qr.svg'
out.write_text(svg)
print(f'{out}  {n}x{n} modules, {len(svg)} bytes  <- {url}')

# Drop it straight into body.html between the markers, so there is no build
# step to remember and no second copy to fall out of date.
body = site / 'src' / 'body.html'
START, END = '<!-- line-qr:start -->', '<!-- line-qr:end -->'
t = body.read_text()
if START not in t or END not in t:
    sys.exit(f'{body} has no {START} … {END} markers — nothing to fill in')
a = t.index(START) + len(START)
b = t.index(END)
body.write_text(t[:a] + '\n          ' + svg.strip() + '\n          ' + t[b:])
print(f'{body}  QR inlined between markers')

# And the href everywhere it appears.
t = body.read_text()
import re
before = t
t = re.sub(r'href="https://(?:lin\.ee|line\.me|page\.line\.me)/[^"]*"', f'href="{url}"', t)
if t != before:
    body.write_text(t)
    print(f'{body}  {before.count("lin.ee") - 0 and ""}LINE links pointed at {url}')
