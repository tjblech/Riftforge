# Riftforge PWA — V1

A mobile-first original action RPG prototype inspired by the fast combat/progression loop of modern portrait mobile RPGs.

## Included in V1
- Three classes: Bladesworn, Ranger, Arcanist
- Touch joystick + desktop WASD controls
- Auto/basic attacks with class-specific behavior
- Manual dash, potion, and signature class skill
- Crawlers, brutes, ranged enemies, and Rift Warden bosses
- XP gems and three-choice level-up perks
- Boss loot with weapon, armor, and charm slots
- Common / Magic / Rare / Epic / Mythic item rarities
- Five zones that rotate as stages advance
- Persistent gold, gear, level, perks, and mastery shards
- Permanent Might / Vigor / Fortune mastery upgrades
- Death / camp return loop
- Local save with localStorage
- Installable PWA manifest and offline service worker
- Responsive portrait UI; desktop is constrained to a phone-like play area

## Run locally
Service workers do not run from `file://`, so use a local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy
The folder is static and can be deployed directly to GitHub Pages, Cloudflare Pages, Vercel, Netlify, etc. HTTPS is required for normal PWA installation/service-worker behavior outside localhost.

## Controls
### Mobile
- Left thumb: joystick
- DASH: short invulnerable movement burst
- SKILL: class signature ability
- Heart: potion
- Menu: stats / gear / permanent mastery

### Desktop
- WASD / arrows: move
- Space: dash
- E: skill
- Q: potion

## Suggested V2
- Proper explorable overworld with landmarks and portals
- Town/camp UI with blacksmith and vendors
- Inventory instead of auto-equipping one boss reward
- More weapon archetypes and active skills
- Pets/companions
- Dungeons and elite rooms
- Quest NPCs
- More elaborate boss attack patterns
- Audio/haptics
- Cloud saves/account sync
