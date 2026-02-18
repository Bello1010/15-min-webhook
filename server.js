// server.js
const express = require('express');
const fs = require('fs');
const fetch = require('node-fetch');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET || '4f9d7b2a-6c1e-4d3f-b8e1-9a2f7c5e8b20';
const EXECUTE_WEBHOOK = process.env.EXECUTE_WEBHOOK || '';
const FINALIZE_DELAY = parseInt(process.env.FINALIZE_DELAY_MS || '8000', 10);
const PRED_CSV = process.env.PRED_CSV || 'predictions.csv';

const app = express();
app.use(express.json());

const store = new Map();
let lastPredictions = [];

function appendCsvLine(line) {
  fs.appendFileSync(PRED_CSV, line + '\n');
}

app.post('/webhook', (req, res) => {
  const body = req.body;
  if (!body || body.secret !== SECRET) return res.status(401).send('bad secret');
  const bar = body.bar_time;
  if (!bar) return res.status(400).send('missing bar_time');
  const entry = store.get(bar) || { signals: [], timer: null };
  entry.signals.push(body);
  if (!entry.timer) {
    entry.timer = setTimeout(() => finalizeBar(bar), FINALIZE_DELAY);
  }
  store.set(bar, entry);
  res.send('ok');
});

async function finalizeBar(bar) {
  const entry = store.get(bar);
  if (!entry) return;
  const sigs = entry.signals;
  const soSignals = sigs.filter(s => s.source === 'S&O');
  let final = null;

  if (soSignals.length > 0) {
    const longs = soSignals.filter(s => s.pred === 'green').length;
    const shorts = soSignals.filter(s => s.pred === 'red').length;
    if (longs > 0 && shorts > 0) {
      final = { dropped: true, reason: 'S&O conflict', bar };
    } else {
      final = { dropped: false, pred: longs > 0 ? 'green' : 'red', source: 'S&O', bar };
    }
  } else {
    const hw = sigs.find(s => s.source === 'HyperWave');
    if (hw) final = { dropped: false, pred: hw.pred, source: 'HyperWave', bar };
    else final = { dropped: true, reason: 'no signal', bar };
  }

  if (!final.dropped) {
    const executeAt = new Date(bar).getTime() + 15 * 60 * 1000;
    const payload = {
      symbol: sigs[0].symbol,
      tf: sigs[0].tf,
      bar_time: bar,
      pred: final.pred,
      source: final.source,
      execute_at: new Date(executeAt).toISOString(),
      signals: sigs
    };

    if (EXECUTE_WEBHOOK) {
      try {
        await fetch(EXECUTE_WEBHOOK, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error('exec post failed', err);
      }
    }

    const line = `${payload.bar_time},${payload.pred},${payload.source},${payload.execute_at}`;
    appendCsvLine(line);

    lastPredictions.unshift(payload);
    if (lastPredictions.length > 200) lastPredictions.pop();
  } else {
    const line = `${bar},DROPPED,${final.reason},`;
    appendCsvLine(line);
  }

  store.delete(bar);
}

app.get('/latest', (req, res) => {
  res.json({ last: lastPredictions.slice(0, 50) });
});

app.listen(PORT, () => {
  console.log(`listening ${PORT}`);
});
