import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native iOS wrapper config.
 *
 * `webDir` points at the Vite build: the app ships its UI **inside the bundle**
 * and talks to the API over HTTPS. It deliberately does not use
 * `server.url` to load a remote page — an app that is only a viewport onto a
 * website is what App Store guideline 4.2 rejects, and it would also break
 * offline launch.
 */
const config: CapacitorConfig = {
  appId: 'com.helsa.app',
  appName: 'Helsa',
  webDir: 'dist',
  ios: {
    // Matches --background so there is no white flash before first paint and
    // no dark gap under the safe areas.
    backgroundColor: '#ffffff',
    // Links to other sites open in the system browser rather than replacing
    // the app's own web view.
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#58cc02',
    },
  },
}

export default config
