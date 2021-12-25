/* eslint-disable no-console */
const bodyParser = require('body-parser')
const express = require('express')
const Vultr = require('vultr')
const {NodeSSH} = require('node-ssh')
const minecraftStatus = require('mc-server-status')

require('dotenv').config()
const ssh = new NodeSSH()

const reservedIp = process.env.reservedIp
const scriptName = 'minecraft v1'
const instanceName = 'minecraft_AUTO'
const minecraftUserPassword = process.env.minecraftSshPassword
const apiKey = process.env.vultrKey
const dropboxFolder = process.env.dropboxFolder || 'minecraft-server'
// Dropbox path should also be configured here!!!

const app = express()

app.use(express.static(`${__dirname}/public`)) // look in the public folder. If it's there, give it to them.
app.use(bodyParser.urlencoded({ extended: true })) // this lets us read POST data
app.use(bodyParser.json())
// app.set('trust proxy', 1); // trust first proxy

const vultrInstance = new Vultr(apiKey)

const cache = { playerCount: 'unknown', lastUpdate: undefined }

app.post('/shutdown', async (req, res) => {
  saveAndDestroyServer(res)
})

app.post('/startup', async (req, res) => {
  const status = await checkAndStartServer()
  res.send(status.join('\n'))
})

app.post('/status', async (req, res) => {
  const server = await getMinecraftServer()
  let actionsAllowed
  let message = ''
  if (!server) {
    message = `Server is off.`
    actionsAllowed = 'start'
  } else if (isServerOk(server)) {
    const createdDate = new Date(server.date_created + '+00:00').toISOString()
    message = 'Server is on. (since {' + createdDate + '}). Players: ' + useCachedPlayerCount(server.main_ip)
    actionsAllowed = 'stop'
  } else if (server) {
    message = `Server is starting up. Status: ${server.status}, state: ${server.server_state}`
    actionsAllowed = 'none'
    if (server.server_state === 'installingbooting') {
      // Special case: Vultr servers report 'installingbooting' for minutes after Minecraft has actually started!
      // So let's do the very slow check to see if Minecraft is running.
      const serverIp = server.main_ip
      const data = await getAndCacheMinecraftStatus(serverIp)
      if (data) {
        message = 'Server is on. (Just started.) Players: ' + useCachedPlayerCount(serverIp)
      }
    }
  }
  res.send({ message, actionsAllowed })
})

function isServerOk (server) {
  return server.status === 'active' && server.server_state === 'ok'
}

async function checkAndStartServer () {
  const log = []
  const oldSubId = await getMinecraftSubID()
  if (oldSubId !== null) {
    log.push('The server is already running')
    return log
  }
  const scriptID = await getScriptID()
  if (scriptID == null) {
    log.push('There is no startup script!?')
    return log
  }

  log.push('Creating server.')
  await vultrInstance.server.create({
    startupscript: scriptID,
    os: '270', // OSID, 270 is ubuntu 18.04 LTS
    region: '40', // DCID, 19 means Sydney, 40 means Singapore
    plan: '408', // VPSPLANID, 203 is 2 CPU / 4 GB, 204 is 4 CPU / 8 GB, 205 is 6 CPU / 16 GB
    // new High frequency plans: 402 -> 2 CPU 4GB ram, 403 -> 3 CPU, 404 -> 4 CPU (expensive)
    // 408 = 2 cpu, 2 GM of ram $18/month, was highest available currently
    label: instanceName,
    reserved_ip_v4: reservedIp
  }).catch(e => {
    log.push(e)
  })
  return log
}

async function getScriptID () {
  const results = await vultrInstance.startupscript.list()
  const list = Object.values(results)
  const best = list.find(ss => ss.name === scriptName)
  return best ? best.SCRIPTID : null
}

function destroyServer (subId) {
  vultrInstance.server.destroy(subId)
}

async function saveAndDestroyServer (res) {
  const server = await getMinecraftServer()
  if (server === null) {
    console.log('No server found')
    res.send('no server found')
    return
  }
  if (!isServerOk(server)) {
    console.log('server in weird state, aborting: ' + JSON.stringify(server))
    res.send('server in weird state, aborting: ' + JSON.stringify(server))
    return
  }

  const subId = server.SUBID
  const serverIp = server.main_ip

  const anyonePlaying = await isAnyonePlaying(serverIp)
  if (anyonePlaying) {
    console.log('someone is currently playing. Cancelling shutdown.')
    res.send('someone is currently playing. Cancelling shutdown.')
    return
  }

  console.log('destroying server')
  res.send('destroying server')
  await ssh.connect({
    host: serverIp,
    username: 'minecraft',
    port: 22,
    password: minecraftUserPassword
  })
  const result0 = await ssh.execCommand(`/usr/bin/screen -p 0 -S mc-server -X eval 'stuff "say SERVER SHUTTING DOWN IN 10 SECONDS..."\\015'`)
  console.log('ssh output after notify: ' + result0.stdout + ' // ' + result0.stderr)
  const result1 = await ssh.execCommand(`/usr/bin/screen -p 0 -S mc-server -X eval 'stuff "save-all"\\015'`)
  console.log('ssh output after save-all: ' + result1.stdout + ' // ' + result1.stderr)
  const result2 = await ssh.execCommand(`/bin/sleep 10`)
  console.log('ssh output after sleep 10: ' + result2.stdout + ' // ' + result2.stderr)
  const result3 = await ssh.execCommand(`rclone sync /home/minecraft/sync/game "dropbox:${dropboxFolder}"`)
  console.log('ssh output after rclone: ' + result3.stdout + ' // ' + result3.stderr)
  console.log('time to destroy the server')
  destroyServer(subId)
}

app.listen(process.env.PORT || 4000)
console.log('listening')

async function isAnyonePlaying (serverIp) {
  const data = await getAndCacheMinecraftStatus(serverIp)
  return data && data.players.online > 0
}

// Ideally, I would update a cloudflare DNS record instead of having a static IP.

// https://api.cloudflare.com/#dns-records-for-a-zone-update-dns-record

async function getMinecraftServer () {
  const results = await vultrInstance.server.list()
  const list = Object.values(results)
  const minecraftServers = list.filter(item => item.label.indexOf(instanceName) > -1)
  if (minecraftServers.length === 0) {
    console.log('no minecraft instance running')
    return null
  }
  if (minecraftServers.length === 1) {
    // console.log('found the running minecraft instance')
    return list[0]
  }
  console.log('Error: There is more than one minecraft server')
  return null
}

// find the ID of the minecraft server:
async function getMinecraftSubID () {
  const server = await getMinecraftServer()
  if (server) return server.SUBID
  return null
}

async function getAndCacheMinecraftStatus (serverIp) {
  // Setting the time first, instead of afterwards, prevents requests piling up
  cache.lastUpdate = new Date()
  const status = await minecraftStatus.getStatus(serverIp).catch(e => {})
  if (status) {
    cache.playerCount = status.players.online
  } else {
    cache.playerCount = 0
  }
  return status
}

function useCachedPlayerCount (serverIp) {
  if (!cache.lastUpdate || (new Date() - cache.lastUpdate) < 1000 * 60) {
    getAndCacheMinecraftStatus(serverIp) // but don't await it
  }
  return cache.playerCount
}
