# K2-08 minimal first-party content pack — editorial preview

## Purpose and limits

This packet contains exactly three original English Reader article candidates for the staging competitor-matrix fixture: one novel control (`N`), one weak remediation (`W`), and one forgotten remediation (`F`). It is not a publication packet. The approved public English catalog snapshot is source SHA `5e44412d4afd3bc1a8939182f780b175ae71e9f8`; it contains 99 approved forms across 94 concepts and excludes Auth and learner data.

Authoring history: original AI-assisted draft with **GPT-6 Luna / Medium**, followed by bounded prose revision with **GPT-6 Luna / Max**. The current metadata application and production-backed preview worker is **GPT-6 Luna / Max**. On 2026-10-01, the project owner approved the exact PR #38 N/W/F article bodies and A1/A2/B1 placement, together with the four metadata values below, for staging/hosted acceptance only. No external text or corpus was used. This approval does not authorize public or production publication; publication remains unauthorized pending exact-hash independent review and the normal authorized Admin execution gate.

## Candidate sequence

| ID | Intended role | Curated level | Private target | Body tokens | Estimated time | Distinct linked concepts | Sentences | Target matches |
|---|---|---:|---|---:|---:|---:|---:|---:|
| N | Novel control | A1 | `word:tea:noun` | 790 | 5 min | 4 | 72 | 46 |
| W | Weak remediation | A2 | `word:coffee:noun` | 876 | 5 min | 3 | 69 | 35 |
| F | Forgotten remediation | B1 | `word:water:noun` | 859 | 5 min | 3 | 74 | 49 |

## Deterministic Admin preview

The production Admin matcher using `reader-analyze-leftmost-longest-exact-v1` was run against the approved catalog snapshot: **PASS**, 0 violations. Every sentence has at least one automatic approved-catalog annotation, and each item has 1–4 distinct linked concepts. Strict checks confirmed every UTF-16 span matches its exact sentence slice, lies on code-point boundaries, and does not overlap. Private tea, coffee, and water targets appear only in their designated items.

Actual automatic links:

- **N**: `word:in:preposition` (9), `word:room:noun` (6), `word:on:preposition` (21), `word:tea:noun` (46); 82 annotations.
- **W**: `word:in:preposition` (24), `word:coffee:noun` (35), `word:on:preposition` (17); 76 annotations.
- **F**: `word:in:preposition` (11), `word:on:preposition` (16), `word:water:noun` (49); 76 annotations.

Preview input hashes: content pack `b9530370b2626205bd872b48af51ebeb25547e24f41be46654da6f478019760b`; catalog snapshot `ae28bd4b1e2fa0617f11ddc8a0bfd01a38e3bb2ed35d83a5a051abf7dc3e0d07`.

The ordering N < W < F is a catalog-fit prediction from configured ranks and levels only. The actual fresh-actor baseline, returned order, and `source_rank` have not been verified; that requires a future authorized staging check. All three bodies estimate to five minutes. Role and expected-concept metadata remain separate from the Admin DTO and do not create, strip, or replace annotations.

## Editorial summary

- **N — “A Quiet Cup of Tea”** (A1; Novel control): A short scene about a tea-room visit introduces the private target without assuming prior knowledge.
- **W — “Coffee, Carefully Noticed”** (A2; Weak remediation): Jo revisits coffee through varied cup and setting contexts; the prose does not claim a learner outcome.
- **F — “Water Along the Hill Path”** (B1; Forgotten remediation): Linh follows a town water route and garden use, revisiting water without claiming recovery.

The curated level sequence is A1 → A2 → B1. The preview proves deterministic catalog matching and bounded candidate structure only. The owner has approved the exact article text, levels, and proposed metadata for staging/hosted acceptance only; exact-hash review and normal Admin authorization remain required before publication.

## Owner-approved staging metadata (PR #38, approved 2026-10-01)

The project owner approved exactly these four values for all three DTOs for staging/hosted acceptance only. They are now applied. `source_version` remains `k208-minimal-content-pack-v1`; article titles, bodies, levels, and mapped targets remain unchanged. Applied content-pack SHA256: `5eb2d97d94f6288f6195c22cf9ae87d7e912ce09dc9b97e4eab626620fa4a679`. This scope does not authorize publication; the applied hash still requires independent review and the normal authorized Admin execution gate.

These exact values are already applied to each article DTO under the project owner's 2026-10-01 PR #38 staging-only approval. The owner does not manually write metadata rows. The metadata-applied hash requires its own independent review and the normal authorized Admin execution path before any hosted action; no Admin content write has occurred.

