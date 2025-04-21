// import { getHelia, type GetHeliaOptions } from './get-helia.js'
import { type Helia } from 'helia'
import { walkPath as exporterWalk, type UnixFSEntry } from 'ipfs-unixfs-exporter'

/**
 * @throws {AbortError}
 */
export async function runRepro ({ path, helia, signal }: { path: string, helia: Helia, signal: AbortSignal }): Promise<UnixFSEntry[]> {
  const results: UnixFSEntry[] = []

  for await (const entry of exporterWalk(path, helia.blockstore, { signal })) {
    console.log('entry', entry)
    results.push(entry)
  }

  return results
}

export { getHeliaAndLibp2p } from './get-helia.js'
