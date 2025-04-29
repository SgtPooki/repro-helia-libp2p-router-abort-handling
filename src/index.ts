// import { getHelia, type GetHeliaOptions } from './get-helia.js'
import { type Helia } from 'helia'
import { walkPath as exporterWalk, type UnixFSEntry } from 'ipfs-unixfs-exporter'
import {createVerifiedFetch} from '@helia/verified-fetch'

/**
 * @throws {AbortError}
 */
export async function runReproOld ({ path, helia, signal }: { path: string, helia: Helia, signal: AbortSignal }): Promise<UnixFSEntry[]> {
  const results: UnixFSEntry[] = []

  for await (const entry of exporterWalk(path, helia.blockstore, { signal })) {
    console.log('entry', entry)
    results.push(entry)
  }

  return results
}
export async function runRepro ({ path, helia, signal }: { path: string, helia: Helia, signal: AbortSignal }): Promise<Response> {
  const vFetch = await createVerifiedFetch(helia)
  const res = await vFetch(`ipfs://${path}`, { signal })

  return res
}

export { getHeliaAndLibp2p } from './get-helia.js'
