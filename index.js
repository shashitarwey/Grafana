const express = require("express");
const responseTime = require('response-time');
const client = require('prom-client'); // This is for metrics collection
const doSomeHeavyTask = require("./utils");

const { createLogger, transports } = require("winston");
const LokiTransport = require("winston-loki");


const options = {
  transports: [
    new LokiTransport({
      host: "http://127.0.0.1:3100"
    })
  ]
};

const logger = createLogger(options);

const app = express();
const PORT = process.env.PORT || 9000;

const collectMetrics = client.collectDefaultMetrics;

collectMetrics({ register: client.register })

const reqResTime = new client.Histogram({
    name: 'http_express_server_req_res_time',
    help: 'This tells how much time is taken by req and res',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [1, 50, 100, 200, 400, 500, 800, 1000, 2000]
})

const totalRequestCounter = new client.Counter({
    name: 'total_request',
    help: 'This tells total request',
})

app.use(responseTime((req, res, time) => {
    totalRequestCounter.inc();
    reqResTime.labels({
        method: req.method,
        route: req.url,
        status_code: res.statusCode
    }).observe(time)
}))
app.get("/", (req, res) => {
    logger.info("request came on / route")
  return res.json({ message: `Hello from Express Server` });
});

app.get("/slow", async (req, res) => {
  try {
    logger.info("request came on /slow route")
    const timeTaken = await doSomeHeavyTask();
    return res.json({
      status: "success",
      message: `Heavy task completed in ${timeTaken} ms`,
    });
  } catch (error) {
    logger.error("error came on /slow route", error.message)
    return res
      .status(500)
      .json({ status: "Error", error: "Internal Server Error" });
  }
});

app.get("/metrics", async (req, res) => {
    res.setHeader('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
    res.send(metrics);
})

app.listen(PORT, () => {
  console.log(`Server is Runiing at http://localhost:${PORT}`);
});
