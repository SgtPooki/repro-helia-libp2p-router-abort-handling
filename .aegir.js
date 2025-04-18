// @ts-check
import {createNode} from 'ipfsd-ctl'
import {path as kuboPath} from 'kubo'
import { create } from 'kubo-rpc-client'
import polka from 'polka'

/** @type {import('aegir').PartialOptions} */
const options = {
  test: {
    build: false,
    bail: false,
    async before () {
      const node = await createNode({
        type: 'kubo',
        disposable: true,
        bin: kuboPath(),
        rpc: create,
        args: [],
        init: {
          config: {
            Gateway: {
              NoFetch: false,
              DeserializedResponses: true,
              ExposeRoutingAPI: true,
              HTTPHeaders: {
                'Access-Control-Allow-Origin': ['*'],
                'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'OPTIONS']
              }
            }
          }
        }
      })

      // create a polka server that forwards requests to the node, and sends the response but delays it by 1 second
      const proxyServer = polka({
        port: 0,
        host: '127.0.0.1'
      })
      const {gateway} = await node.info()

      proxyServer.use(async (req, res, next) => {
        console.log('forwarding request to', `${gateway}${req.url}`)
        const response = await fetch(`${gateway}${req.url}`, {
          method: req.method,
          headers: req.headers
        })
        if (response.body == null) {
          throw new Error('response body is null')
        }

        const buffer = await response.arrayBuffer()
        await new Promise(resolve => setTimeout(resolve, 50000)).then(() => {
          res.end(Buffer.from(buffer))
        })
      })

      proxyServer.listen()

      const { port: proxyServerPort } = proxyServer.server.address()
      console.log('proxy server listening on', `http://127.0.0.1:${proxyServerPort}`)



      return {
        node,
        env: {
          TRUSTLESS_GATEWAY: gateway,
          PROXY_SERVER: `http://127.0.0.1:${proxyServerPort}`
        }
      }
    },
    async after (options, before) {
      // @ts-expect-error aegir types are broken
      await before?.proxyServer.close()
      // @ts-expect-error aegir types are broken
      await before?.node.stop()
    }
  }
}

export default options
