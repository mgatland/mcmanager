Minecraft server manager

We have a Minecraft server running on Vultr. Vultr charge by the minute, but we only use the server for a few hours a week, so we waste a lot of money running an empty server.

This tool makes it easy to start up and shut down the server so you can save on server costs.

This is set up to run on Heroku. You must include your Vultr API key in the Heroku configuration.

Start with a Vultr snapshot of your Minecraft server named 'minecraft AUTO 2000' and I forgot to make the IP configurable oops, you'll have to change that, it's pretty raw all around really

TODO:

* schedule start up and shut down
* Run it as Amazon Lambda functions instead of a heroku server
* Nicer UI
