This is unfinished, don't use it

must do:
* !! make dropbox path configurable on heroku side, make default match the path in the instructions + vultr side

should do:
* get player count directly from server, fixing that 5 minute delay

could do:
* Heroku: make the Vultr server type configurable instead of always 16GB of RAM
* add some kind of security to the heroku server?
* add automatic backups
* Heroku could create the startup script for you, so you don't have to set it up separately
* Heroku could then, via the startup script, also create minecraft.service, putting all the configuration in once place
* I could make it work without a reserved IP - the admin tool tells you what IP to use

### Minecraft server manager

So you want to

* Run a Minecraft server on Vultr
* But only run it when you're using it (Vultr charge by the minute)
* Make it easy for anyone to turn it off and on
* Automatically turn off when no players are online (so you can't accidentally leave it on all month)
* Save the world to Dropbox when the server shuts down, and load it from there on startup

We're using a lot of tools that I'm not an expert at, so this may be more complicated than it needs to be.

We're going to use:
* Vultr: affordable, powerful hosting
* Dropbox: free online storage
* Heroku: free hosting for our admin tools
* some Cron service for scheduled shutdowns

### Step 1:

* Create a Dropbox account if you don't already have one

We need to authorize rClone in Dropbox.

* Install rClone following the instructions at rclone.org
* Open a command prompt and run `rclone config`
* Choose Dropbox and follow the instructions to set up access
* Now run `rclone config file`, it will tell you where the config file is
* Find that file, grab the value of the access_token, you'll need it later.
* You can uninstall rClone now, we won't be using it on your computer

### Step 2:

In your dropbox, create a folder called minecraft-server

In that folder, copy the file minecraft.service from this repository

Edit minecraft.service: On the line that has `-Xmx15000M -Xms15000M`, replace both instances of 15000 with the amount of RAM you want to allocate to Minecraft. This should be about 300 Megabytes less than the total RAM on your server.

In the minecraft-server folder, create another folder named 'game'

Inside this folder is your actual Minecraft server. If you already have a Minecraft server folder, copy its contents into here. Make sure the server file is named server.jar

If this is a brand new server, download server.jar from the official minecraft website and place it in this folder. You also have to create a text file called eula.txt and make its contents 'eula=true' to signify that you agree to the Minecraft licence agreement. All other files will be generated when you first run the server.

### Step 3

Create a Vultr account.

In Vultr, create a new Startup Script. name it 'minecraft v1' (exactly like that). Copy in the example startup script from this repository.

Look at the first few lines of the script.

* You must change the password to a secure password
* You must insert the dropbox token that you saved earlier
* You don't need to change the dropboxFolder, unless you move your Minecraft server files somewhere else in your Dropbox.

Save the script.

### Step 4

In Vultr, create a new Reserved IP. This will cost you $5 USD per month. Whoops. I might do an update to make this optional - but for now, the code won't work without it. (You'd have to edit index.js to remove references to the reserved IP.)

Write down what your reserved IP address is, you will need it.

### Step 5

Create a Heroku account. Create a GitHub account. Fork this repository.

In Heroku, create a new free Dyno. Give it a cool name.

Under Settings, set these environment variables:

* reservedIp: your reserved IP address
* minecraftSshPassword: the password you chose in step 3 above.
* vultrKey: go to vultr.com, click on your name in the top right, choose API, create a personal access token, then put it in here.

Go into Deploy and connect it to GitHub. Make it deploy from your fork of this repository. Find the 'Deploy Branch' button to deploy it now.

### Step 6

You can now visit your heroku app in a web browser (click 'Open App' in the very top right of the Heroku dashboard to get the link)

From here, you can start and stop the server.

If someone is playing, and has been on for more than 5 minutes, you will not be able to stop the server until they log off.

### Step 7

Set up automatic shutdowns. Free Heroku servers turn off when not in use, so we need another service to do scheduled shutdowns.

Sign up to cron-job.org

Create a new cron job that goes to https://yourherokudynoname.herokuapp.com/shutdown (put in your actual dyno name!) and change it to a POST request. Schedule it to run every hour, or however often you like. The server won't shut down while people are playing - although there is a bug currently where it will if you've been playing for less than 5 minutes when it checks.

### Step 8

Open Minecraft. Go to the multiplayer menu and add a new server. Paste in your reserved IP address.

You are ready to go!
