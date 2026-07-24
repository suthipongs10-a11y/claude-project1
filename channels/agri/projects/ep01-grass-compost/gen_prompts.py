#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_prompts.py — สร้าง PROMPTS.json (agri EP.01) จากภาพใน manifest

กติกา: ภาพไม่มีตัวหนังสือ (caption/label/punch เติมทีหลังด้วย HyperFrames วางในที่ว่าง)
ทุกภาพมีฉากหลังฟาร์ม/สวน, ไอคอนเป็นกราฟิก (ลูกศร/กากบาท/ปฏิทิน/เทอร์โม) ไม่ใช่ตัวอักษร
มาสคอต+STYLE ต่อท้ายอัตโนมัติจาก --style-file (channels/agri/CHANNEL-STYLE.md)
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

# palette hint ย่อ: leaf #4CA64C, deep #2E7D32, soil #8B5E3C, cream #FBF6EC,
#                    sky #7EC8E3, sun #FFC93C, tomato #E8613C
P = {
 "img01":"The mascot pushes a small hand lawn mower across a bright green backyard lawn, sweeping fresh grass clippings into a sack. Sunny blue sky (#7EC8E3), a house and a tree behind. Leave a clean open area upper-left for a caption.",
 "img02":"Several bulging sacks of grass clippings piled together in the backyard, drawn surprisingly large; the mascot stands beside them with a wide-eyed surprised look, one hand raised. Green lawn and house background. Leave open sky area upper-right for a caption.",
 "img03":"The mascot drags one big heavy sack of grass clippings toward a trash bin, leaning back with a tired strained expression, small effort marks. Backyard with fence and tree. Leave open area upper-left for a caption.",
 "img04":"The mascot throws up both hands in a big STOP gesture, eyes wide; beside it a sack of grass clippings glows warmly like treasure with a soft golden aura (#FFC93C). Backyard background. Leave open area upper-right for a caption.",
 "img05":"The mascot points proudly at a glowing green pile of grass clippings that shines like treasure with a soft golden glow (#FFC93C). A leafy green plant beside it. Garden background. Leave open area top for a caption.",
 "img06":"A close vibrant view of fresh green leaves (#2E7D32) bursting new shoots on a fast-growing plant, with a bold curved arrow of green energy flowing into the stem. Sunny garden background. Leave open area upper-left for a caption.",
 "img07":"The mascot gestures at a simple hand-drawn diagram: a green grass pile, a big arrow, then a brown compost pile (#8B5E3C). Backyard garden setting. Leave open area top for a caption.",
 "img08":"The mascot grins broadly and holds up a tall lush green vegetable plant; beside it a little coin and money-bag icon (#FFC93C) showing it is free. Vegetable-patch background. Leave open area upper-right for a caption.",
 "img09":"The mascot rolls up its sleeves in a determined ready-to-go pose, inviting the viewer with a warm smile. Backyard vegetable garden with raised beds behind. Leave open area upper-left for a caption.",
 "img10":"The mascot stands beside a simple wooden explainer board gesturing as if teaching, welcoming pose. Sunny garden background. Leave the board and open area upper-right free for a caption.",
 "img11":"The mascot proudly holds up one handful of freshly cut green grass, showing it to the viewer. Grassy field and blue sky background. Leave open area upper-left for a caption.",
 "img12":"A glowing green pile of grass clippings with a bold graphic capital letter N icon floating above it and three small nutrient droplet icons. Garden ground background. Leave open area top for a caption.",
 "img13":"The mascot points at a chemical fertilizer bag; on the bag a large bold letter N glows brightly (#4CA64C) among faint number icons. Garden-shed background. Leave open area upper-right for a caption.",
 "img14":"Fresh green leaves sprouting rapidly on a plant, surrounded by little sparkle energy marks, strong healthy green (#2E7D32). Sunny garden background. Leave open area upper-left for a caption.",
 "img15":"A potted plant whose lower leaves are pale yellow and sickly, stunted and weak; the mascot looks at it with a worried caring expression. Home garden background. Leave open area upper-right for a caption.",
 "img16":"The same potted plant now revived, deep green with fresh new shoots, looking vigorous; the mascot smiles happily beside it. Sunny garden background. Leave open area upper-left for a caption.",
 "img17":"The mascot points at a big cartoon gauge dial whose needle swings to a high 'full' zone, mounted beside a fresh green grass pile. Garden background. Leave open area top for a caption.",
 "img18":"The mascot points at a row of commercial fertilizer bags lined up on a farm-store shelf. Simple shop-shelf background. Leave open area upper-right for a caption.",
 "img19":"A urea fertilizer bag with a bold rising price arrow (#E8613C) climbing above it; the mascot looks shocked; beside it a free green grass pile. Farm-store background. Leave open area upper-left for a caption.",
 "img20":"A glowing green grass pile with a small price-tag icon showing zero, radiating a soft golden glow (#FFC93C) to say it gives the same nitrogen for free. Garden background. Leave open area top for a caption.",
 "img21":"A hand tosses a sack of grass clippings into a trash bin, but silver coins (#FFC93C) spill and scatter out of the sack in mid-air. Backyard background. Leave open area upper-right for a caption.",
 "img22":"The mascot shrugs with both palms up and a puzzled why-throw-it-away expression, a green grass pile beside it. Backyard garden background. Leave open area upper-left for a caption.",
 "img23":"The mascot raises a hand in a wait-a-moment warning gesture with a cautioning face; a heap of grass sits in a garden corner. Garden background. Leave open area upper-right for a caption.",
 "img24":"A pile of pure fresh grass gone soggy and slimy after a few days, with a small calendar icon showing a few days passed. Shady garden-corner background. Leave open area top for a caption.",
 "img25":"A grass pile turned into dark sticky black slime with wavy stink lines rising and a couple of flies; the mascot pinches its nose and flees. Garden-corner background. Leave open area upper-right for a caption.",
 "img26":"A cutaway view of a densely packed matted grass pile; small air arrows try to enter but are blocked, shown compressed and airless. Garden ground background. Leave open area upper-left for a caption.",
 "img27":"Inside a dark pile, a cute smiling good-microbe character fades and dies while a grumpy sour-faced rot character takes over. Dark compost interior background. Leave open area top for a caption.",
 "img28":"A balance scale perfectly level: left pan holds green grass, right pan holds brown dry material (#8B5E3C), evenly balanced. Garden background. Leave open area top for a caption.",
 "img29":"Two piles side by side: a green grass pile on the left with a floating N icon, a brown dry-material pile on the right with a floating C icon. Garden ground. Leave open area top for a caption.",
 "img30":"The mascot explains beside a big graphic ratio mark of green grass versus dry brown leaves, gesturing at the balance between them. Garden background. Leave open area upper-right for a caption.",
 "img31":"Inside a compost pile, many tiny cartoon microbe workers wearing little hard hats bustle about busily. Warm brown compost interior (#8B5E3C). Leave open area top for a caption.",
 "img32":"A cartoon microbe worker eats a glowing green food cube and lights up with sparks of energy, working fast. Compost interior background. Leave open area upper-right for a caption.",
 "img33":"Brown dry chunks act like posts and beams giving the pile an airy open structure with air gaps; microbe workers breathe easily. Compost interior background. Leave open area upper-left for a caption.",
 "img34":"A pile of only packed green material, dark and airless; microbe workers collapse exhausted, faint stink lines. Dark compost interior. Leave open area top for a caption.",
 "img35":"The mascot holds up a handful of dry brown leaves, presenting them. Sunny garden background. Leave open area upper-right for a caption.",
 "img36":"An assortment of brown dry materials arranged so each is clear: rice straw, rice husk, sawdust, torn cardboard, small twigs, dry leaves (#8B5E3C). Garden ground background. Leave open area top for a caption.",
 "img37":"A left-versus-right comparison: left side an all-green slimy stinky pile, right side an all-brown bone-dry lifeless pile. Garden background. Leave open area top for a caption.",
 "img38":"The mascot uses a hoe to mix green grass and dry brown leaves together in just-right balance, smiling. Backyard garden background. Leave open area upper-left for a caption.",
 "img39":"The mascot rolls up its sleeves standing before a heap of materials, ready to start the four steps. Backyard garden with raised beds. Leave open area upper-right for a caption.",
 "img40":"Two prepared heaps side by side: a fresh green grass heap and a dry brown material heap; the mascot points at each in turn. Garden ground background. Leave open area top for a caption.",
 "img41":"Two equal measuring buckets: one filled with green grass, one with dry brown material, showing a one-to-one portion. Garden background. Leave open area upper-right for a caption.",
 "img42":"A large grass heap; the mascot shovels in more dry brown material to make the amounts roughly equal. Backyard garden background. Leave open area upper-left for a caption.",
 "img43":"The mascot chops grass and twigs into small pieces with a knife-hoe, with little bits flying off. Garden ground background. Leave open area upper-right for a caption.",
 "img44":"The mascot lays down a first layer of green grass in a compost bin. Backyard garden background. Leave open area top for a caption.",
 "img45":"A lasagna-style layered compost pile: a layer of green grass, then a layer of dry brown leaves, alternating clearly in visible stripes (#4CA64C / #8B5E3C). Garden ground. Leave open area top for a caption.",
 "img46":"The mascot gently waters the compost pile with a watering can to make it just damp. Backyard garden background. Leave open area upper-right for a caption.",
 "img47":"A sponge being wrung out to just-damp, no dripping water, as a moisture reference icon. Soft garden background. Leave open area upper-left for a caption.",
 "img48":"The mascot stands beside a big compost pile with a measuring ruler icon showing its large size. Backyard garden. Leave open area upper-right for a caption.",
 "img49":"A roughly one-cubic-meter compost pile with faint heat shimmer beginning to rise from it. Backyard garden background. Leave open area top for a caption.",
 "img50":"The mascot drapes a tarp or sack over the compost pile to shield it from rain and sun. Backyard garden background. Leave open area upper-left for a caption.",
 "img51":"A compost pile starting to steam with rising heat lines after a few days, a small calendar icon nearby. Backyard garden background. Leave open area upper-right for a caption.",
 "img52":"The mascot holds a hand just above the steaming compost pile, feeling the warmth, with a pleasantly surprised delighted face. Garden background. Leave open area upper-left for a caption.",
 "img53":"Heat shimmer rises from the pile as a signal while cartoon microbe workers labor at full energy inside. Warm compost interior. Leave open area top for a caption.",
 "img54":"A cartoon thermometer stuck into the pile with its needle in a high hot zone (#E8613C), microbe workers energetically busy around it. Compost background. Leave open area upper-right for a caption.",
 "img55":"Heat inside the pile shown killing tiny weed seeds and little germ icons with small red X marks. Compost interior background. Leave open area top for a caption.",
 "img56":"A calendar icon marking every one-to-two weeks; the mascot holds a hoe or fork, ready to turn the pile. Backyard garden. Leave open area upper-left for a caption.",
 "img57":"The mascot turns the compost pile with a fork, moving the outside to the inside, with curved air arrows flowing in. Garden ground background. Leave open area upper-right for a caption.",
 "img58":"The mascot turns the pile diligently; a small clock icon shows it goes faster, and no stink lines rise. Backyard garden. Leave open area upper-left for a caption.",
 "img59":"A calendar icon marking four-to-eight weeks while the compost pile gradually shrinks down. Backyard garden background. Leave open area top for a caption.",
 "img60":"The pile has become dark crumbly brown finished compost (#8B5E3C) with gentle sweet earthy-smell swirl lines rising. Garden ground background. Leave open area upper-right for a caption.",
 "img61":"The mascot scoops up a handful of dark crumbly finished compost, smiling with pride, soft earthy-scent lines. Backyard garden background. Leave open area upper-left for a caption.",
 "img62":"The mascot relaxes in a hammock while beside it a well-balanced compost pile works on its own. Shady garden background. Leave open area upper-right for a caption.",
 "img63":"A no-turn compost pile with a calendar icon showing three-to-six months, indicating it is slower. Garden background. Leave open area top for a caption.",
 "img64":"A cold compost pile that is not steaming; the mascot scratches its head, puzzled why it is not hot. Backyard garden. Leave open area upper-right for a caption.",
 "img65":"The mascot adds more grass clippings and pours extra water onto the pile to heat it up. Backyard garden background. Leave open area upper-left for a caption.",
 "img66":"A pile giving off stink lines; the mascot sprinkles in more dry brown material and turns it. Garden ground background. Leave open area upper-right for a caption.",
 "img67":"The mascot raises a hand in warning beside a graphic no-entry prohibition symbol, introducing what not to add. Garden background. Leave open area top for a caption.",
 "img68":"Scraps of meat, bones and an oil bottle crossed out with a bold red X, with a rat and flies drawn coming to them. Garden-corner background. Leave open area upper-right for a caption.",
 "img69":"Dog and cat droppings crossed out with a bold red X, with tiny germ icons floating up. Garden-corner background. Leave open area upper-left for a caption.",
 "img70":"A plant with spotted leaf disease crossed out with a bold red X, tiny germs spreading. Garden background. Leave open area top for a caption.",
 "img71":"The mascot holds up plant-based scraps (leaves, vegetable peels, grass), smiling and giving a thumbs up for safe. Garden background. Leave open area upper-right for a caption.",
 "img72":"The mascot holds a basin of ready-to-use finished compost with several arrows pointing outward to different uses. Garden background. Leave open area top for a caption.",
 "img73":"The mascot sprinkles compost around the base of vegetable plants and mixes compost into potting soil, roughly one part to three. Vegetable-garden background. Leave open area upper-right for a caption.",
 "img74":"A row of a kitchen vegetable patch, fruit trees, flowering plants and pots all lined up, all getting compost. Sunny garden background. Leave open area top for a caption.",
 "img75":"Leafy vegetables (lettuce, kale) with rich deep green leaves growing beautifully and fast; the mascot smiles. Vegetable-garden background. Leave open area upper-right for a caption.",
 "img76":"A before-and-after of a vegetable plant, the after one clearly bigger and faster-grown; the mascot looks excited. Garden background. Leave open area upper-left for a caption.",
 "img77":"The mascot sprinkles a thin layer of compost around the base of a growing plant, a calendar icon showing once a month. Garden background. Leave open area upper-right for a caption.",
 "img78":"The mascot mows the lawn and leaves the grass clippings right on the lawn instead of collecting them. Sunny backyard lawn background. Leave open area top for a caption.",
 "img79":"Grass clippings on the lawn slowly break down and vanish while the lawn turns fresher and greener. Sunny backyard background. Leave open area upper-left for a caption.",
 "img80":"The mascot raises a hand in a three-cautions warning gesture. Garden background. Leave open area upper-right for a caption.",
 "img81":"Thick fresh grass piled heavily right against a plant's base, crossed out with a red X, with heat shimmer rising. Garden background. Leave open area top for a caption.",
 "img82":"A plant wilting and drooping as curved arrows suck nitrogen (N) out of the soil during decomposition. Garden ground background. Leave open area upper-right for a caption.",
 "img83":"A lawn with a herbicide-spray marker and a chemical bottle, crossed out with a red X, warning of residue lasting across the year. Garden background. Leave open area upper-left for a caption.",
 "img84":"Garden vegetables wilting and dying from chemical residue while the mascot raises a hand: if unsure, do not compost. Garden background. Leave open area upper-right for a caption.",
 "img85":"A compost pile with balanced graphic air-swirl and water-drop symbols in just-right proportion. Garden ground background. Leave open area top for a caption.",
 "img86":"A compost pile starting to smell (stink lines); the mascot quickly adds more dry brown material and turns it. Garden background. Leave open area upper-right for a caption.",
 "img87":"The mascot holds up a basin of finished compost while beside it a trash bag is crossed out with an X (not garbage, but free fertilizer). Garden background. Leave open area top for a caption.",
 "img88":"A summary strip of simple step icons in a row: mix, then water, then turn, then wait, then a finished compost pile, joined by arrows. Clean garden background. Leave open area top for a caption.",
 "img89":"The mascot saves a sack of grass clippings for composting instead of throwing it away, with a saved-coin icon and a lush plant. Backyard garden. Leave open area upper-right for a caption.",
 "img90":"The mascot points at a like button and a subscribe bell, smiling warmly. Green garden background. Leave open area upper-left for a caption.",
 "img91":"The mascot points at a speech-bubble comment box, inviting viewers to share their tips. Green garden background. Leave open area upper-right for a caption.",
 "img92":"The mascot waves goodbye with a warm smile, a small next-episode preview card floating beside it. Sunny garden background. Leave open area top for a caption.",
}


def main():
    m = json.load(open(os.path.join(HERE, "shot-manifest.json"), encoding="utf-8"))
    order = []
    for s in m:
        if s["scene"] not in order:
            order.append(s["scene"])
    miss = [i for i in order if i not in P]
    if miss:
        raise SystemExit(f"ยังไม่มี prompt: {miss}")
    pack = [{"id": img, "prompt": P[img]} for img in order]
    outp = os.path.join(HERE, "PROMPTS.json")
    json.dump(pack, open(outp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"เขียน {outp} — {len(pack)} prompts")


if __name__ == "__main__":
    main()
