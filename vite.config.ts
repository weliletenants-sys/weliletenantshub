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
        sourcemap: true,
        // Cache versioning for automatic invalidation
        navigateFallback: null,
        runtimeCaching: [
          // Google Fonts - Cache first with long expiration
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache-v1",
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
              cacheName: "dashboard-data-cache-v1",
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 2 // 2 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              plugins: [
                {
                  cacheKeyWillBeUsed: async ({ request }) => {
                    // Remove auth tokens from cache key for better hit rate
                    const url = new URL(request.url);
                    url.searchParams.delete('apikey');
                    return url.toString();
                  },
                  // Add timestamp for cache invalidation
                  cachedResponseWillBeUsed: async ({ cachedResponse }) => {
                    if (!cachedResponse) return null;
                    
                    const cacheTime = cachedResponse.headers.get('sw-cache-time');
                    if (cacheTime) {
                      const age = Date.now() - parseInt(cacheTime);
                      // Auto-invalidate after 2 hours
                      if (age > 2 * 60 * 60 * 1000) {
                        return null;
                      }
                    }
                    return cachedResponse;
                  },
                  cacheWillUpdate: async ({ response }) => {
                    const clonedResponse = response.clone();
                    const headers = new Headers(clonedResponse.headers);
                    headers.set('sw-cache-time', Date.now().toString());
                    
                    return new Response(clonedResponse.body, {
                      status: clonedResponse.status,
                      statusText: clonedResponse.statusText,
                      headers
                    });
                  }
                }
              ]
            }
          },
          // Profile and User Data - Network first with cache fallback
          {
            urlPattern: /\/rest\/v1\/profiles\?.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "profile-cache-v1",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Service Centre Manager Data - Stale While Revalidate
          {
            urlPattern: /\/rest\/v1\/service_centre_managers\?.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "manager-data-cache-v1",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 3 // 3 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Images and Media - Cache first with long expiration
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|avif)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache-v1",
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Storage bucket images - Cache first
          {
            urlPattern: /\/storage\/v1\/object\/public\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "storage-images-cache-v1",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Auth endpoints - Network only (never cache auth)
          {
            urlPattern: /\/auth\/.*/i,
            handler: "NetworkOnly"
          },
          // Realtime endpoints - Network only
          {
            urlPattern: /\/realtime\/.*/i,
            handler: "NetworkOnly"
          },
          // All other Supabase API calls - Network first with fallback
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache-v1",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
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
