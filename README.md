Minecraft server manager

5am: take snapshot
30m later: check snapshot exists - if it does exist, shut down the server.

make snapshot
curl -H 'API-Key: YOURKEY' https://api.vultr.com/v1/snapshot/create --data 'SUBID=?????,description=desc'

list snapshots
curl -H 'API-Key: YOURKEY' https://api.vultr.com/v1/snapshot/list

