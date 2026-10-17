# Phase 1: Deploy the website to Vercel

## Run it locally first
```bash
cd client
npm ci
npm run dev:demo      # opens http://localhost:3000, no backend needed
```
Production build check (this is exactly what Vercel runs):
```bash
npm run build && npm run preview
```

## Deploy
1. Push the repo to GitHub.
2. vercel.com -> Add New -> Project -> import the repo.
3. Set **Root Directory** to `client`. Framework is detected as Vite.
4. Deploy. No environment variables are needed (`client/.env.production` turns on demo mode).

## Optional: real bounding boxes in the demo
```bash
python scripts/export_demo_results.py   # runs models/best.pt on the 23 sample images
git add -A && git commit -m "Add real demo detections" && git push
```

## Switching to the real backend later (Phase 2)
In Vercel -> Settings -> Environment Variables:
`VITE_DEMO_MODE=false` and `VITE_API_BASE_URL=https://<your-api-host>`, then redeploy.
