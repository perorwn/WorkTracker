import test from 'node:test'
import assert from 'node:assert/strict'
import { weekFromRows, weekTotalMinutes, buildContributionData, formatDuration, intensityLevel, dailyIntensityLevel, getWeekStart, dateKey } from '../lib/work-data.ts'
import { fetchWorkRows } from '../lib/supabase.ts'

test('hourly seconds survive conversion, week/year totals agree, missing days are zero', () => {
  const rows = [{date:'2026-09-07',hour:23,seconds:72},{date:'2026-09-08',hour:0,seconds:1361}]
  const now = new Date(2026,8,8,12)
  const week = weekFromRows(rows,getWeekStart(now))
  assert.equal(Math.round(weekTotalMinutes(week)*60),1433)
  assert.equal(week[0][23],1.2)
  assert.equal(week[2][0],0)
  const year = buildContributionData(rows,now)
  assert.equal(year.length,365)
  assert.equal(dateKey(year.at(-1).date),'2026-09-08')
  assert.equal(Math.round(year.reduce((sum,d)=>sum+d.minutes,0)*60),1433)
  assert.equal(formatDuration(1433/60),'23분 53초')
  assert.equal(formatDuration(3599/60),'59분 59초')
  assert.equal(formatDuration(60),'1시간')
  assert.equal(intensityLevel(60),4)
  assert.equal(intensityLevel(15),2)
  assert.equal(dailyIntensityLevel(329.99),1)
  assert.equal(dailyIntensityLevel(330),2)
  assert.equal(dailyIntensityLevel(390),3)
  assert.equal(dailyIntensityLevel(450),4)
})

test('pagination handles a server cap below requested limit and sends only publishable apikey',async () => {
  const original = globalThis.fetch
  const offsets=[]
  globalThis.fetch=async (url,options)=>{
    offsets.push(Number(url.searchParams.get('offset')))
    assert.equal(options.headers.Authorization,undefined)
    assert.equal(url.searchParams.getAll('date').length,2)
    return new Response(JSON.stringify(offsets.length<=2 ? [{date:'2026-09-08',hour:offsets.length,seconds:60}] : []))
  }
  try {
    const rows=await fetchWorkRows('2026-09-01','2026-09-08',new AbortController().signal)
    assert.equal(rows.length,2)
    assert.deepEqual(offsets,[0,1,2])
  } finally {globalThis.fetch=original}
})

test('HTTP failure and invalid records are errors, not empty successful data',async () => {
  const original=globalThis.fetch
  try {
    globalThis.fetch=async()=>new Response('',{status:403})
    await assert.rejects(fetchWorkRows('2026-09-01','2026-09-08',new AbortController().signal),/403/)
    globalThis.fetch=async()=>new Response(JSON.stringify([{date:'2026-09-08',hour:24,seconds:10}]))
    await assert.rejects(fetchWorkRows('2026-09-01','2026-09-08',new AbortController().signal),/잘못된/)
  } finally {globalThis.fetch=original}
})
