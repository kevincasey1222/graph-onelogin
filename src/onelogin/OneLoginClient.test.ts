import {
  createMockIntegrationLogger,
  Recording,
} from '@jupiterone/integration-sdk-testing';

import { integrationConfig } from '../../test/config';
import { setupOneloginRecording } from '../../test/recording';
import OneLoginClient from './OneLoginClient';

let recording: Recording;

afterEach(async () => {
  if (recording) {
    await recording.stop();
  }
});

describe('fetchUsers', () => {
  test('success', async () => {
    recording = setupOneloginRecording({
      directory: __dirname,
      name: 'fetchUsers',
      options: {
        matchRequestsBy: {
          body: false,
        },
      },
    });

    // We need to short circuit Date.now() to a time prior to
    // the expiration of any recorded token responses, otherwise
    // we'll constantly have to re-record to get our tests to
    // pass
    jest
      .spyOn(global.Date, 'now')
      .mockImplementation(() => new Date('2018-01-01T11:00:00.000Z').valueOf());

    const client = new OneLoginClient(
      integrationConfig.clientId,
      integrationConfig.clientSecret,
      createMockIntegrationLogger(),
    );
    await client.authenticate();

    const users = await client.fetchUsers();
    expect(users.length).toBeGreaterThan(0);
  });
});

describe('try to authen with bad credens', () => {
  test('success', async () => {
    recording = setupOneloginRecording({
      directory: __dirname,
      name: 'badCredens',
      options: {
        recordFailedRequests: true,
        matchRequestsBy: {
          body: false,
        },
      },
    });

    const client = new OneLoginClient(
      integrationConfig.clientId,
      integrationConfig.clientSecret,
      createMockIntegrationLogger(),
    );
    //await client.authenticate();
    //since we skipped the authen, we should have no token and throw a 401
    await expect(client.fetchUsers()).rejects.toThrow();
  });
});
