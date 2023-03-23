const yargs = require('yargs');
const SlackNotification = require('avn-strn');
const dotenv = require('dotenv');

let argv = yargs.alias('c', 'gateway').argv;

dotenv.config();
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || '';

const slack = new SlackNotification(slackWebhookUrl);

slack.sendReportNotification('../../finalReport.json', 'Gateway', argv.gateway);
