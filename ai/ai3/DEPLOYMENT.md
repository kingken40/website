# AI3 Chatbot Deployment Instructions

## Local Development

1. **Install Python dependencies:**
   ```bash
   cd ai/ai3
   pip install -r requirements.txt
   ```

2. **Start the Flask backend:**
   ```bash
   python app.py
   ```
   Server will run on http://127.0.0.1:5001

3. **Open the chatbot:**
   Open `ai/ai3/public/AI_v3.html` in your browser

## Vercel Deployment

### Initial Setup

1. **Push code to GitHub:**
   ```bash
   git add .
   git commit -m "Updated ai3 with backend API"
   git push origin main
   ```

2. **Configure Vercel Environment Variable:**
   - Go to https://vercel.com/dashboard
   - Select your project (website)
   - Go to **Settings** → **Environment Variables**
   - Add new variable:
     - **Name:** `OPENAI_API_KEY`
     - **Value:** Your OpenAI API key
     - **Environment:** Production, Preview, Development (select all)
   - Click **Save**

3. **Redeploy:**
   - Go to **Deployments** tab
   - Click on the three dots (...) next to the latest deployment
   - Select **Redeploy**
   - Or just push a new commit to trigger auto-deployment

### Important Notes

- The `.env` file containing your API key is **NOT** pushed to GitHub (protected by `.gitignore`)
- The API key is securely stored in Vercel's environment variables
- Frontend automatically detects environment:
  - Local: Calls `http://127.0.0.1:5001/api/chat`
  - Production: Calls `/api/chat` (handled by Vercel)

### Troubleshooting

**If the chatbot doesn't work on Vercel:**

1. Check if environment variable is set correctly in Vercel dashboard
2. Check deployment logs for errors
3. Verify `vercel.json` is in the root directory
4. Make sure `ai/ai3/app.py` and `ai/ai3/requirements.txt` are pushed to GitHub

**Testing the API endpoint:**

Local:
```bash
curl http://127.0.0.1:5001/api/chat -X POST -H "Content-Type: application/json" -d "{\"model\":\"gpt-3.5-turbo\",\"messages\":[{\"role\":\"user\",\"content\":\"test\"}]}"
```

Production:
```bash
curl https://your-vercel-url.vercel.app/api/chat -X POST -H "Content-Type: application/json" -d "{\"model\":\"gpt-3.5-turbo\",\"messages\":[{\"role\":\"user\",\"content\":\"test\"}]}"
```
