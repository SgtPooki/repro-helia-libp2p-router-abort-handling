/* eslint-env mocha */
import { logger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { getHeliaAndLibp2p, type GetHeliaOptions } from '../src/get-helia.js'
import { runRepro } from '../src/index.js'
import type { Helia } from 'helia'

const log = logger('helia:repro:test')

interface TestCases {
  name: string
  options: Partial<GetHeliaOptions>
  timeout: number
}

const testCases: TestCases[] = [
  {
    name: 'libp2p routing=false, bitswap=false',
    options: {
      enableBitswap: false,
      enableLibp2pRouting: false,
      // enableRecursiveGateways: false,
      // enableGatewayProviders: false
    },
    timeout: 200
  },
  {
    name: 'libp2p routing=true, bitswap=true',
    options: {
      // enableRecursiveGateways: false,
      // enableGatewayProviders: false
    },
    timeout: 200
  },
  {
    name: 'libp2p routing=false, bitswap=true',
    options: {
      enableLibp2pRouting: false,
      enableBitswap: true,
      // enableRecursiveGateways: false,
      // enableGatewayProviders: false
    },
    timeout: 200
  },
  {
    name: 'libp2p routing=true, bitswap=false',
    options: {
      enableLibp2pRouting: true,
      enableBitswap: false,
      // enableRecursiveGateways: false,
      // enableGatewayProviders: false
    },
    timeout: 200
  }
]
describe('repro', function () {
  let timeout: NodeJS.Timeout
  let helia: Helia
  afterEach(() => {
    clearTimeout(timeout)
    helia.stop()
  })
  for (const testCase of testCases) {
    it(`should abort the request and not hang: ${testCase.name}`, async function () {
      this.timeout(testCase.timeout * 10)
      if (process.env.TRUSTLESS_GATEWAY == null) {
        throw new Error('TRUSTLESS_GATEWAY is not set')
      }
      if (process.env.PROXY_SERVER == null) {
        throw new Error('PROXY_SERVER is not set')
      }
      const controller = new AbortController()
      const signal = controller.signal
      const { helia: heliaInstance, libp2p } = await getHeliaAndLibp2p({
        gateways: [process.env.PROXY_SERVER],
        routers: [process.env.TRUSTLESS_GATEWAY],
        dnsJsonResolvers: {},
        enableRecursiveGateways: true,
        enableGatewayProviders: true,
        enableWss: true,
        enableWebTransport: true,
        enableBitswap: true,
        enableLibp2pRouting: true,
        useLibp2pDefaultTransports: true,
        ...testCase.options
      })
      helia = heliaInstance

      timeout = setTimeout(() => {
        controller.abort()
      }, testCase.timeout)

      try {
        const result = await runRepro({
          // see https://explore.ipld.io/#/explore/QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1%20-%20Barrel%20-%20Part%201/1%20-%20Barrel%20-%20Part%201.png
          // path: 'QmawceGscqN4o8Y8Fv26UUmB454kn2bnkXV5tEQYc4jBd6',
          path: 'QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1 - Barrel - Part 1/1 - Barrel - Part 1.png',
          helia,
          signal
        })
        log.error('got result unexpectedly:', result)
        expect(result).to.be.null('Did not respect the abort, or resolved before the abort was triggered') // we should never get here.
      } catch (err: any) {
        log('got error as expected:', err)
        if (err.name === 'AbortError') {
          // expected
          expect(true).to.be.true('Abort signal was respected.')
          return
        }
        if (err.errors != null) {
          log.error('got an aggregate error:')
          for (const error of err.errors) {
            log.error('error in aggregate error:', error)
          }
        }
        expect(err).to.be.null('Received unexpected error.')
      }
    })
  }
})
