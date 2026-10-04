# Garmin sailing watch app (customised)

> **Temporary home.** This folder has nothing to do with the NYC sailing dashboard
> in the rest of this repo. It lives here only because the session that created
> it could not create a new GitHub repository. Move it to its own fork as soon as one
> exists (see "Moving to a real fork" below).

Based on [dmrrlc/connectiq-sailing](https://github.com/dmrrlc/connectiq-sailing)
(MIT licence, © 2015 antistatique.net). It's written in Monkey C for Garmin Connect IQ.

## Upstream at a glance (as of 2026-09-02, commit `22721b0`)

- About 1,900 lines of Monkey C in 14 files under `source/`. It's small enough to read in an afternoon.
- Still active: the last merged PR (#30) is from Sept 2026, and the code has been cleaned up recently.
- **GitHub fork count is 10, not 4000+** (37 stars). The 4000+ is probably
  Connect IQ store downloads. Looking through the forks is quick, not tiresome.
- It targets a long list of watches, including fenix 3–8, epix, FR 165–970, Instinct 2/3 and MARQ.
- Minimum SDK is 1.2.0, so it uses the old `Ui.Menu` and `Rez.Menus` API instead of the
  newer `Menu2` API. This matters for menu changes (see below).

## Where the menus and buttons are in the code

| File | What it controls |
|---|---|
| `source/SailingDelegate.mc` | **Main screen buttons.** What Start, Back, Menu (long-press Up) and Up/Down do. Also builds the main menu in code (`buildMainMenu`). |
| `source/SailingMenuDelegate.mc` | What each main-menu item does when selected |
| `resources/resources.xml` | The fixed sub-menus: Sailing mode, Countdown signals, Exit, Paused |
| `source/PauseMenuDelegate.mc`, `ExitMenuDelegate.mc`, `ModeMenuDelegate.mc`, `SailingModeMenuDelegate.mc` | What each sub-menu item does |
| `source/TimePicker.mc`, `TimeFactory.mc` | The "Set timer" picker (0–30 min) |
| `resources/properties.xml` | Settings editable from the Garmin Connect phone app (timer, alarms, signals, mode) |
| `source/SailingView.mc` | The 3 data pages (speed/heading, lap, totals) and how they're drawn |
| `source/CountDown.mc` | Race countdown logic and beep/vibration patterns (Standard and Dynamic) |

## Current button map (upstream behaviour)

Button names are for a 5-button watch (fenix/FR/epix). Garmin maps them as
Start = `onSelect`, Back/Lap = `onBack`, long-press Up = `onMenu`, Up = `onPreviousPage`, Down = `onNextPage`.

**Main screen**

| State | Start | Back | Up / Down | Long-press Up (Menu) |
|---|---|---|---|---|
| Waiting for GPS (no activity) | Start recording | Exit menu (Save / Discard / Resume) | — | Main menu |
| Recording, **Race** mode | Start / cancel countdown | Mark lap | Change page. While the countdown runs: ±1 minute | Main menu |
| Recording, **Cruise** mode | Pause and open Paused menu | Mark lap | Change page | Main menu |
| Paused | Resume | Exit menu | Change page | Main menu |

**Main menu** (built in code, so items can depend on mode)

```
Menu
├── Start timer            (warns "Need Race mode and activity started" if not possible)
├── Set timer              (Race only) → picker 0–30 min
├── Toggle alarms          (toggles immediately, no confirmation shown)
├── Sailing mode           → Cruise | Race
└── Countdown signals      (Race only) → Standard | Dynamic
```

**Paused menu:** Resume · Lap · Save · Discard
**Exit menu:** Save · Discard · Resume

Each sub-menu first closes the main menu (`popView`) before opening, to save memory on older
watches. So pressing Back from a sub-menu goes to the main screen, not back to the main menu.

## Do we need Claude Design to plan the menus?

No. The menu tree is small (about 5 items, 2 levels), and the watch draws the menus itself
from a list of labels. There's no layout to design. Two simpler inputs work better:

1. **Photos of your watch** for each screen you want changed, labelled with the button you pressed to get there.
2. **A written target tree** in the same format as above, e.g.:
   ```
   Main screen: Back while recording → (instead of lap) open Quick menu
   Menu
   ├── Sync to gun          ← new
   ├── Set timer
   └── ...
   ```

Edit the two tables above into the behaviour you want, and that becomes the spec.
A visual mock-up only becomes worth it if we redesign the **data pages**
(`SailingView.mc`), which are custom drawn.

## Making changes and testing them

1. Install the **Connect IQ SDK Manager** and the **Monkey C extension for VS Code**.
   Generate a developer key (`openssl genrsa` → DER), as the Garmin "Getting Started" guide describes.
2. Run it in the simulator (*Monkey C: Run* with your watch model selected). The simulator has
   on-screen buttons, so menu changes can be tested without a watch.
3. Sideload onto your watch: *Monkey C: Build for Device* → copy the `.prg` file to
   `GARMIN/APPS/` over USB.
4. Things to watch for:
   - Change the app `id` in `manifest.xml` so your version installs **alongside**
     the store version instead of replacing it. Rename it too (e.g. "Sailing JN").
   - Trim `manifest.xml` products to your own watch so builds are faster.
   - Keep the `LICENSE` file (MIT requires it).

## Moving to a real fork

1. Open <https://github.com/dmrrlc/connectiq-sailing> and click **Fork**, under your account `jny8630`.
   Repo names could be `garmin-sailing-watch` or keep `connectiq-sailing`.
2. Add that repo to your Claude Code session/environment so Claude can push to it.
3. Move this README into the fork as `CUSTOMISATION.md`, then delete this folder.
   Keeping it a GitHub *fork* (rather than a copy) lets you pull in future upstream fixes
   and look through the other 9 forks easily from the **Insights → Forks** tab.

## Open to-dos

- [ ] Fork upstream (see above)
- [ ] Look through the other forks for menu or button changes worth reusing
- [ ] Watch model: ______ (decides button layout and memory limits)
- [ ] Target menu tree / button map written up
- [ ] Simulator build working
