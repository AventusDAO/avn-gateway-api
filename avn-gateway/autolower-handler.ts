import { axios } from '/opt/utils'
// @ts-ignore
import { Handler } from 'aws-lambda'

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

export const handler: Handler = async (_): Promise<void> => {
  try {
    const response = await axios.get(AVN_CONNECTOR_ENDPOINT + 'autolower');
    return console.log(response.data);
  } catch (error) {
    return console.error(error);
  }
};
