# 15-min-webhook

A Node.js webhook server for BTCUSDT 15m TradingView alerts with S&O-priority deduplication.

## Overview

This server receives TradingView webhook alerts, applies S&O-priority deduplication logic, writes predictions to `predictions.csv`, and exposes a `/latest` endpoint.

## Deploy Steps

### 1. Create Render Service

1. Go to [render.com](https://render.com) and create a new Web Service
2. Connect your GitHub repo `15-min-webhook`
3. Set environment:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

### 2. Set Environment Variables in Render

| Variable | Value |
|---|---|
| `SECRET` | `4f9d7b2a-6c1e-4d3f-b8e1-9a2f7c5e8b20` |
| `EXECUTE_WEBHOOK` | *(leave blank for CSV-only mode)* |
| `FINALIZE_DELAY_MS` | `8000` |

### 3. TradingView Alerts

Create 4 alerts on BTCUSDT 15m with Webhook URL: `https://<YOUR_RENDER_URL>/webhook`

**S&O Long:**
```json
{"symbol":"BTCUSDT","tf":"15m","pred":"green","source":"S&O","signal":"CONF_CONT_NORM","bar_time":"{{timenow}}","secret":"4f9d7b2a-6c1e-4d3f-b8e1-9a2f7c5e8b20"}
```

**S&O Short:**
```json
{"symbol":"BTCUSDT","tf":"15m","pred":"red","source":"S&O","signal":"CONF_CONT_NORM","bar_time":"{{timenow}}","secret":"4f9d7b2a-6c1e-4d3f-b8e1-9a2f7c5e8b20"}
```

**HyperWave Long (cross under 50):**
```json
{"symbol":"BTCUSDT","tf":"15m","pred":"green","source":"HyperWave","signal":"HW_cross_under_50","bar_time":"{{timenow}}","secret":"4f9d7b2a-6c1e-4d3f-b8e1-9a2f7c5e8b20"}
```

**HyperWave Short (cross over 50):**
```json
{"symbol":"BTCUSDT","tf":"15m","pred":"red","source":"HyperWave","signal":"HW_cross_over_50","bar_time":"{{timenow}}","secret":"4f9d7b2a-6c1e-4d3f-b8e1-9a2f7c5e8b20"}
```

### 4. Test

```bash
curl -X POST https://your-app.onrender.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","tf":"15m","pred":"green","source":"S&O","signal":"TEST","bar_time":"2026-02-18T03:15:00Z","secret":"4f9d7b2a-6c1e-4d3f-b8e1-9a2f7c5e8b20"}'
```

Then check: `https://your-app.onrender.com/latest`

## Endpoints

- `POST /webhook` — Receives TradingView alerts
- `GET /latest` — Returns last 50 predictions as JSON

## Logic

- **S&O signals** take priority over HyperWave
- If conflicting S&O signals arrive for the same bar → dropped
- 8-second dedup window per bar_time
- Decisions are logged to `predictions.csv` and available at `/latest`