| Field | Proposed value for each article |
|---|---|
| `author_name` | `LINGUA OS Editorial (AI-assisted)` |
| `source_name` | `LINGUA OS First-Party Reader` |
| `attribution_text` | `LINGUA OS original first-party article. AI-assisted drafting, reviewed by the project owner for staging Reader use.` |
| `rights_statement` | `Original AI-assisted first-party text; owner-approved use in LINGUA OS staging Reader. No external text was reused.` |

Owner editorial and rights approval for these exact values is recorded on 2026-10-01 for staging/hosted acceptance only. `publication_authorized` remains false. No Admin create, validate, or publish action and no hosted content write is claimed.

## Complete article text

### N — A Quiet Cup of Tea (A1; Novel control)

Mina visits her grandmother every Sunday for tea. Grandmother lives in a small house beside the
park. The kitchen opens onto a bright room with a blue table. This Sunday, Grandmother plans to
share tea with her old neighbor Lan. Lan lives across town now, but she still loves their tea
talks. Mina hangs her coat on a hook and joins Grandmother in the kitchen. Grandmother takes a
blue tin from the shelf and sets it on the table. "Lan likes plain tea," she says. "She takes no
milk or sugar with her tea." Mina reads the label on the tin, though she knows the tea by its
smell. They wash two cups and place them on a tray. Grandmother fills a kettle and puts it on
the stove. Mina asks how many leaves fit in each tea cup. "A small spoon works well for one tea
cup," Grandmother says. Mina takes the spoon and counts two small heaps of tea. A few leaves
fall on the table. She laughs as tea leaves fall around the cup. Mina sweeps the dry leaves into
a bin on the floor. As the kettle warms, they talk about Lan and the old tea stall. Grandmother
met Lan at that stall by the school gate over tea. They sat at the stall after class and shared
one cup of tea. After many years apart, Lan visits again for tea. Mina wonders if Lan remembers
their long talks over tea. A clock on the wall says eleven. The tea is hot, but Grandmother
lifts the kettle from the stove. She waits a short time before pouring, because a rolling boil
can make green tea bitter. Mina watches tea fill each cup, one at a time. The pale tea smells
fresh and light. Grandmother asks Mina to carry the tray into the front room. Mina holds the
tray with both hands and walks slowly across the room. A soft knock sounds on the door. Lan
stands at the door with an umbrella and a bag of tea. Her hair is wet, but the tea stays warm on
the tray. Lan smiles when she sees Grandmother in the front room. They hug by the door, then sit
at the table and pour tea. Lan puts her bag on the chair and opens it. Inside, Lan keeps a small
photo of the old stall on the table. "I found it in my desk last week," Lan says. Mina looks at
the first photo on top. Two young women sit at a tea stall and laugh. Grandmother and Lan look
just as happy in the picture. Mina pours tea for Lan, then takes a seat by the window. Lan lifts
the cup and smells the tea before she drinks. "The tea has the same soft taste," she says.
Grandmother asks what tea Lan makes in her new flat. Lan tells them about her garden and tea
with a neighbor. Mina listens while she drinks her tea. The story makes the room feel bright,
even as rain taps on the window. Lan asks Mina which books she reads, and Mina answers over tea.
Mina tells her about a book while the tea cools on the table. Lan knows that story, too, and
names the next book while rain taps on the window. Mina writes the title on a paper strip beside
her tea cup. The women share tea and talk about small things for a long time. No one checks the
clock on the wall. When the tea is gone, Grandmother offers another cup. Lan says yes to another
cup of tea, and Mina prepares it. She measures the tea leaves, waits for the kettle, and pours
slowly. The tea is not too strong this time. Lan says Mina makes a fine cup of tea. Mina feels
proud of the tea, but she knows she can learn more. Before Lan leaves, they set a day for the
next tea visit. She takes the old photos but leaves one on the table for Mina. Mina puts the
photo in her school bag beside the paper strip with the book title. The rain ends, and sun comes
into the room. Lan waves from the gate as Mina stands in the doorway. Mina clears the cups and
washes the tea pot. Grandmother says the visit and shared tea make the day special. Mina asks if
she can make tea again next Sunday. Grandmother nods and saves the blue tin on the shelf. On
Mina's walk across town, she thinks about Lan's stories and tea. She knows how to make the tea
now, but she likes the talk best. After the visit, she tells her mother about Lan over one more
cup of tea.

### W — Coffee, Carefully Noticed (A2; Weak remediation)

