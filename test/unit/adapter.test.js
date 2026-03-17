// Unit tests for store adapter helpers
import test, { is } from 'tst'
import { sortFiles, sanitizeFilename, updateFileList, fileMeta } from '../../src/store/adapter.js'

test('sortFiles by date desc', () => {
  let files = [{ timestamp: 1, name: 'a' }, { timestamp: 3, name: 'b' }, { timestamp: 2, name: 'c' }]
  let sorted = sortFiles(files, { sortBy: 'date', order: 'desc' })
  is(sorted.map(f => f.name), ['b', 'c', 'a'])
})

test('sortFiles by name asc', () => {
  let files = [{ name: 'c' }, { name: 'a' }, { name: 'b' }]
  let sorted = sortFiles(files, { sortBy: 'name', order: 'asc' })
  is(sorted.map(f => f.name), ['a', 'b', 'c'])
})

test('sortFiles by size', () => {
  let files = [{ size: 300 }, { size: 100 }, { size: 200 }]
  let sorted = sortFiles(files, { sortBy: 'size', order: 'asc' })
  is(sorted.map(f => f.size), [100, 200, 300])
})

test('sanitizeFilename', () => {
  is(sanitizeFilename('My File (1).mp3'), 'my_file__1_.mp3')
  is(sanitizeFilename('hello.wav'), 'hello.wav')
  is(sanitizeFilename('résumé.m4a'), 'r_sum_.m4a')
})

test('updateFileList deduplicates and limits', () => {
  let files = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
  let result = updateFileList(files, { name: 'b', id: 'new' })
  is(result.length, 3)
  is(result[0].id, 'new') // new entry at front
  is(result.map(f => f.name), ['b', 'a', 'c']) // old 'b' removed, new at front
})

test('updateFileList caps at 10', () => {
  let files = Array.from({ length: 10 }, (_, i) => ({ name: `f${i}` }))
  let result = updateFileList(files, { name: 'new' })
  is(result.length, 10)
  is(result[0].name, 'new')
})

test('fileMeta creates metadata object', () => {
  let file = { name: 'test.mp3', size: 1024, type: 'audio/mpeg' }
  let meta = fileMeta(file, 'id-123', { duration: 3.5 })
  is(meta.id, 'id-123')
  is(meta.name, 'test.mp3')
  is(meta.size, 1024)
  is(meta.duration, 3.5)
  is(typeof meta.timestamp, 'number')
})
