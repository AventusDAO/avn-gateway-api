const utils = require('/opt/utils.js');
const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

exports.handler = async _ => {
  try {
    const response = await utils.axios.get(AVN_CONNECTOR_ENDPOINT + 'autolower');
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
};