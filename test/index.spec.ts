/* eslint-env mocha */
import { logger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { type CID } from 'multiformats/cid'
import sinon from 'sinon'
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
    name: 'no bitswap nor libp2p routing',
    options: {
      // enableBitswap: false,
      // enableLibp2pRouting: false
    },
    timeout: 1000
  },
  {
    name: 'with libp2p routing and bitswap',
    options: {},
    timeout: 1000
  },
  {
    name: 'no libp2p routing',
    options: {
      enableLibp2pRouting: false
    },
    timeout: 1000
  },
  {
    name: 'no bitswap',
    options: {
      enableBitswap: false
    },
    timeout: 1000
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
    it(`should abort the request and not hang: ${testCase.name}`, async () => {
      if (process.env.TRUSTLESS_GATEWAY == null) {
        throw new Error('TRUSTLESS_GATEWAY is not set')
      }
      if (process.env.PROXY_SERVER == null) {
        throw new Error('PROXY_SERVER is not set')
      }
      const controller = new AbortController()
      const signal = controller.signal
      const { helia: heliaInstance, libp2p } = await getHeliaAndLibp2p({
        // gateways: [process.env.TRUSTLESS_GATEWAY],
        // routers: [process.env.TRUSTLESS_GATEWAY],
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

      const contentRoutingFindProvidersStub = sinon.stub(libp2p.contentRouting, 'findProviders')
      const fakeFindProviders = async function * (cid: CID, options: any) {
        log('libp2p.contentRouting.findProviders', cid, options)
        // controller.abort()
        yield * contentRoutingFindProvidersStub.wrappedMethod(cid, options)
      }
      contentRoutingFindProvidersStub.callsFake(fakeFindProviders)

      contentRoutingFindProvidersStub.onSecondCall().callsFake(async function * (cid: CID, options: any) {
        log('libp2p.contentRouting.findProviders, second call, aborting signal', cid, options)
        controller.abort()
        yield * contentRoutingFindProvidersStub.wrappedMethod(cid, options)
      })

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
        log('got result', result)
        expect(result).to.be.null() // we should never get here.
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // expected
          // throw err
          return
        }
        if (err.errors != null) {
          log.error('got an aggregate error:')
          for (const error of err.errors) {
            log.error('error in aggregate error:', error)
          }
        }
        expect(err).to.be.null()
      }
    })
  }
})
