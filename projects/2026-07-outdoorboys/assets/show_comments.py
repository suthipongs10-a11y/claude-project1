import json
d = json.load(open(r'C:\Work\VideoTest\projects\2026-07-outdoorboys\assets\goodbye.info.json', encoding='utf-8'))
print('title:', d.get('title'))
print('views:', d.get('view_count'))
comments = d.get('comments') or []
print('comments fetched:', len(comments))
top = sorted(comments, key=lambda c: c.get('like_count') or 0, reverse=True)[:8]
for c in top:
    t = (c.get('text') or '').replace('\n', ' ')[:110]
    print(f"  [{c.get('like_count')}] {c.get('author')}: {t}")
