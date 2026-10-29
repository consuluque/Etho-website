---
name: showcase-scenes
description: Build or change an animated app scene inside the homepage's showcase phone frame (index.html, section "Product story"), in the style agreed for chapter 1. Use whenever a chapter of the phone showcase gets, or changes, an animated Etho UI scene, an intro film, or the motion between chapters; also when asked to "animate the phone", "add a scene", or to match chapter 1's animation style.
---

# Showcase scenes

The homepage's product story is one phone, fixed in the middle of the
screen, with three chapters scrolling past it (title left, copy right).
A chapter can show a **scene**: a short, simplified piece of Etho's app,
acted out by a fake cursor, playing over the chapter's film. Chapter 1
(grooming, for Hector) is the reference: when in doubt, do what it does.

The style was arrived at with the product owner over many rounds. The
rules below are their decisions, not taste: keep them unless they say
otherwise.

## Files

| File | What lives there |
| --- | --- |
| `index.html` | The scene's markup, inside its chapter's `.showcase__slide`, after the film. |
| `css/scenes.css` | All of the look and all of the motion. |
| `js/scenes.js` | The engine (`createScene`) and each scene's script (`scripts.<name>`). |
| `js/home.js` | Chapter switching. Plays a chapter's scene while that chapter is active and on screen, and stops (rewinds) it otherwise. Already wired: a new scene needs no change here. |
| `css/styles.css` | `--ease-out`, the shared curve. |
| `assets/images/scenes/` | Photos used inside scenes, as `.webp`. |

## The look

- **Simplified, never a copy.** The scene is built from the app's pieces
  but is not a real screen: no tab bar, no search bar, no screen the
  owner hasn't chosen to show. It must not hand competitors the real UI.
  Fewer pieces, one idea per screen, the way Cash App's site does it.
  The exception is the header, which is the app's real one: "Here's to
  a good day" on the left in bold `#464646`, and the dog's photo on the
  right with its red unread dot (`#FF8383`). Under it comes one big
  headline ("Picked for Hector").
- **The app's own vocabulary.** Taken from the web app (repo
  `consuluque/Etho`: `src/components/theme.ts`,
  `src/components/explore/tokens.ts`):
  - the page: a gradient from `#E6E5E3` to `#FBFBFB` (at 23.5%) to `#FCFCFC`
  - cards `#FFFFFF`, with a three-layer soft shadow
    (`--sx-shadow` in scenes.css)
  - photo first, rounded about 1.1em to 1.6em
  - **the offer pill**: solid black, white bold text ("20% off", "Free").
    It is the one solid black shape on a screen, so the saving is the
    first thing the eye finds.
  - titles `#000` bold; secondary lines `rgba(14,15,12,.59)`; a struck
    price `#717171`; a saving in the app's green `#177245`
  - sheets: white, rounded about 1.5em, sliding up over the page, which
    frosts and dims behind (`filter: blur(4px) brightness(0.88)`)
  - Manrope throughout (the site already loads it)
- **Size: about the app's own scale.** Two failures happened here, both
  rejected: tiny, detailed UI ("unreadable") and giant UI ("too big,
  grotesque"). What was approved, in the scene's em (below): headline
  1.6em, card titles about 0.9em, lines about 0.82–0.85em, offer pill
  0.86em (raised from 0.68em: the owner found it too small to notice), sheet title 1.45em, main photo cards about 10em wide. Nothing
  smaller than about 0.8em.
- **The savings are always visible.** Offer pill on the photo, a struck
  "was" price beside the real one, and the saving said plainly at the
  end ("You saved $24"). A success screen, modelled on Cash App's
  (close button and title bar, a big line, one picture in a rounded
  frame, the saving counting up in a panel along the foot), is the
  way to land a scene: see `puppy`.
- **Copy:** short and warm. The dog is **Hector** in chapter 1; chapter
  2's second screen is **Winnie**, a Dachshund. Headings so far:
  "Picked for Hector", "Get Hector pampered", "Make it special",
  "Booked". Prices are invented, so ask before treating any as real.
- **Photos:** real photography, never illustrations. Sources:
  - the app's demo images (`public/explore-demo/`,
    `public/provider-demo/` in `consuluque/Etho`)
  - the owner's Drive folder **"Images for Etho"**

  Convert them to webp (`ffmpeg -i in.png -c:v libwebp -quality 82
  out.webp`). When a photo's subject is small, crop in on it with
  `object-position`, or `transform: scale()` inside a clipping box.
  `.sx-groom` and `.sx-thumb` show both.
- **Films:** the film is the chapter's opening shot. Never leave a
  caption burned into it. The owner rejected "Spoiled?". Paint
  captions out, or cut before them (see "Intro films").

