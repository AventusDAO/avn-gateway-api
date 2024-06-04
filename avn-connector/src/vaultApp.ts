import axios from 'axios';
import logger from './logger';

// TODO - Check with Admin Portal version and align

async function post(url: string, data: any, token?: string): Promise<any> {
  const tokenReq = typeof token === 'undefined';
  const headers: { [key: string]: string } = { 'Content-Type': 'application/json' };

  if (!tokenReq) {
    headers['X-Vault-Request'] = 'true';
    headers['X-Vault-Token'] = token!;
  }

  try {
    const res = await axios({ method: 'post', url, data, headers });
    return tokenReq ? res.data.auth.client_token : res.data.data;
  } catch (err: any) {
    if (err.response) throw new Error('vault - ' + err.response.data.errors.toString());
    else throw new Error('vault - cannot connect to ' + url);
  }
}

async function get(url: string, token: string): Promise<any> {
  const headers = { 'X-Vault-Token': token };

  try {
    return (await axios({ method: 'get', url, headers })).data.data;
  } catch (err: any) {
    logger.info(`vault error on GET: `, err);
    if (err.response) {
      if (err.response.status === 404 || err.response.data.errors[0].includes('Error reading user')) return '';
      else throw new Error('vault - ' + err.response.data.errors.toString());
    } else throw new Error('vault - cannot connect to ' + url);
  }
}

async function appLogin(baseURL: string, roleId: string, secretId: string): Promise<string> {
  const url = `${baseURL}auth/approle/login`;
  const data = { role_id: roleId, secret_id: secretId };
  const token = await post(url, data);
  return token;
}

class Vault {
  private loginToken: { token?: string; validUntil?: number } = {};
  private readonly baseURL: string;
  private readonly ROLE_ID: string;
  private readonly SECRET_ID: string;
  private readonly EXPIRY: number = 1000 * 60 * 10; //10 min

  constructor(baseURL: string, roleId: string, secretId: string) {
    this.baseURL = baseURL;
    this.ROLE_ID = roleId;
    this.SECRET_ID = secretId;
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (!this.loginToken.token || this.loginToken.validUntil! < now) {
      logger.info(`login token has expired on ${this.loginToken.validUntil}. Refreshing...`);
      const token = await appLogin(this.baseURL, this.ROLE_ID, this.SECRET_ID);
      this.loginToken.token = token;
      this.loginToken.validUntil = now + this.EXPIRY;
    }

    return this.loginToken.token;
  }

  async createNewRelayer(userName: string): Promise<string> {
    const token = await this.getToken();
    const userUrl = `${this.baseURL}avn-vault/user/${userName}`;
    const res = await get(userUrl, token);
    if (res === '') {
      return (await post(userUrl, { name: userName }, token)).publicKey;
    } else return res.publicKey;
  }

  async setNewRelayer(userName: string, seed: string): Promise<string> {
    const token = await this.getToken();
    const userUrl = `${this.baseURL}avn-vault/user/set/${userName}`;
    const res = await get(userUrl, token);
    if (res === '') {
      const data = { name: userName, seed: seed };
      return (await post(userUrl, data, token)).publicKey;
    } else return res.publicKey;
  }

  async getRelayerSeed(userName: string): Promise<string> {
    const token = await this.getToken();
    const url = `${this.baseURL}avn-vault/user/${userName}`;
    const relayer = await get(url, token);
    return relayer.seed;
  }

  async payerSign(message: string, username: string): Promise<any> {
    const token = await this.getToken();
    const res = await get(`${this.baseURL}avn-vault/user/${username}`, token);
    if (res === '') {
      throw new Error(`User ${username} does not exist in vault`);
    }

    const url = `${this.baseURL}avn-vault/user/${username}/sign`;
    const data = { name: username, message };
    return await post(url, data, token);
  }
}

export default Vault;
