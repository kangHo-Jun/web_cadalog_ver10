---
description: Initialize the Cafe24 Web Catalog project
---

# Project Initialization Workflow

This workflow initializes the Cafe24 Web Catalog project for development.

## Prerequisites
- Node.js v18+ installed
- npm or yarn package manager
- Cafe24 API credentials (stored in `.env.local`)

## Steps

// turbo-all
1. **Install Dependencies**
   ```bash
   npm install
   ```
   Installs all required packages from `package.json`.

2. **Verify Environment Variables**
   Check that `.env.local` contains:
   - `MALL_ID`
   - `CAFE24_ACCESS_TOKEN`
   - `CAFE24_CLIENT_ID`
   - `CAFE24_CLIENT_SECRET`
   - `CAFE24_REFRESH_TOKEN`
   - `NEXT_PUBLIC_MALL_ID`

3. **Test Token Validity**
   ```bash
   node test-api.js
   ```
   Verifies that the Cafe24 API token is valid and can fetch products.

4. **Start Development Server**
   ```bash
   npm run dev
   ```
   Launches the Next.js development server on http://localhost:3000

5. **Verify Application**
   - Open browser to http://localhost:3000
   - Check that products load correctly
   - Test search functionality
   - Test product quantity controls

## Troubleshooting

### Token Expired
If you get authentication errors, refresh the token:
```bash
node test-refresh.js
```

### Missing Dependencies
If modules are missing:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Port Already in Use
If port 3000 is busy:
```bash
npm run dev -- -p 3001
```
