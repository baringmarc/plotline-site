/// <reference types="node" />
// T4.1 Admin tour: the config behind the tabbed "Your side" section. Plan names: adminTourHead, adminTour,
// AdminShot, AdminTourTab. Files live in public/admin-tour/ and are served from /admin-tour/.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import source from './site.ts?raw'
import * as content from './site'
import { adminTour, adminTourHead, navLinks } from './site'

const IDS = ['dashboard', 'bookings', 'schedule', 'open-play', 'courts', 'reports', 'settings']
const LABELS = ['Dashboard', 'Bookings', 'Schedule', 'Open Play', 'Courts', 'Reports', 'Settings']

const tab = (id: string) => adminTour.find((t) => t.id === id)!
const allShots = () => adminTour.flatMap((t) => [...t.shots, ...(t.phone ? [t.phone] : [])])
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

/** Every visitor-facing string of the tour (file paths left out). */
function copy(): string[] {
  const out: string[] = [adminTourHead.label, adminTourHead.title, adminTourHead.lead]
  for (const t of adminTour) {
    out.push(t.label, t.title, ...t.callouts)
    for (const s of [...t.shots, ...(t.phone ? [t.phone] : [])]) out.push(s.alt)
  }
  return out
}

describe('admin tour config (T4.1)', () => {
  it('replaces the old features copy: featuresHead, features, featuresAlsoLabel and featuresAlso are gone', () => {
    for (const name of ['featuresHead', 'features', 'featuresAlsoLabel', 'featuresAlso']) {
      expect(content, name).not.toHaveProperty(name)
    }
  })

  it('has exactly seven tabs in the app’s sidebar order, with these ids and labels', () => {
    expect(adminTour.map((t) => t.id)).toEqual(IDS)
    expect(adminTour.map((t) => t.label)).toEqual(LABELS)
  })

  it('keeps the section label "Your side" and names the nav link to #features "For venue owners" (user, 2026-11-11)', () => {
    expect(adminTourHead.label).toBe('Your side')
    expect(navLinks).toContainEqual({ href: '#features', label: 'For venue owners' })
  })

  it('has a head that says every venue gets its own admin, and keeps the "from your phone" line', () => {
    expect(adminTourHead.title.trim()).not.toBe('')
    expect(adminTourHead.lead).toMatch(/every venue/i)
    expect(adminTourHead.lead).toMatch(/own admin/i)
    expect(`${adminTourHead.title} ${adminTourHead.lead}`).toMatch(/phone/i)
  })

  it('gives every tab a title and two or three short callouts', () => {
    for (const t of adminTour) {
      expect(t.title.trim(), t.id).not.toBe('')
      expect(t.callouts.length, t.id).toBeGreaterThanOrEqual(2)
      expect(t.callouts.length, t.id).toBeLessThanOrEqual(3)
      for (const c of t.callouts) {
        expect(c.trim(), t.id).not.toBe('')
        expect(words(c), c).toBeLessThanOrEqual(25)
      }
    }
  })

  it('maps the shots: Dashboard has dashboard + earnings desktop and a phone shot; Bookings a desktop and a phone shot; the rest one desktop shot, no phone', () => {
    expect(tab('dashboard').shots.map((s) => s.src)).toEqual(['/admin-tour/dashboard-desktop.png', '/admin-tour/earnings-desktop.png'])
    expect(tab('dashboard').phone?.src).toBe('/admin-tour/dashboard-phone.png')
    expect(tab('bookings').shots.map((s) => s.src)).toEqual(['/admin-tour/bookings-desktop.png'])
    expect(tab('bookings').phone?.src).toBe('/admin-tour/bookings-phone.png')
    for (const id of ['schedule', 'open-play', 'courts', 'reports', 'settings']) {
      expect(tab(id).shots.map((s) => s.src), id).toEqual([`/admin-tour/${id}-desktop.png`])
      expect(tab(id).phone, id).toBeUndefined()
    }
  })

  it('declares the real pixel size of each shot: 1280 x 800 desktop, 720 x 1520 phone', () => {
    for (const t of adminTour) {
      for (const s of t.shots) expect([s.width, s.height], s.src).toEqual([1280, 800])
      if (t.phone) expect([t.phone.width, t.phone.height], t.phone.src).toEqual([720, 1520])
    }
  })

  it('gives every shot alt text of more than 10 characters, none repeated', () => {
    const alts = allShots().map((s) => s.alt)
    expect(alts).toHaveLength(10)
    for (const a of alts) expect(a.trim().length, a).toBeGreaterThan(10)
    expect(new Set(alts).size).toBe(alts.length)
  })

  it('points every src at a root-relative file that exists in public/admin-tour/', () => {
    for (const s of allShots()) {
      expect(s.src).toMatch(/^\/admin-tour\/[a-z0-9-]+\.png$/)
      expect(() => readFileSync(resolve(process.cwd(), 'public', s.src.slice(1))), s.src).not.toThrow()
    }
  })

  it('declares the width and height that are in each PNG header (bytes 16-24, big-endian)', () => {
    for (const s of allShots()) {
      const file = readFileSync(resolve(process.cwd(), 'public', s.src.slice(1)))
      expect(file.subarray(1, 4).toString('latin1'), s.src).toBe('PNG')
      expect([file.readUInt32BE(16), file.readUInt32BE(20)], s.src).toEqual([s.width, s.height])
    }
  })
})

describe('admin tour callouts cover what the old cards and chips said (T4.1)', () => {
  const text = (id: string) => tab(id).callouts.join(' ')

  it('Dashboard: today’s courts and who is playing; earnings with booked hours and CSV export', () => {
    expect(text('dashboard')).toMatch(/today/i)
    expect(text('dashboard')).toMatch(/playing/i)
    expect(text('dashboard')).toMatch(/earnings/i)
    expect(text('dashboard')).toMatch(/booked hours/i)
    expect(text('dashboard')).toMatch(/CSV/)
  })

  it('Bookings: payment proofs (approve, or reject with a reason, warning if the amount is off) and moving a booking in the same sport', () => {
    expect(text('bookings')).toMatch(/payment proofs?/i)
    expect(text('bookings')).toMatch(/approve/i)
    expect(text('bookings')).toMatch(/reject/i)
    expect(text('bookings')).toMatch(/reason/i)
    expect(text('bookings')).toMatch(/amount/i)
    expect(text('bookings')).toMatch(/move a (confirmed )?booking/i)
    expect(text('bookings')).toMatch(/same sport/i)
  })

  it('Schedule: opening hours, blackouts and peak and off-peak rates', () => {
    expect(text('schedule')).toMatch(/hours/i)
    expect(text('schedule')).toMatch(/blackout/i)
    expect(text('schedule')).toMatch(/peak and off-peak/i)
  })
})

describe('admin tour claims only what ships (T4.1; SPEC §3.1 "Feature claims")', () => {
  const BANNED =
    /walk-?ins?|staff|promo(tion)?s?\b|colou?r presets?|presets?\b|themes?\b|reminders?|waitlist|wait list|free trial|trial|sign[ -]?up|booking alerts?|skill level/i

  it('has none of the unshipped claims in any tour copy, alt text included', () => {
    for (const s of copy()) expect(s).not.toMatch(BANNED)
  })

  it('types no peso amount into the tour copy', () => {
    for (const s of copy()) expect(s).not.toMatch(/₱\s?\d/)
    expect(source).not.toMatch(/₱\s?\d/)
  })
})
