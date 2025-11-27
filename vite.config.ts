import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "Welile Agent & Service Centre Portal",
        short_name: "Welile",
        description: "Welile Agent & Service Centre Management Platform - Manage tenants, collections, and earn rewards",
        theme_color: "#6B2DC5",
        background_color: "#6B2DC5",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],
        categories: ["business", "finance", "productivity"],
        shortcuts: [
          {
            name: "Add Tenant",
            short_name: "New Tenant",
            description: "Add a new tenant",
            url: "/agent/new-tenant",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }]
          },
          {
            name: "Collections",
            short_name: "Collections",
            description: "View today's collections",
            url: "/agent/collections",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }]
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          // Google Fonts - Cache first with long expiration
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Agent Dashboard Data - Stale While Revalidate for instant loads
          {
            urlPattern: /\/rest\/v1\/(agents|tenants|collections)\?.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "dashboard-data-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 2 // 2 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              plugins: [
                {
                  cacheKeyWillBeUsed: async ({ request }) => {
                    // Cache based on URL without auth headers for better hit rate
                    return request.url;
                  }
                }
              ]
            }
          },
          // Profile and User Data - Cache first with background sync
          {
            urlPattern: /\/rest\/v1\/profiles\?.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "profile-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Images and Media - Cache first with long expiration
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Auth endpoints - Network only (never cache auth)
          {
            urlPattern: /\/auth\/.*/i,
            handler: "NetworkOnly",
            options: {
              cacheName: "auth-cache"
            }
          },
          // All other Supabase API calls - Network first with fallback
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 75,
                maxAgeSeconds: 60 * 30 // 30 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: "module"
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
