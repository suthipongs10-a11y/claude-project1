# สร้างการ์ดกราฟิก 1080x1920 สำหรับคลิป Outdoor Boys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(r"C:\Work\VideoTest\projects\2026-07-outdoorboys\assets")
W, H = 1080, 1920
BG = (13, 13, 15)
YELLOW = (255, 230, 0)
RED = (255, 60, 60)
GREEN = (60, 235, 120)
WHITE = (245, 245, 245)
GREY = (150, 150, 155)

def font(size, bold=True):
    p = r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf"
    try:
        return ImageFont.truetype(p, size)
    except Exception:
        return ImageFont.load_default()

def card(lines, name):
    """lines = [(text, size, color, gap_after)]"""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    total = sum(font(s).getbbox(t)[3] + g for t, s, c, g in lines)
    y = (H - total) // 2
    for t, s, c, g in lines:
        f = font(s)
        bbox = d.textbbox((0, 0), t, font=f)
        tw = bbox[2] - bbox[0]
        d.text(((W - tw) // 2, y), t, font=f, fill=c)
        y += (bbox[3] - bbox[1]) + g
    img.save(OUT / name)
    print("saved", name)

# 2: lawyer
card([("BY DAY:", 70, GREY, 30), ("LAWYER", 160, WHITE, 40), ("suits. courtrooms. paperwork.", 50, GREY, 0)], "g01-lawyer.png")

# 5: subs chart (matplotlib)
fig, ax = plt.subplots(figsize=(9, 16), dpi=120)
fig.patch.set_facecolor("#0d0d0f"); ax.set_facecolor("#0d0d0f")
months = list(range(19)); subs = [2 + 12 * (m / 18) ** 2.2 for m in months]
ax.plot(months, subs, color="#FFE600", linewidth=8)
ax.fill_between(months, subs, color="#FFE600", alpha=0.15)
ax.set_title("+12,000,000 SUBS\nIN 18 MONTHS", color="white", fontsize=42, fontweight="bold", pad=30)
ax.set_xticks([]); ax.set_yticks([])
for sp in ax.spines.values(): sp.set_visible(False)
ax.text(0, 2.3, "2M", color="#999", fontsize=30, fontweight="bold")
ax.text(15.6, 13.3, "14M", color="#FFE600", fontsize=34, fontweight="bold")
plt.tight_layout(); plt.savefig(OUT / "g02-subs-chart.png", facecolor="#0d0d0f"); plt.close()
print("saved g02-subs-chart.png")

# 6: 100 hours
card([("100-HOUR", 150, RED, 20), ("WEEKS", 150, WHITE, 50), ("behind the camera", 55, GREY, 0)], "g03-100hours.png")

# 7: 4 billion stolen
card([("4,000,000,000", 120, RED, 30), ("VIEWS", 140, WHITE, 20), ("STOLEN", 160, RED, 0)], "g04-4billion.png")

# 8: kids
card([("FAME", 150, YELLOW, 40), ("was closing in on", 55, GREY, 40), ("HIS KIDS", 150, RED, 0)], "g05-kids.png")

# 11: headlines (จริงทุกบรรทัด)
img = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(img)
headlines = [
    ("“Outdoor Boys” YouTube channel", 58, WHITE),
    ("shuts down: How social", 58, WHITE),
    ("media reacted", 58, WHITE),
    ("— Deseret News", 42, GREY),
    ("", 40, GREY),
    ("Popular Alaska outdoors YouTuber", 58, WHITE),
    ("packing up ‘Outdoor Boys’", 58, WHITE),
    ("— KSL", 42, GREY),
    ("", 40, GREY),
    ("Outdoor Boys Quit YouTube", 58, YELLOW),
    ("After Years of Adventure", 58, YELLOW),
]
y = 560
for t, s, c in headlines:
    f = font(s); bbox = d.textbbox((0, 0), t, font=f); tw = bbox[2] - bbox[0]
    d.text(((W - tw) // 2, y), t, font=f, fill=c); y += bbox[3] - bbox[1] + 26
img.save(OUT / "g06-headlines.png"); print("saved g06-headlines.png")

# 10: on purpose
card([("AT HIS", 110, GREY, 20), ("ABSOLUTE PEAK.", 110, WHITE, 60), ("ON PURPOSE.", 120, YELLOW, 0)], "g07-onpurpose.png")

# 14: is he back?
card([("IS HE", 150, WHITE, 30), ("BACK?", 190, YELLOW, 60), ("?", 200, GREY, 0)], "g08-isheback.png")

# 15: quote card
card([("“Just doing exactly", 80, WHITE, 25), ("what I told you", 80, WHITE, 25), ("I was going to do.”", 80, WHITE, 60), ("— Luke Nichols", 55, YELLOW, 0)], "g09-quote.png")

# 16: family first
card([("NO REGRETS.", 100, GREY, 40), ("FAMILY", 170, GREEN, 20), ("FIRST.", 170, WHITE, 0)], "g10-family.png")

# 17: 20M chart
card([("20,000,000", 130, YELLOW, 30), ("SUBSCRIBERS", 100, WHITE, 50), ("still growing — without him", 55, GREY, 0)], "g11-20m.png")

# 18: CTA
card([("HERO…", 160, GREEN, 40), ("or CRAZY?", 160, RED, 70), ("COMMENT BELOW", 65, WHITE, 25), ("▼", 80, YELLOW, 0)], "g12-cta.png")

print("done")