Jo takes a small coffee to the cafe window and opens her folder. She has one hour to finish a
poster in the cafe before lunch. The garden group needs the poster on Saturday. Jo sketches rows
of vegetables, a path, and a bright sun while her coffee waits beside the page. The words in the
picture look plain, though the drawing feels good. Jo takes a sip, then checks the date on the
page. The coffee cup rests far from the paper, so Jo can draw without worry. She writes the date
in large letters and checks each line. A woman at the next table asks what Jo is drawing beside
her coffee. Jo explains the garden idea as she takes a sip of coffee. The woman offers to bring
small pots for the garden, and Jo writes that in the margin. Jo adds a note about the pots in
the open space. The coffee scent reminds Jo to pause and look at her own cup. Her coffee is
still warm, so she drinks before returning to the poster. Jo notices a small wobble in the table
when she moves her arm. She places her folder in the center and steadies the paper. A child runs
past, and coffee shivers inside Jo's cup. Jo catches her coffee, but a few drops land on the
poster. The coffee marks spread across the corner and cross part of the sun. Jo feels upset
because coffee stains the sun and the garden path. She asks the cafe worker for a clean cloth
and a new sheet to save the coffee poster. The worker brings both, then sets another coffee on a
side shelf. She dabs the paper, but the coffee stain blurs the ink. Jo takes a slow breath and
studies the brown circle on the page. The ring could pass for a sun above the garden rows on the
page. She turns the coffee-marked page and sees a new idea. Jo draws a larger sun around the
ring, then adds rays on the page. The stain now fits in the design. The worker says the coffee
sun will brighten the poster. Jo writes a new heading in the space above the picture. The
heading invites people to bring a cup and meet in the garden. The woman in the next chair reads
the poster and points to one detail. She says the date should stand out in the coffee-colored
picture. Jo makes the hour larger and moves the date down on the page. A man at the door
suggests a small map in the bottom corner. Jo adds the cafe and garden gate to the map in the
bottom corner. The coffee grows cool while she draws, but she does not mind. Jo takes another
sip of coffee and checks the whole poster. The path on the map leads from the street to the
garden. Jo adds a place for bags on the map beside the garden path. The woman sets down her
coffee and offers Jo a green pencil. Jo colors the garden rows beside the coffee sun. The green
makes the poster feel calm, and the coffee ring gives it warmth. Jo copies the final design of
the coffee sun onto a clean sheet. She keeps the first page in her folder as a reminder of the
mistake. The cafe worker clears the table where Jo first spilled coffee. Jo writes the last line
in the cafe and checks every letter. The poster says neighbors can plant, share lunch, and learn
together over coffee. Jo takes a photo of the poster in the cafe window and sends it to the
garden leader. The garden leader reads the message in Jo's photo and asks her to bring it over.
Jo folds the folder around the poster and finishes her coffee. On the way to the garden, Jo
passes the cafe window and sees her coffee poster in the glass. Jo walks two blocks with the
poster held flat under her arm, smiling at the coffee ring. The garden crew has coffee in paper
cups beside the tools and small pots. She pins the poster on the garden gate beside the cups.
The garden leader sees the coffee sun and laughs with delight. The garden leader says the ring
gives the picture warmth on the page. Jo tells her how the spill became part of the design on
the page. They place the extra copy in the cafe window for people to see. Later, Jo returns to
the cafe and orders one small coffee. She sits in the cafe, opens her folder, and writes down
the day's story. Coffee tastes richer after Jo finishes the poster. Jo watches the garden gate
from the cafe window, coffee cup in hand. The sun on the page seems to shine over the real
garden. On Saturday, she brings a watering can to the first planting day. The garden group meets
on the path by the poster as Jo helps a child plant beans. They share lunch after planting, and
the leader saves Jo a cup of coffee. Jo thinks the best part is not the coffee or the poster
alone. In the garden, she sees neighbors make a place together.

### F — Water Along the Hill Path (B1; Forgotten remediation)

