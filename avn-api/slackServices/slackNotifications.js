const yargs = require('yargs');
const SlackNotification = require('strn-avt');

let argv = yargs
  .usage('Run baseStateGenerator using a given Gateway environment')
  .help('h')
  .alias('h', 'help')
  .demandOption('c')
  .describe('c', 'Configuration file with gateway parameters')
  .string('c')
  .alias('c', 'gateway')
  .argv;

dotenv.config();
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || '';

const slack = new SlackNotification(slackWebhookUrl);

slack.sendReportNotification('../../finalReport.json', argv.gateway);