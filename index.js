/* eslint-disable no-console */
const bodyParser = require('body-parser')
const express = require('express')
const Vultr = require('vultr')
require('dotenv').config()

const app = express()

app.use(express.static(`${__dirname}/public`)) // look in the public folder. If it's there, give it to them.
app.use(bodyParser.urlencoded({ extended: true })) // this lets us read POST data
app.use(bodyParser.json())
// app.set('trust proxy', 1); // trust first proxy

const apiKey = process.env.vultrKey
var vultrInstance = new Vultr(apiKey)

app.post('/shutdown', async (req, res) => {
  snapshotAndDestroyServer(res)
})

app.post('/startup', async (req, res) => {
  const status = await checkAndStartServer()
  res.send(status.join('\n'))
})

function timeSinceSave (snapshot) {
  const saveDate = new Date(snapshot.description.replace('minecraft AUTO ', ''))
  const now = new Date()
  const minutes = Math.floor((now.getTime() - saveDate.getTime()) / 1000 / 60)
  return minutes + ' minutes ago'
}

app.post('/status', async (req, res) => {
  const server = await getMinecraftServer()
  const snapshot = await getMostRecentSnapshot()
  let result = ''
  if (!server && snapshot.status === 'complete') {
    result = `Server is off. Last save was ${timeSinceSave(snapshot)}`
  } else if (server && snapshot.status !== 'complete') {
    result = `Server is shutting down since ${timeSinceSave(snapshot)}`
  } else if (server && server.status === 'active' && server.server_state === 'ok') {
    result = 'Server is on.'
  } else if (server) {
    result = `Server is starting up. Status: ${server.status}, state: ${server.server_state}`
  } else {
    result = 'Something is wrong.' + JSON.stringify(server) + JSON.stringify(snapshot)
  }
  res.send(result)
})

async function checkAndStartServer () {
  const log = []
  const oldSubId = await getMinecraftSubID()
  if (oldSubId !== null) {
    log.push('The server is already running')
    return log
  }
  const mostRecentSnapshot = await getMostRecentSnapshot()
  if (mostRecentSnapshot == null) {
    log.push('There is no snapshot to restore!?')
    return log
  }
  // region means DCID, 19 means Sydney. os means OSID, 164 is for snapshots. Plan is VPSPLANID
  vultrInstance.server.create({
    snapshot: mostRecentSnapshot.id,
    os: '164',
    region: '19',
    plan: '205', // 203 is the 2 CPU plan, 204 is 4 CPU, 205 is 6 CPU 
    label: 'minecraft AUTO',
    reserved_ip_v4: '45.76.115.84'
  })
  log.push('Creating server. This may take 15 minutes.')
  return log
}

const delayMinutes = minutes => new Promise(resolve => setTimeout(resolve, minutes * 60 * 1000))

async function getMostRecentSnapshot () {
  const results = await vultrInstance.snapshot.list()
  const list = Object.values(results)
  const best = list.filter(ss => ss.description.indexOf('minecraft AUTO ') > -1).sort((s1, s2) => s1.description < s2.description)[0]
  console.log('Best snapshot: ' + best.description)
  return { id: best.SNAPSHOTID, description: best.description, status: best.status }
}

async function isSnapshotReady (name) {
  const results = await vultrInstance.snapshot.list()
  const list = Object.values(results)
  return list.some(snapshot => snapshot.description === name && snapshot.status === 'complete')
}

function destroyServer (subId) {
  vultrInstance.server.destroy(subId)
}

async function snapshotAndDestroyServer (res) {
  const subId = await getMinecraftSubID()
  if (subId === null) {
    console.log('No server found')
    res.send('no server found')
    return
  }
  const oldSnapshot = await getMostRecentSnapshot()
  if (oldSnapshot.status !== 'complete') {
    console.log('There is already a save in progress, since ' + timeSinceSave(oldSnapshot))
    res.send('There is already a save in progress, since ' + timeSinceSave(oldSnapshot))
    return
  }

  const snapshotName = 'minecraft AUTO ' + (new Date().toISOString())
  console.log('instance ID: ' + subId)
  console.log('Creating snapshot')
  res.send('Creating a snapshot. When this is done, the server will shut down (maybe 15 minutes)')
  vultrInstance.snapshot.create(subId, snapshotName)
  // check every minute until the snapshot is created, or give up eventually?
  let attempts = 0
  while (attempts++ < 60) {
    await delayMinutes(1)
    const isReady = await isSnapshotReady(snapshotName)
    if (!isReady) {
      console.log('Still waiting for snapshot (attempt ' + attempts + ')')
    } else {
      console.log('destroying server')
      destroyServer(subId)
      return
    }
  }
  console.log("Snapshot took too long to create. I'm giving up (I am not shutting down the server.)")
}

app.listen(process.env.PORT || 4000)
console.log('listening')

// see https://www.npmjs.com/package/vultr

// then i need 'start up server'
// find the snapshot with the highest id
// start a server using that
// get its ip address
// tell the user. Ideally, update cloudflare
// https://support.cloudflare.com/hc/en-us/articles/360020524512-Manage-dynamic-IPs-in-Cloudflare-DNS-programmatically

// then i need a web ui for these two functions, also a 'is server running' display

async function getMinecraftServer () {
  const results = await vultrInstance.server.list()
  const list = Object.values(results)
  const minecraftServers = list.filter(item => item.label.indexOf('minecraft AUTO') > -1)
  if (minecraftServers.length === 0) {
    console.log('no minecraft instance running')
    return null
  }
  if (minecraftServers.length === 1) {
    console.log('found the running minecraft instance')
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
