import { CID } from 'multiformats/cid'
// import { getHelia, type GetHeliaOptions } from './get-helia.js'
import { type Helia } from 'helia'
import { walkPath as exporterWalk, type UnixFSEntry } from 'ipfs-unixfs-exporter'

/**
 * @throws {AbortError}
 */
export async function runRepro ({path, helia, signal}: {path: string, helia: Helia, signal: AbortSignal}): Promise<Array<UnixFSEntry>> {

  const results: Array<UnixFSEntry> = []

  for await (const entry of exporterWalk(path, helia.blockstore, { signal })) {
    console.log('entry', entry)
    results.push(entry)
  }

  return results
}
