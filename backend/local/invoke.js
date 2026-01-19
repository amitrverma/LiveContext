const fs = require('fs')
const path = require('path')

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      return
    }
    const index = trimmed.indexOf('=')
    if (index === -1) {
      return
    }
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  })
}

async function main() {
  const [, , handlerPathArg, eventPathArg] = process.argv

  if (!handlerPathArg) {
    console.error('Usage: node local/invoke.js <handlerPath> [eventPath]')
    process.exit(1)
  }

  const envPath = path.resolve(__dirname, '..', '.env')
  loadEnv(envPath)

  const handlerPath = path.resolve(__dirname, '..', handlerPathArg)
  const mod = require(handlerPath)
  const handler = mod.handler

  if (typeof handler !== 'function') {
    console.error('No handler export found at', handlerPath)
    process.exit(1)
  }

  let event = {}
  if (eventPathArg) {
    const eventPath = path.resolve(process.cwd(), eventPathArg)
    const raw = fs.readFileSync(eventPath, 'utf8')
    event = JSON.parse(raw)
  }

  const result = await handler(event)
  if (result !== undefined) {
    console.log(JSON.stringify(result, null, 2))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
