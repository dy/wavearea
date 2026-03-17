// Unit tests for storage adapters — runs in Node.js, no browser needed
import test, { is, ok } from 'tst'
import { MemoryAdapter } from '../../src/store/memory.js'

test('memory: add → list → get → has → delete → clear', async () => {
  let store = new MemoryAdapter()
  await store.init()
  await store.clearAll()

  let blob = new Blob([new Uint8Array(1024)])
  blob.name = 'test.mp3'
  let id = await store.addFile(blob, { name: 'test.mp3' })

  ok(typeof id === 'string', 'addFile returns string id')

  let files = await store.getFiles()
  is(files.length, 1)
  is(files[0].name, 'test.mp3')

  let has = await store.hasFile(id)
  ok(has, 'hasFile returns true')

  let file = await store.getFile(id)
  is(file.size, 1024)

  await store.deleteFile(id)
  let after = await store.getFiles()
  is(after.length, 0)

  let hasAfter = await store.hasFile(id)
  ok(!hasAfter, 'hasFile returns false after delete')
})

test('memory: sorts by name and date', async () => {
  let store = new MemoryAdapter()
  await store.clearAll()

  let a = new Blob([new Uint8Array(10)], {type:'audio/mpeg'}); a.name = 'b.mp3'
  let b = new Blob([new Uint8Array(20)], {type:'audio/mpeg'}); b.name = 'a.mp3'
  await store.addFile(a, { name: 'b.mp3' })
  await new Promise(r => setTimeout(r, 5))
  await store.addFile(b, { name: 'a.mp3' })

  let byDate = await store.getFiles({ sortBy: 'date', order: 'desc' })
  is(byDate[0].name, 'a.mp3')

  let byName = await store.getFiles({ sortBy: 'name', order: 'asc' })
  is(byName[0].name, 'a.mp3')

  await store.clearAll()
})

test('memory: updateFile', async () => {
  let store = new MemoryAdapter()
  await store.clearAll()

  let blob = new Blob([new Uint8Array(100)], {type:'audio/mpeg'}); blob.name = 'x.mp3'
  let id = await store.addFile(blob, { name: 'x.mp3' })

  let bigger = new Blob([new Uint8Array(200)], {type:'audio/mpeg'}); bigger.name = 'x.mp3'
  await store.updateFile(id, bigger, { name: 'x.mp3' })

  let files = await store.getFiles()
  is(files[0].size, 200)

  await store.clearAll()
})

test('memory: deduplicates by name', async () => {
  let store = new MemoryAdapter()
  await store.clearAll()

  let a = new Blob([new Uint8Array(10)], {type:'audio/mpeg'}); a.name = 'same.mp3'
  await store.addFile(a, { name: 'same.mp3' })
  await store.addFile(a, { name: 'same.mp3' })

  let files = await store.getFiles()
  is(files.length, 1)

  await store.clearAll()
})

test('memory: limits to 10 files', async () => {
  let store = new MemoryAdapter()
  await store.clearAll()

  for (let i = 0; i < 12; i++) {
    let b = new Blob([new Uint8Array(1)], {type:'audio/mpeg'}); b.name = `f${i}.mp3`
    await store.addFile(b, { name: `f${i}.mp3` })
  }

  let files = await store.getFiles()
  is(files.length, 10)

  await store.clearAll()
})
