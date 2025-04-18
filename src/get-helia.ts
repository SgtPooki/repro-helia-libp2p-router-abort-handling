import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { trustlessGateway, bitswap } from '@helia/block-brokers'
import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import { type BlockBroker } from '@helia/interface'
import { httpGatewayRouting, libp2pRouting } from '@helia/routers'
import { generateKeyPair } from '@libp2p/crypto/keys'
import { dcutr } from '@libp2p/dcutr'
import { identify, identifyPush } from '@libp2p/identify'
import { keychain } from '@libp2p/keychain'
import { prefixLogger } from '@libp2p/logger'
import { ping } from '@libp2p/ping'
import { webSockets } from '@libp2p/websockets'
import { webTransport } from '@libp2p/webtransport'
import { dns, type DNSResolvers } from '@multiformats/dns'
import { dnsJsonOverHttps } from '@multiformats/dns/resolvers'
import { createHelia, type DefaultLibp2pServices, type Helia, type HeliaLibp2p, type Routing } from 'helia'
import { libp2pDefaults as heliaLibp2pDefaults } from 'helia'
import { createLibp2p, type Libp2p, type Libp2pOptions } from 'libp2p'
import * as libp2pInfo from 'libp2p/version'

const logger = prefixLogger('helia:repro')

export interface GetHeliaOptions {
  gateways: string[]
  routers: string[]
  dnsJsonResolvers: Record<string, string>
  enableRecursiveGateways: boolean
  enableGatewayProviders: boolean
  enableWss: boolean
  enableWebTransport: boolean
  enableBitswap: boolean
  enableLibp2pRouting: boolean
  useLibp2pDefaultTransports: boolean
}

export async function getHeliaAndLibp2p (config: GetHeliaOptions): Promise<{ helia: HeliaLibp2p<Libp2p<any>>, libp2p: Libp2p<any> }> {
  const log = logger.forComponent('get-helia')

  // Start by adding the config routers as delegated routers
  const routers: Array<Partial<Routing>> = []

  if (config.enableRecursiveGateways) {
    log('enabling recursive gateways')
    // Only add the gateways if the recursive gateways toggle is enabled
    routers.push(httpGatewayRouting({ gateways: config.gateways }))
  }

  // set dns resolver instances
  const dnsResolvers: DNSResolvers = {}
  for (const [key, value] of Object.entries(config.dnsJsonResolvers)) {
    dnsResolvers[key] = dnsJsonOverHttps(value)
  }
  const dnsConfig = dns({ resolvers: dnsResolvers })

  const blockBrokers: Array<(components: any) => BlockBroker> = []

  if (config.enableGatewayProviders) {
    log('enabling gateway providers')
    blockBrokers.push(trustlessGateway({ allowLocal: true }))
  }

  // const hashers = [blake3]

  // If we are using websocket or webtransport, we need to instantiate libp2p
  if (config.enableBitswap) {
    blockBrokers.push(bitswap())
  }
  const libp2pOptions = await libp2pDefaults(config)
  log('libp2p options are: %o', libp2pOptions)
  libp2pOptions.dns = dnsConfig
  let libp2p: Libp2p
  try {
    libp2p = await createLibp2p(libp2pOptions)
  } catch (err) {
    log('error creating libp2p: %o', err)
    throw err
  }
  log('libp2p created')
  if (config.enableLibp2pRouting) {
    routers.push(libp2pRouting(libp2p))
  }

  const helia = await createHelia({
    logger,
    libp2p,
    routers,
    blockBrokers,
    dns: dnsConfig
  })

  return { helia, libp2p }
}

type Libp2pDefaultsOptions = Pick<GetHeliaOptions, 'routers' | 'enableWss' | 'enableWebTransport' | 'enableGatewayProviders' | 'useLibp2pDefaultTransports'>

export async function libp2pDefaults (config: Libp2pDefaultsOptions): Promise<Libp2pOptions> {
  const agentVersion = `@helia/verified-fetch ${libp2pInfo.name}/${libp2pInfo.version} UserAgent=${globalThis.navigator.userAgent}`
  const privateKey = await generateKeyPair('Ed25519')

  const filterAddrs = [] as string[]
  const transports: Array<(components: any) => any> = []
  if (config.useLibp2pDefaultTransports) {
    const defaultTransports = heliaLibp2pDefaults().transports
    if (defaultTransports == null) {
      throw new Error('defaultTransports is null')
    }
    transports.push(...defaultTransports)
  }

  if (config.enableWss) {
    if (!config.useLibp2pDefaultTransports) {
      transports.push(webSockets())
    }
    filterAddrs.push('wss') // /dns4/sv15.bootstrap.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJ
    filterAddrs.push('tls') // /ip4/A.B.C.D/tcp/4002/tls/sni/A-B-C-D.peerid.libp2p.direct/ws/p2p/peerid
  }
  if (config.enableWebTransport) {
    // if (!config.useLibp2pDefaultTransports) {
    transports.push(webTransport())
    // }
    filterAddrs.push('webtransport')
  }
  if (config.enableGatewayProviders) {
    filterAddrs.push('https') // /dns/example.com/tcp/443/https
    filterAddrs.push('tls') // /ip4/A.B.C.D/tcp/4002/tls/sni/example.com/http
  }

  const libp2pOptions: Libp2pOptions & Required<Pick<Libp2pOptions, 'services'>> = {
    privateKey,
    addresses: {}, // no need to listen on any addresses
    transports,
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      dcutr: dcutr(),
      identify: identify({
        agentVersion
      }),
      identifyPush: identifyPush({
        agentVersion
      }),
      keychain: keychain(),
      ping: ping()
    }
  } satisfies Libp2pOptions

  // Add delegated routing services for each passed delegated router endpoint
  config.routers.forEach((router, i) => {
    libp2pOptions.services[`delegatedRouter${i}`] = () => createDelegatedRoutingV1HttpApiClient(router, {
      filterProtocols: ['unknown', 'transport-bitswap', 'transport-ipfs-gateway-http'],
      filterAddrs
    })
  })

  return libp2pOptions
}
