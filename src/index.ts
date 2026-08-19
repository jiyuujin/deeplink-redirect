import { Hono } from 'hono'
import { ANDROID_KEYWORD, DOMAIN, IOS_KEYWORD } from './constants'
import { nanoid } from 'nanoid'

const app = new Hono<{ Bindings: { DB: D1Database; SLACK_WEBHOOK_URL?: string } }>()

async function notifySlack(webhookUrl: string | undefined, message: string) {
  if (!webhookUrl) return
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })
  } catch (err) {
    console.error('Failed to send Slack notification:', err)
  }
}

app.get('/', async (c) => {
  const { results: urlResults } = await c.env.DB.prepare(
    'SELECT * FROM urls ORDER BY created_at DESC',
  )
    .all()
  const { results: shortenUrlResults } = await c.env.DB.prepare(
    'SELECT * FROM shorten_urls ORDER BY created_at DESC',
  )
    .all()
  const allUrls = urlResults
  const allShortenUrls = shortenUrlResults

  const listHtml1 = allUrls.map((url) => `
    <tr class="border-b hover:bg-gray-100">
      <td class="px-4 py-2">${url.code}</td>
      <td class="px-4 py-2"><a class="text-blue-600 underline" href="/${url.code}" target="_blank">/${url.code}</a></td>
      <td class="px-4 py-2 text-sm text-gray-700">
        <div><strong>iOS:</strong> ${url.ios_url}</div>
        <div><strong>Android:</strong> ${url.android_url}</div>
        <div><strong>Fallback:</strong> ${url.fallback_url}</div>
      </td>
      <td class="px-4 py-2">
        <form method="POST" action="/admin/delete/${url.code}" onsubmit="return confirm('May I delete this?')">
          <button class="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded">Delete</button>
        </form>
      </td>
    </tr>
  `).join('')

  const listHtml2 = allShortenUrls.map((url) => `
    <tr class="border-b hover:bg-gray-100">
      <td class="px-4 py-2">
        <span id="url-${url.id}" class="copy-url" data-url="https://${DOMAIN}/s/${url.id}">${url.id}</span>
        <button onclick="navigator.clipboard.writeText('https://${DOMAIN}/s/${url.id}')" class="copy-btn">📋</button>
      </td>
      <td class="px-4 py-2 max-w-xs truncate overflow-hidden">${url.original_url}</td>
      <td class="px-4 py-2">
        <form method="POST" action="/admin/shorten/delete/${url.id}" onsubmit="return confirm('May I delete this?')">
          <button class="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded">Delete</button>
        </form>
      </td>
    </tr>
  `).join('')

  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <title>Urls</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 text-gray-800 p-8">
      <div class="max-w-5xl mx-auto bg-white p-6 rounded shadow">
        <h2 class="text-2xl font-semibold mb-4">Urls</h2>
        <a href="/admin/new" class="inline-block mb-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">+ Create URL</a>
        <table class="min-w-full text-sm">
          <thead class="bg-gray-200 text-left">
            <tr>
              <th class="px-4 py-2">Code</th>
              <th class="px-4 py-2">URL</th>
              <th class="px-4 py-2">URL</th>
              <th class="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>${listHtml1}</tbody>
        </table>
        <h2 class="text-2xl font-semibold mb-4">Shorten Urls</h2>
        <a href="/admin/shorten" class="inline-block mb-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">+ Create Shorten URL</a>
        <table class="min-w-full text-sm">
          <thead class="bg-gray-200 text-left">
            <tr>
              <th class="px-4 py-2">ID</th>
              <th class="px-4 py-2">Original URL</th>
              <th class="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>${listHtml2}</tbody>
        </table>
      </div>
    </body>
    </html>
  `)
})

app.get('/admin/new', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <title>Create URL</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 text-gray-800 p-8">
      <div class="max-w-lg mx-auto bg-white p-6 rounded shadow">
        <h1 class="text-xl font-semibold mb-4">Create URL</h1>
        <form method="POST" action="/admin/new" class="space-y-4">
          ${['code', 'ios_url', 'android_url', 'fallback_url'].map((name) => `
            <div>
              <label class="block text-sm font-medium">${name.toUpperCase()}</label>
              <input name="${name}" required class="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300" />
            </div>
          `).join('')}
          <div class="pt-4">
            <button type="submit" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Create URL</button>
            <a href="/admin" class="ml-4 text-blue-600 hover:underline">← Back</a>
          </div>
        </form>
      </div>
    </body>
    </html>
  `)
})

