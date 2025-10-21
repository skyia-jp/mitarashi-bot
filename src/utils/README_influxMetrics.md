Usage: src/utils/influxMetrics.js

Import and start periodic metrics from your bot entrypoint (e.g. `src/index.js` or `src/bot/ready.js`).

Example (CommonJS):

```js
// at your bot startup
const { startBotMetrics } = require('./utils/influxMetrics');
startBotMetrics(10000); // send every 10s
```

Example (ES module):

```js
import { startBotMetrics } from './utils/influxMetrics.js';
startBotMetrics(10000);
```

Notes:
- Configure INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET via environment variables.
- The module sends a final "alive=false" metric on process exit.
- For long-running logging or debugging, you may want to increase the interval to reduce write-load.
- Do not commit real tokens to source control; use environment variables or a secret manager.