Linh volunteers at a hill garden where water comes from a spring above town. The garden sends
herbs and vegetables to the food center in town. During a dry summer, the water flow becomes
weak at the garden tap. On hot days, the leaves curl although the beds still look green. Linh
checks the schedule on the wall and sees that the spring should supply the garden. She asks Bao,
the caretaker, to walk the route with her on the hillside. Bao brings a map, a wrench, and a
small notebook for notes on their walk. On their map, they trace a pipe from the tap to a
covered tank. Water reaches the tap through a pipe from a covered tank. The tank sits on a
slope; gravity carries its flow downhill. Linh marks each junction on the map as they climb. A
narrow channel carries water along the stone path toward the garden. After a turn, they hear
water running beneath a wooden cover. The sound of water grows stronger below the bridge. Bao
lifts the cover over the water pipe with a tool while Linh holds it steady. A loose joint lets
water escape into the soil. The water leak is small, but it runs all day. Bao closes the water
valve before touching the pipe. Linh calls the town crew to report the water leak. A repair
worker arrives with a new seal and checks the water pipe. He asks Linh to read the water meter
while Bao turns the valve. The numbers stay still when the water is off. The worker fits the
seal, then lets water into the pipe a little at a time. Water moves through the pipe without a
leak. The meter turns as water reaches the lower channel. Linh watches the water pass under the
bridge and into the garden tank. They wait to see whether water pressure stays steady. At first,
the water tap gives only a thin stream. The worker checks the water valve and finds leaves
caught around its handle. Bao clears the leaves, and water runs again. Water flows from the
garden tap with a stronger sound. Linh fills a bottle and uses the extra water to test the
pressure. The worker asks Linh to check the water meter the next day. He also asks them to
report any new water leak quickly. Linh adds both notes in the map's margin. She marks the
repaired joint with a red circle on the map. They return to the square and explain how the
repair restores water flow. A sign on the gate asks people to use water with care. Linh suggests
adding a simple water map beside the sign. The group agrees that visitors should know where the
water comes from. Bao draws the spring, tank, pipe, and garden on a large sheet. Linh adds
arrows to show the water flow direction. The map helps people see that water connects the hill
and the town. One gardener asks if the spring will supply water through the summer. Bao says the
water level is steady, but everyone should avoid waste. Linh explains that a slow pour gives
plants time to take water. The group places small cans beside the beds for careful water use.
They also check the water tap after each gardening session. On a later day, rain falls on the
hill for an hour. The channel carries water under the bridge without rising above its sides.
Linh visits the garden the next day to read the meter on the tank. The water meter is normal,
and the ground beside the pipe stays dry. She writes the reading in her notebook and tells Bao.
He smiles as water reaches the garden beds again. The garden tap now fills several cans in a
short time. A child asks where the water line begins. Linh follows the blue water line with a
finger and explains the route. Water starts above the houses, passes through the tank, and
reaches the square. From the square, another pipe brings water to the garden. The child says the
water route is longer than it looks. Linh agrees and points to the marked joint on the map. The
garden group puts the map in a clear case by the gate. In the garden, visitors pause to read the
map before filling their bottles at the tap. They discuss how even a small leak matters in a dry
summer. Linh returns with Bao to the spring where water starts its route. They hear the stream
run quietly in the clear channel. They check the cover, both valves, and the tank on the
hillside one last time. Nothing needs repair along the water line after the check. Linh walks
back with the map in her hand. She understands the system in greater detail, and she knows whom
to call. The plants stand upright in the garden after the rain. The group shares a meal and
fresh water, then talks about next season. Linh fills a glass at the tap and sets it on the
table. She thinks about the path the water takes before it reaches her.

## Approval status

- Human editorial review: project owner approved the exact PR #38 N/W/F bodies and A1/A2/B1 placement on 2026-10-01 for staging/hosted acceptance only.
- Rights/provenance review: project owner approved the four exact metadata values above on 2026-10-01 for staging/hosted acceptance only.
- Approval source: PR #38. The applied DTO content-pack SHA256 is `5eb2d97d94f6288f6195c22cf9ae87d7e912ce09dc9b97e4eab626620fa4a679`.
- Historical independent review: PASS with no HIGH/BLOCKER content issue for the prior exact input set only: content pack `b9530370b2626205bd872b48af51ebeb25547e24f41be46654da6f478019760b`, editorial preview `c830dca6ac73985ad97518ab88a58e310e590eb5735de5ad41527fcafbf03373`, and catalog snapshot `ae28bd4b1e2fa0617f11ddc8a0bfd01a38e3bb2ed35d83a5a051abf7dc3e0d07`. That disposition does not review or certify the metadata-applied hash.
- Independent review of the metadata-applied hash: pending.
- Publication: **not authorized**; no actual hosted create, validation, publication, or catalog change is claimed.
- Execution: normal owner-authorized Admin path remains blocked. A read-only Admin GET returned an access-denied page; no hosted write was attempted.
- Next gate: independent review of the new exact hashes, then the authorized Admin execution path and actorless catalog preflight. Actors remain gated on the complete catalog-only check.
