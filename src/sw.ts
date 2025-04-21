/**
 * Basic service worker to run the repro case.
 */
// declare let self: ServiceWorkerGlobalScope

import { getHeliaAndLibp2p } from './get-helia.js'

import { runRepro } from './index.js'

const thisSw = self as unknown as ServiceWorkerGlobalScope

/**
 ******************************************************
 * Service Worker Lifecycle Events
 ******************************************************
 */
thisSw.addEventListener('install', (event) => {
  // 👇 When a new version of the SW is installed, activate immediately
  void thisSw.skipWaiting()
})

thisSw.addEventListener('activate', (event) => {
  /**
   * 👇 Claim all clients immediately.
   */
  event.waitUntil(thisSw.clients.claim())
})

thisSw.addEventListener('fetch', (event) => {
  const request = event.request
  const urlString = request.url
  const url = new URL(urlString)
  console.log('incoming request url: %s:', event.request.url)

  if (url.searchParams.get('sw') === 'true') {
    event.respondWith(swRepro(event))
  } else {
    // do not handle the request
    return
  }
})

async function swRepro (event: FetchEvent): Promise<Response> {
  const url = new URL(event.request.url)
  const delay = url.searchParams.get('delay')
  const gateway = url.searchParams.get('gateway')
  const router = url.searchParams.get('router')
  if (delay == null) {
    throw new Error('delay is required')
  }
  if (gateway == null) {
    throw new Error('gateway is required')
  }
  if (router == null) {
    throw new Error('router is required')
  }

  const { helia, libp2p } = await getHeliaAndLibp2p({
    gateways: [gateway],
    routers: [router],
    dnsJsonResolvers: {},
    enableRecursiveGateways: true,
    enableGatewayProviders: true,
    enableBitswap: true,
    enableLibp2pRouting: true,
    useLibp2pDefaultTransports: true,
    enableWss: true,
    enableWebTransport: false,
  })

  try {
    const results = await runRepro({
      // see https://explore.ipld.io/#/explore/QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1%20-%20Barrel%20-%20Part%201/1%20-%20Barrel%20-%20Part%201.png
      // path: 'QmawceGscqN4o8Y8Fv26UUmB454kn2bnkXV5tEQYc4jBd6',
      path: 'QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1 - Barrel - Part 1/1 - Barrel - Part 1.png',
      helia,
      signal: AbortSignal.timeout(parseInt(delay, 10))
    })
    // console.log('results', results)

    // convert bigints to strings
    const convertedResults = results.map((result) => {
      // @ts-expect-error - we are converting bigints to strings
      result.size = result.size.toString()
      return result
    })


    return new Response(JSON.stringify(convertedResults), {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error: any) {
    console.error('error', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } finally {
    helia.stop()
    libp2p.stop()
  }
}
