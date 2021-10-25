'use strict'
const config = require('multiconfig').load()
const avn = require('./avn')
const redis = require('./redis')
const txStatusPoller = require('./txStatusPoller')
const express = require('express')
const log4js = require('log4js')


log4js.configure(config.log4Js)
const log = log4js.getLogger()

const app = express()
const port = config.portNumber

app.use(express.urlencoded({ extended: true }))
app.use(express.json({limit: '50mb'}))
app.use(function(err, req, res, _next) {
  log.error(`Error processing request: ${req}, \nStack: ${err.stack}`)
  res.status(500).send('Error processing request')
})

app.post('/avnQuery', async (req, res, next) => {
  try {
    log.trace(`request body: ${JSON.stringify(req.body)}`)
    const result = await avn.query(req.body.palletName, req.body.storageName, req.body.params)
    res.send(JSON.stringify(result.toJSON()))
  } catch (err) {
    next(err)
  }
})

app.post('/avnTx', async (req, res, next) => {
  try {
    log.trace(`request body: ${JSON.stringify(req.body)}`)
    const result = await avn.tx(req.body.palletName, req.body.method, req.body.params)
    log.info(`Request sent with ID: ${result.requestId}`)
    res.send(result)
  } catch (err) {
    next(err)
  }
})

app.post('/avnProxy', async (req, res, next) => {
  try {
    log.trace(`request body: ${JSON.stringify(req.body)}`)
    const result = await avn.proxy(req.body.palletName, req.body.method, req.body.params)
    log.info(`Proxy request sent with ID: ${result.requestId}`)
    res.send(result)
  } catch (err) {
    next(err)
  }
})

app.post('/avnPoll', async (req, res, next) => {
  try {
    log.trace(`request body: ${JSON.stringify(req.body)}`)
    // the await is removed on purpose here
    txStatusPoller.resolvePendingTransactionsState()

    const result = await avn.poll(req.body.requestId)
    res.send(result)
  } catch (err) {
    next(err)
  }
})

app.get('/pendingTransactions', async (req, res, next) => {
  try {
    log.trace('pendingTransactions invoked')
    const result = await redis.getNextTransactionsToCheck()
    res.send(result)
  } catch (err) {
    next(err)
  }
})

app.post('/resolvePendingTransactions', async (req, res, next) => {
  try {
    log.trace(`request properties: ${Object.keys(req.body)}`)
    const result = await redis.resolvePendingAvnTransactions(req.body.transactions)
    res.send(result)
  } catch (err) {
    next(err)
  }
})

app.listen(port, () => {
  log.info(`EC2 avn-connector listening on port ${port}`)
})

async function instantiateEC2() {
  await avn.connectToAvN()
  await redis.connect()
}

instantiateEC2()
