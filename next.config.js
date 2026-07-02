const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare')

initOpenNextCloudflareForDev()

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_MAPBOX_TOKEN: 'pk.eyJ1IjoiY2hyaXN0YXIiLCJhIjoiY21xdjN2MThqMG9zMDJwczMycjUzam5obyJ9.BXqeQ7gzySKcsOktGFgNjg',
    // Registered for localhost, 127.0.0.1, and earth.sonicboom.org.uk.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAADutiju8yMHim3Qt',
  },
}

module.exports = nextConfig