app.get('/admin/shorten', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <title>Create Shorten URL</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 text-gray-800 p-8">
      <div class="max-w-lg mx-auto bg-white p-6 rounded shadow">
        <h1 class="text-xl font-semibold mb-4">Create Shorten URL</h1>
        <form method="POST" action="/admin/shorten" class="space-y-4">
          ${['url'].map((name) => `
            <div>
              <label class="block text-sm font-medium">${name.toUpperCase()}</label>
              <input name="${name}" required class="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300" />
            </div>
          `).join('')}
          <div class="pt-4">
            <button type="submit" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Create Shorten URL</button>
            <a href="/admin" class="ml-4 text-blue-600 hover:underline">← Back</a>
          </div>
        </form>
      </div>
    </body>
    </html>
  `)
})

app.post('/admin/new', async (c) => {
  const body = await c.req.parseBody()

  await c.env.DB.prepare(
    'INSERT INTO urls (code, ios_url, android_url, fallback_url) VALUES (?, ?, ?, ?)',
  )
    .bind(body.code, body.ios_url, body.android_url, body.fallback_url)
    .run()

  const message = `🔗 *New URL Created*\n• *Code:* ${body.code}\n• *iOS:* ${body.ios_url}\n• *Android:* ${body.android_url}\n• *Fallback:* ${body.fallback_url}`
  c.executionCtx.waitUntil(notifySlack(c.env.SLACK_WEBHOOK_URL, message))

  return c.redirect('/admin')
})

app.post('/admin/shorten', async (c) => {
  const body = await c.req.parseBody()
  const id = nanoid(6)

  await c.env.DB.prepare(
    'INSERT INTO shorten_urls (id, original_url) VALUES (?, ?)',
  )
    .bind(id, body.url)
    .run()

  const message = `✂️ *New Shorten URL Created*\n• *ID:* ${id}\n• *URL:* https://${DOMAIN}/s/${id}\n• *Original:* ${body.url}`
  c.executionCtx.waitUntil(notifySlack(c.env.SLACK_WEBHOOK_URL, message))

  return c.redirect('/admin')
})

app.post('/admin/delete/:code', async (c) => {
  const code = c.req.param('code')

  await c.env.DB.prepare(
    'DELETE FROM urls WHERE code = ?',
  )
    .bind(code)
    .run()

  return c.redirect('/admin')
})

app.post('/admin/shorten/delete/:code', async (c) => {
  const code = c.req.param('code')

  await c.env.DB.prepare(
    'DELETE FROM shorten_urls WHERE id = ?',
  )
    .bind(code)
    .run()

  return c.redirect('/admin')
})

app.get('/:code', async (c) => {
  const code = c.req.param('code')

  const ua = c.req.header('user-agent') || ''
  const isIOS = IOS_KEYWORD.test(ua)
  const isAndroid = ANDROID_KEYWORD.test(ua)

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM urls WHERE code = ?',
  )
    .bind(code)
    .all()
  const link = results[0]

  if (!link) {
    return c.text('No link found', 404)
  }

  const redirectUrl = isIOS
    ? link.ios_url
    : isAndroid
      ? link.android_url
      : link.fallback_url

  if (!redirectUrl) {
    return c.text('No redirect URL found', 404)
  }

  await c.env.DB.prepare(
    'INSERT INTO click_logs (code, user_agent, ip) VALUES (?, ?, ?)',
  )
    .bind(code, ua, c.req.header('cf-connecting-ip') ?? '')
    .run()

  return c.redirect(redirectUrl.toString(), 302)
})

app.get('/s/:id', async (c) => {
  const id = c.req.param('id')

  const result = await c.env.DB.prepare(
    'SELECT original_url FROM shorten_urls WHERE id = ?',
  )
    .bind(id)
    .first()

  if (!result) {
    return c.text('URL not found', 404)
  }
  if (!result.original_url) {
    return c.text('Original URL not found', 404)
  }

  return c.redirect(result.original_url.toString())
})

// function deeplinkRedirectLogoSvg(idSuffix: string, size = 40): string {
//   const gradId = `deeplinkRedirectGrad-${idSuffix}`
//   return `
//     <svg width="${size}" height="${size}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Deeplink Redirect">
//       <defs>
//         <linearGradient id="${gradId}" x1="0" y1="0" x2="48" y2="0" gradientUnits="userSpaceOnUse">
//           <stop offset="0%" stop-color="#818cf8"/>
//           <stop offset="100%" stop-color="#a78bfa"/>
//         </linearGradient>
//       </defs>
//       <path d="M18 30 L10 30 A8 8 0 0 1 10 14 L18 14" fill="none" stroke="url(#${gradId})" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
//       <path d="M30 14 L38 14 A8 8 0 0 1 38 30 L30 30" fill="none" stroke="url(#${gradId})" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
//       <line x1="16" y1="22" x2="32" y2="22" stroke="url(#${gradId})" stroke-width="3.5" stroke-linecap="round"/>
//     </svg>
//   `
// }

export default app
