import { prisma } from '../lib/prisma'

export async function usePostgresAuthState(sessionId: string): Promise<{
  state: any
  saveCreds: () => Promise<void>
}> {
  const { initAuthCreds, BufferJSON, proto } = await import('@whiskeysockets/baileys')

  const readData = async (type: string, ids: string[]) => {
    const rows = await prisma.authKey.findMany({
      where: { sessionId, keyType: type, keyId: { in: ids } }
    })
    const result: Record<string, any> = {}
    for (const row of rows) {
      // Re-parse to revive Buffer objects
      result[row.keyId] = JSON.parse(JSON.stringify(row.keyData), BufferJSON.reviver)
    }
    return result
  }

  const writeData = async (type: string, data: Record<string, any>) => {
    await Promise.all(
      Object.entries(data).map(([keyId, keyData]) => {
        if (keyData === null || keyData === undefined) {
          return prisma.authKey.deleteMany({
            where: { sessionId, keyType: type, keyId }
          })
        }
        const serialized = JSON.parse(JSON.stringify(keyData, BufferJSON.replacer))
        return prisma.authKey.upsert({
          where: { sessionId_keyType_keyId: { sessionId, keyType: type, keyId } },
          update: { keyData: serialized },
          create: { sessionId, keyType: type, keyId, keyData: serialized }
        })
      })
    )
  }

  const credsRow = await prisma.authKey.findFirst({
    where: { sessionId, keyType: 'creds', keyId: 'main' }
  })

  const creds = credsRow
    ? JSON.parse(JSON.stringify(credsRow.keyData), BufferJSON.reviver)
    : initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: readData,
        // Baileys calls set({ 'pre-key': { '0': v, '1': v }, 'session': { ... } })
        // — satu object dengan semua type sekaligus
        set: async (data: Record<string, Record<string, any>>) => {
          await Promise.all(
            Object.entries(data).map(([type, typeData]) => writeData(type, typeData))
          )
        }
      }
    },
    saveCreds: async () => {
      await writeData('creds', { main: creds })
    }
  }
}
