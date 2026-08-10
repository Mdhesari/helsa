# Shipping Helsa to the App Store

The iOS project is scaffolded and archive-ready in `frontend/ios/`. This covers
what is already done, what you need to do, and why the wrapper is built the way
it is.

## Why a native wrapper at all

Apple does not accept PWAs in the App Store, and a URL loaded in a bare
WKWebView is rejected under **guideline 4.2 (Minimum Functionality)**. So the
wrapper is not a viewport onto the website:

- **Web assets ship inside the bundle** (`webDir: 'dist'`), not loaded from a
  remote `server.url`. The app launches and works offline from first run.
- **Daily meal reminders** via `@capacitor/local-notifications` — scheduled
  on-device, and something iOS Safari genuinely cannot do. Opt-in lives in
  Profile → *Meal reminders*, and the card is hidden on the web.
- **Haptic feedback** on every logged meal (`@capacitor/haptics`).

If a reviewer asks what the app does beyond the website, those are the answers.

## Prerequisites (yours)

1. **Full Xcode** from the Mac App Store. This machine currently has only the
   Command Line Tools, so `xcodebuild` is unavailable and nothing here can be
   compiled until Xcode is installed. Then point the toolchain at it:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
2. **Apple Developer Program** membership ($99/year) — needed for signing,
   TestFlight and submission.
3. An **App Store Connect** record for bundle id `com.helsa.app` (change it in
   `frontend/capacitor.config.ts` if you want a different one — do this *before*
   the first upload, as the id cannot be changed afterwards).

## Build

The native app has no nginx in front of it, so it needs an absolute API origin
baked in at build time:

```bash
cd frontend && VITE_API_ORIGIN=https://your-helsa-domain.com npm run ios:sync
```

Then open the workspace and archive:

```bash
cd frontend && npm run ios:open
```

In Xcode: select the **App** target → *Signing & Capabilities* → set your Team
(this is the step that requires your Developer account) → *Product ▸ Archive* →
*Distribute App*.

Set the version and build number on the target's *General* tab; App Store
Connect rejects a re-upload of an already-used build number.

Re-run `npm run ios:sync` after **every** web change — it rebuilds `dist/` and
copies it into the native project. Editing files under `ios/App/App/public/`
directly is pointless; they are overwritten on each sync.

## Push notifications

Local notifications need no server and no entitlement, so nothing is required
here. If you later add *remote* push, you also need an APNs key and the Push
Notifications capability in Xcode.

## App Review — things that commonly bite

- **Health disclaimer.** Helsa computes calorie/macro targets and shows
  AI-generated observations. Keep the existing "general observations only, never
  medical advice" framing visible; medical claims invite scrutiny under
  guideline 1.4.1.
- **Account deletion.** Guideline 5.1.1(v) requires any app with account
  creation to offer in-app account **deletion**. The backend currently has no
  delete endpoint (`README.md` lists it as deferred) — **this will fail review**
  and needs building before submission. It is the one known blocker.
- **Demo account.** Provide reviewer credentials in App Store Connect; the app
  is unusable behind a login without them.
- **Privacy nutrition labels + privacy policy URL.** Both are required. Helsa
  collects email, biometrics (age/sex/weight/height) and food logs; declare
  them honestly, and note whether OpenRouter receives any data when AI insights
  are enabled.
- **IPv6 / no-network behaviour.** Review networks are strict; the offline
  handling already covers the common failure, but check the app does not hang
  on a dead connection.

## What is deliberately not configured

- **Signing** — requires your Apple account; Xcode's automatic signing will set
  it up once your Team is selected.
- **Screenshots, description, keywords** — App Store Connect metadata, and
  yours to write.
- **`NSAllowsArbitraryLoads`** — intentionally absent. The API is HTTPS-only,
  and adding an ATS exception would invite a review question for no benefit.
