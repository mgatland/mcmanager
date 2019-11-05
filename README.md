### Minecraft server manager

So you want to run a Minecraft server for you and a few friends.

Here are some features you might want:

* You can turn off the server when no-one is playing, and it stops costing you money
* Any of your friends can stop and start the server, not only you.
* It automatically turns off if no-one is playing (to save money)
* When the server is off, the world is stored in your Dropbox account. When the server starts up, it copies it from there.

OK! Now the bad news is that you're going to need to make a whole lot of accounts on different websites.

We're going to use:
* Vultr: affordable pay-by-the-minute hosting
* Dropbox: free online storage
* Heroku: free hosting for our admin tools
* A cron service for scheduled shutdowns

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

Install Dropbox if you haven't already.

In your dropbox folder, create a new folder called _minecraft-server_

In _minecraft-server_, copy the file minecraft.service from this repository

Edit minecraft.service: On the line that has `-Xmx15000M -Xms15000M`, replace both instances of 15000 with the amount of RAM you want to allocate to Minecraft. This should be about 300 Megabytes less than the total RAM on your server.

In the minecraft-server folder, create another folder named 'game'

Inside this folder is your actual Minecraft server. If you already have a Minecraft server folder, copy its contents into here. Make sure the server file is named server.jar

If this is a brand new server, download server.jar from the official minecraft website and place it in this folder. You also have to create a text file called eula.txt and make its contents `eula=true` to signify that you agree to the Minecraft licence agreement. All other files will be generated when you first run the server.

### Step 3

Create a Vultr account.

In Vultr, create a new Startup Script. name it `minecraft v1` (exactly like that). Copy in the example startup script from this repository.

Look at the first few lines of the script.

* You must change the password to a secure password (make it long and random)
* You must insert the dropbox token that you saved earlier
* You don't need to change the dropboxFolder, unless you move your Minecraft server files somewhere else in your Dropbox.

Save the script.

### Step 4

In Vultr, create a new Reserved IP. This will cost you $5 USD per month.

(This makes it easier for everyone to join the server because the IP is always the same. I might change to a cheaper system later.)

Write down what your reserved IP address is, you will need it.

### Step 5

Create a GitHub account. Fork this repository.

Create a Heroku account. 

In Heroku, create a new free Dyno. Give it a cool name.

Under Settings, set these environment variables:

* reservedIp: your Vultr reserved IP address
* minecraftSshPassword: the secure password you chose in step 3 above.
* vultrKey: go to vultr.com, click on your name in the top right, choose API, create a personal access token, then put it in here.
* You don't need to set *dropboxFolder*, unless you move your Minecraft server files somewhere else in your Dropbox.

Go into Deploy and connect it to GitHub. Make it deploy from your fork of this repository. Find the 'Deploy Branch' button to deploy it now.

### Step 6

You can now visit your heroku app in a web browser (click 'Open App' in the very top right of the Heroku dashboard to get the link)

From here, you and your friends can start and stop the server.

If someone is playing you will not be able to stop the server until they log off.

### Step 7

Set up automatic shutdowns. Our free Heroku server turns off when not in use, so it cannot run scheduled tasks. We need another service.

Sign up to cron-job.org

Create a new cron job that goes to https://your-heroku-dyno-name.herokuapp.com/shutdown (put in your actual Heroku app URL!) and change it to a POST request. Schedule it to run every hour, or however often you like.

If no-one is online when the script is activated, it will shut down the server.

### Step 8

Open Minecraft. Go to the multiplayer menu and add a new server. Paste in your reserved IP address.

You are ready to go!

### Notes and warnings

If you shut down the server then try to start it up again straight away, it might not work. Try again in a few minutes.

# Things to fix

must do:
* (all done!)

should do:
* add in a safety check so you can't wipe your dropbox by setting a bad dropboxFolder
* another possible data loss situation: if you shut down the server while it's starting up
(Although in both of these cases, you can use Dropbox Rewind to recover the lost data)

could do:
* Heroku: make the Vultr server type configurable instead of always 16GB of RAM
* add automatic backups
* I could make it work without a reserved IP - the admin tool could tell you the current IP of the server
* add some kind of security to the heroku server?
* Heroku could create the startup script for you, so you don't have to set it up separately
* Heroku could also create minecraft.service. That way, all the configuration is in one place
* Instead of using a cron service for shutdowns, install a service on the minecraft server that does that job. This will simplify setup, and make the system use fewer of your Heroku minutes

super deluxe:
* The Heroku control panel could spoof the Minecraft server protocol. We could make it so the when the server is off, it still appears in the Minecraft server browser and when you try to join, the server starts up!
