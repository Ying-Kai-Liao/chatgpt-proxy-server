# ChatGPT Proxy Server

A proxy server for accessing ChatGPT's shared conversation API, built with Express.js and Puppeteer.

## Features

- Bypasses Cloudflare protection
- Handles browser automation with Puppeteer
- Supports serverless deployment on Vercel
- CORS enabled
- Health check endpoint

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```bash
PORT=3001
```

3. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Get Shared Conversation
```
GET /api/chatgpt/:shareId
```

### Health Check
```
GET /health
```

## Deployment to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

For production deployment:
```bash
vercel --prod
```

## Environment Variables

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment ('development' or 'production')

## Notes

- The server uses Puppeteer to handle browser automation
- In production, the server runs in serverless mode on Vercel
- Browser instances are managed automatically
- Cloudflare challenges are handled automatically

## License

ISC
