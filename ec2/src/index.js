'use strict'
const config = require('multiconfig').load()
const avn = require('./avn')
const express = require('express')
const log4js = require('log4js')

log4js.configure(config.log4Js)
const log = log4js.getLogger()

const app = express()
const port = config.portNumber

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
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
    const result = await avn.poll(req.body.requestId)
    res.send(result)
  } catch (err) {
    next(err)
  }
})

app.listen(port, () => {
  log.info(`EC2 avn-connector listening on port ${port}`)
})

avn.instantiateEC2()