## Sizing

`.scene` sets `font-size: calc(var(--phone-h) * 0.5 / 23.4)`: the phone
screen is 23.4em wide (a 375 pt iPhone, at 16px to the em). Draw
everything in em and it scales with the frame at every viewport,
including the stacked phone layout (where `--phone-h` drops to about
300–440px).

**Only leaf text sets a font-size.** A font-size on a container
compounds every em inside it. When a padding has to line up across text
of different sizes, put it on the container, not on each line (see
`.scene__page`).

## The motion

Motion lives only in CSS transitions and keyframes. The script never
animates anything itself. It only:
- adds and removes state classes `s-<name>` on the `.scene` root
- moves the cursor
- sets a scrolled row's transform
- counts a number

So a scene is a timeline of states, and its feel comes from one place.

**Curves**
- `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` for everything that
  answers: entrances, sheets, pages, checks, pills. Strong ease-out is
  the house feel (the owner asked for it by name).
- `cubic-bezier(0.65, 0, 0.35, 1)` (ease-in-out) only for the
  cursor's glide, because a hand speeds up and slows down.
- Fling: `cubic-bezier(0.5, 0, 1, 1)` while dragging (gathering speed),
  then `cubic-bezier(0.05, 0.75, 0.15, 1)` from the release (it carries
  on at speed and settles long).

**Durations that were approved**

| Move | ms |
| --- | --- |
| Page rises over the film | 850 |
| Cards stagger in | 600–750, about 80ms apart, starting 250ms after the page |
| Sheet slides up | 750 |
| Page pushes in from the right (old page goes −30% and fades) | 650 |
| Cursor glide | 550–950 (longer for longer trips) |
| Tap: cursor dips to 0.82, the target to 0.95–0.96, both return | 140–160 |
| Check fills, then its tick draws (stroke-dashoffset) | 300, then 420 after 120 |
| Count-up, with a small scale bump | 650 |
| Fling: drag, then settle | 320, then 1600 |
| Done tick draws | 600, after 550 |
| Booking card, then saving | in at 750, then at 1000 |
| Everything drops away at the end | 650 |

**Beats.** Leave about 150–250ms between a glide arriving and its tap,
and about 600–900ms between a tap and the next glide. Let each answer
finish before the cursor moves on. Hold the final screen about 3s. Loop
about 1s after everything has dropped away.

**The cursor** is a black arrow with a white edge, about 1.4em wide. It
fades in once, parks off the lower right between rounds, and fades out
after the last tap. It glides to a point inside an element (`fx`, `fy`
fractions of its box), never to a fixed coordinate.

**Fun, not busy.** One playful touch per scene beats several. Chapter 1
has two:
- cards draw in slightly mid-fling (`s-fling`)
- the picked card's pill hops once it lands (`s-pick`)

The owner removed page dots that raced along with the fling: it was
one touch too many.

## Anatomy of a scene

Markup, inside the chapter's slide, after its `<video>`:

```html
<div class="scene" data-scene="NAME" aria-hidden="true">
  <div class="scene__app"> … the first screen … </div>
  <div class="scene__sheet">
    <div class="scene__page scene__page--a"> … </div>
    <div class="scene__page scene__page--b"> … </div>
  </div>
  <svg class="scene__cursor" viewBox="0 0 18 23"><path d="M2 1.5V19l4.6-4.2 3 6.8 3-1.3-2.9-6.7H16z"/></svg>
</div>
```

- `aria-hidden="true"`: the scene is decorative; the chapter's title and
  copy carry the meaning.
- Mark what the cursor touches with `data-target="name"`. Mark a
  counted figure with `data-scene-count` (its starting text is restored
  on every reset). Mark a row the cursor scrolls with
  `data-scroll="name"`.
- With no script, everything waits below the screen
  (`translateY(102%)`) and the film carries the chapter. Keep that true.

Script, in `scripts` in `js/scenes.js`:

```js
NAME: {
  loopAt: 20500,                       // ms from the start of a round to the next
  script({ at, on, off, target, glide, press, tap, drag, scrollTo, em, count, root }) {
    at(3800, () => on('app'));                         // a state: CSS does the rest
    at(5000, () => { on('cursor'); glide(target('x'), 750); });
    at(5900, () => tap(target('x'), () => on('sheet')));
    // …
    at(19500, () => on('out'));                        // everything drops away
  },
  finalState({ on, root }) { on('app', 'sheet' /* … */); },  // reduced motion: the last frame, still
},
```

