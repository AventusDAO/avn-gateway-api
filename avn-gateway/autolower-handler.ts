import * as utils from '/opt/utils'
import { Handler } from 'aws-lambda'

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

export const handler: Handler = async (_): Promise<void> => {
  try {
    const response = await utils.axios.get(AVN_CONNECTOR_ENDPOINT + 'autolower');
    return console.log(response.data);
  } catch (error) {
    return console.error(error);
  }
};
