# Agent notes

## Production hosting

**Production is AWS EC2 only** (Next.js app via PM2). Domains go through Cloudflare DNS to EC2.

Do **not** deploy to Netlify or Vercel. Do not use Netlify Functions, Vercel Cron, or Netlify/Vercel CLIs for this project.

### How to deploy

1. Commit backend/web changes and push to `main`
2. GitHub Actions workflow `.github/workflows/deploy-ec2.yml` SSHs to EC2 and runs `scripts/deploy-ec2.sh`
3. If Actions is unavailable, the EC2 poll timer (`scripts/systemd/upaharo-deploy-poll.timer`) pulls `main` and rebuilds

See `.cursor/rules/production-ec2.mdc` for the always-on rule.