**The verbs**
- `at(ms, fn)`: schedule a step
- `on(...)` / `off(...)`: add or remove `s-` states
- `target(name)`: find a `data-target` element
- `glide(el, ms, fx, fy)`: move the cursor to a point inside `el`
- `tap(el, then)`: tap `el`; `then` runs at the moment of contact
- `press(down)`: hold the cursor down or let it up
- `drag(el, dx, ms)`: swipe a row with the cursor held down
- `scrollTo(el, x, ms, curve)`: move a row by its transform
- `em(n)`: convert scene ems to px
- `count(el, to, ms)`: count a `$` figure up
- `type(el, ms)`: type the element's `data-type` text into it, a
  letter every `ms` (50–60 reads as typing). Turn `s-typing` on for the
  caret and off when done. Use it on an `.sx-type` inside `.sx-search`;
  until a letter is in, the bar shows the app's placeholder.

Times are absolute from the start of a round. Plan them as a table
before writing. Measure positions at the moment of the step, never
ahead, because a target may be mid-transition.

**Reset and loop are free.** The engine clears all `s-` classes,
pressed and bump states, counts and scrolled rows, with transitions off.
`home.js` rewinds the scene whenever its chapter leaves. Under reduced
motion `finalState` runs with transitions off and no cursor. Every new
state class must look right when added with no transition.

## Screens without a page

Not every screen rises as a page over a film. Chapter 2's first screen
(`puppy`, `.scene--glass`) frosts the chapter's photo instead:
- a blurred copy fades in on top (`.sx-frost`, `s-frost`)
- the search drops in and answers rise as glass cards (`.sx-result`:
  white at 70% with `backdrop-filter`)
- `.scene__app--clear` keeps the page's layout but has no background
  and does not slide

At the end it fades out rather than dropping away.

## A chapter with more than one screen

A chapter can hold several slides, each with its own screen of scroll
and its own scene, under the same title and copy. Give every slide a
`data-showcase-chapter` naming its text (the `data-showcase-text` index).
Chapter 2 has two: `puppy` (slide 1) and `winnie` (slide 2), both
`data-showcase-chapter="1"`. Add one `.showcase__trigger` per slide.
Per-slide CSS keyed on `data-showcase-slide` must be renumbered when
slides are added.

## Intro films

The film plays first, the scene rises over it, and the film replays
each round.
- `home.js` holds the chapter's still for `HOLD_MS` (1500) before the
  film plays.
- Time the page's rise (`on('app')`) for just after the film ends.
- A film that opens a scene carries `data-once`: no `loop`, it holds its
  last frame, and `scenes.js` replays it at the start of each round. Its
  still must be its first frame.
- Cut with ffmpeg by frame count, not by time (`-frames:v N`). Find the
  frame by tiling frames with their timestamps:
  `-vf "fps=30,scale=120:-1,drawtext=text='%{pts\:hms}':…,tile=12x1"`.
  Then re-encode with `-c:v libx264 -crf 20 -pix_fmt yuv420p -movflags
  +faststart -an`.
- To paint out a burned-in caption, cover it with the same area from a
  clean frame before the caption appears. Fit that frame's scale and
  offset to each later frame first (films push in slowly), then blend
  it in with a soft-edged box. This was how "Spoiled?" came out
  invisibly. Filling the letters from neighbouring pixels left visible
  ghosts.
- Bump `?v=` on the film's `src` when replacing a file under the same
  name.

## Shipping

Bump the `?v=` tags on `home.css`, `scenes.css`, `scenes.js` and
`home.js` in `index.html` with every change to those files. Browsers
keep the old files otherwise: after the header change, the live site
served the new markup with the old stylesheet and Hector's photo landed
in the wrong place.

## Checking a scene

Run the page and capture frames at chosen moments. Read the frames:
never ship motion you haven't looked at.

```bash
python3 -m http.server 8765 &
NODE_PATH=$(npm root -g) node .claude/skills/showcase-scenes/capture.js out/ 3000,5000,6500,9000
NODE_PATH=$(npm root -g) node .claude/skills/showcase-scenes/capture.js out/ 7000,12000 390x844   # phone layout
```

`capture.js` scrolls to the showcase, so chapter 1 is active. Scroll
further for later chapters: add `+N` to the scroll in the script.

Check each scene:
- at desktop (1440×900) and phone (390×844) sizes
- that `node --check` passes on both scripts
- that there are no page errors
- that the last frame holds under reduced motion
- that it loops cleanly: a frame just after `loopAt` should match the
  start
- that it still reads with the script off

## Working with the owner

- Work on a preview branch with a draft PR. Merge only when they say
  it can go live.
- Show frames, not descriptions: tile key moments into one image and
  send it with each round.
- Ask for real photos and copy when a placeholder would matter. Name
  what is invented.
