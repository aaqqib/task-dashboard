# Focus Dashboard 🎯

A premium, personal task dashboard with built-in **Telegram Bot integration** to capture, organize, and track tasks from your phone. 

Features a gorgeous dark-mode slate UI with glassmorphic elements, inline task editing, and local storage (fallback) or cloud storage (Vercel KV) support.

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
Run this in the project root:
```bash
npm install
```

### 2. Run the App
Start both the Vite dev frontend and the Express backend concurrently:
```bash
npm run dev
```
Open your browser to [http://localhost:5173](http://localhost:5173). The backend API is proxied on port `3000`.

---

## 🤖 Telegram Bot Integration Setup

### 1. Create a Bot
1. Search for [@BotFather](https://t.me/BotFather) on Telegram and open a chat.
2. Send `/newbot` and follow the prompts (give it a name and a username).
3. Copy the **HTTP API Token** provided (looks like `123456789:ABCdef...`).

### 2. Connect the Bot
1. Open the dashboard in your browser and click the **Settings ⚙️** button in the header.
2. Paste your token in the **Bot Token** field and click **Save Changes**.

### 3. Authorize Your Chat ID (Secure Pairing)
1. Search for your newly created bot on Telegram and send it a message `/start`.
2. The bot will automatically reply with a message containing your private **Chat ID** (e.g. `987654321`).
3. Copy this Chat ID, paste it into the **Authorized Chat ID** field in the dashboard settings, and click **Save Changes**.
4. Now, the bot is locked down and will only accept tasks sent by you!

---

## 💬 Telegram Bot Commands

Use these commands directly from your Telegram app:
- **`Just send raw text`** (e.g., `Buy groceries`) $\rightarrow$ Instantly adds the task to your **Inbox** 📥.
- **`/today <task>`** $\rightarrow$ Adds the task to **Today** 📅.
- **`/week <task>`** $\rightarrow$ Adds the task to **This Week** 📆.
- **`/later <task>`** $\rightarrow$ Adds the task to **Later** ⏳.
- **`/list`** $\rightarrow$ Lists all active tasks grouped by columns with numbers.
- **`/done <number>`** $\rightarrow$ Completes the task matching that number.

---

## ☁️ Deploying to Vercel (Production)

Deploy the dashboard to Vercel to access it from anywhere in the world:

### 1. Push to GitHub
If you haven't linked your repository, run these commands in your local directory:
```bash
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git branch -M main
git push -u origin main
```

### 2. Import to Vercel
1. Go to [vercel.com/import](https://vercel.com/import) and log in.
2. Select your `task-dashboard` repository.

### 3. Add Vercel KV Database (For Cloud Storage)
*Because Vercel Serverless functions are ephemeral, storing tasks in a local `db.json` file will reset every few minutes. We need to attach a KV database to save tasks persistently:*

1. In your Vercel Project Dashboard, navigate to the **Storage** tab.
2. Select **KV** and click **Create**.
3. Choose a name and region, then click **Create**.
4. Under the **Connect** tab in your database, choose your `task-dashboard` project and click **Connect**. This will automatically inject the `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables into your project!

### 4. Deploy and Setup Webhook
1. Click **Deploy** on Vercel.
2. Once deployed, open your live dashboard URL in your browser.
3. Open **Settings ⚙️**, click **Auto-Fill URL** (it will detect your Vercel URL), and click **Deploy Webhook Link**.
4. That's it! Your Telegram bot is now connected to Vercel via Webhook. You can add tasks on the go from your phone and view them on your live website.
