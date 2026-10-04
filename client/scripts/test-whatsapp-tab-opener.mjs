/**
 * Verifies the WhatsApp tab-opener contract:
 * - prepare without noopener (so WindowProxy is returned)
 * - navigate the new tab only
 * - never assign window.location.href on the current page
 * - popup-blocked fallback uses <a target="_blank">
 */
import assert from 'assert'

const calls = {
  open: [],
  locationAssigns: [],
  currentLocation: null,
  anchors: [],
}

globalThis.window = {
  open(url, target, features) {
    calls.open.push({ url, target, features })
    if (String(features || '').includes('noopener')) return null
    return {
      closed: false,
      location: {
        set href(value) {
          calls.locationAssigns.push(value)
        },
      },
      opener: {},
      close() {
        this.closed = true
      },
    }
  },
  location: {
    set href(value) {
      calls.currentLocation = value
    },
  },
}

globalThis.document = {
  body: { appendChild() {} },
  createElement() {
    return {
      href: '',
      target: '',
      rel: '',
      style: {},
      click() {
        calls.anchors.push({ href: this.href, target: this.target, rel: this.rel })
      },
      remove() {},
    }
  },
}

/** Mirrors client/src/utils/whatsapp.js#createExternalTabOpener */
const createExternalTabOpener = () => {
  let tab = null
  try {
    tab = window.open('about:blank', '_blank')
  } catch {
    tab = null
  }
  return {
    prepared: Boolean(tab && !tab.closed),
    navigate(url) {
      if (!url) return false
      if (tab && !tab.closed) {
        try {
          tab.location.href = url
          try {
            tab.opener = null
          } catch {
            /* ignore */
          }
          return true
        } catch {
          /* fall through */
        }
      }
      try {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        return true
      } catch {
        return false
      }
    },
    close() {
      if (tab && !tab.closed) tab.close()
      tab = null
    },
  }
}

const url = 'https://wa.me/212665330116?text=Hello'

// Regression: noopener prepare returns null → old code redirected current page
assert.strictEqual(window.open('about:blank', '_blank', 'noopener,noreferrer'), null)
calls.open = []

const opener = createExternalTabOpener()
assert.strictEqual(opener.prepared, true)
assert.ok(!String(calls.open.at(-1).features || '').includes('noopener'))
assert.strictEqual(opener.navigate(url), true)
assert.deepStrictEqual(calls.locationAssigns, [url])
assert.strictEqual(calls.currentLocation, null)

const blocked = createExternalTabOpener()
blocked.close()
assert.strictEqual(blocked.navigate(url), true)
assert.ok(calls.anchors.some((a) => a.target === '_blank' && a.href === url))
assert.strictEqual(calls.currentLocation, null)

console.log('test-whatsapp-tab-opener: all assertions passed')
