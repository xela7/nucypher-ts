import { Block, Provider } from '@ethersproject/providers';
import axios from 'axios';
import { Capsule, CapsuleWithFrags, reencrypt, VerifiedCapsuleFrag, VerifiedKeyFrag } from 'umbral-pre';

import { Alice, Bob, NucypherKeyring } from '../src';
import { StakingEscrowAgent } from '../src/agents/staking-escrow';
import { GetUrsulasResponse, Porter, Ursula } from '../src/characters/porter';
import { RetrievalResult } from '../src/kits/retrieval';
import { TreasureMap } from '../src/policies/collections';
import { HRAC } from '../src/policies/hrac';
import { BlockchainPolicy } from '../src/policies/policy';
import { ChecksumAddress, Configuration } from '../src/types';
import { toBytes, zip } from '../src/utils';

export const mockConfig: Configuration = {
  porterUri: 'https://_this_should_crash.com/',
};

export const mockBob = (): Bob => {
  const bobKeyringSeed = toBytes('fake-keyring-seed-32-bytes-bob-x');
  const bobKeyring = new NucypherKeyring(bobKeyringSeed);
  return Bob.fromKeyring(mockConfig, bobKeyring);
};

export const mockRemoteBob = (): Bob => {
  const bob = mockBob();
  return Bob.fromPublicKeys(
    mockConfig,
    bob.verifyingKey,
    bob.decryptingKey,
  );
};

export const mockAlice = () => {
  const aliceKeyringSeed = toBytes('fake-keyring-seed-32-bytes-alice');
  const aliceKeyring = new NucypherKeyring(aliceKeyringSeed);
  const alice = Alice.fromKeyring(mockConfig, aliceKeyring);
  const provider = mockWeb3Provider();
  alice.transactingPower.connect(provider as Provider);
  return alice;
};

export const mockWeb3Provider = (
  blockNumber?: number,
  blockTimestamp?: number,
): Partial<Provider> => {
  const block = { timestamp: blockTimestamp ?? 1000 };
  return {
    getBlockNumber: () => Promise.resolve(blockNumber ?? 1000),
    getBlock: () => Promise.resolve(block as Block),
    _isProvider: true,
    getNetwork: () => Promise.resolve({ name: 'mock', chainId: -1 }),
  };
};

export const mockUrsulas = (): Ursula[] => {
  return [
    {
      encryptingKey:
        '025a335eca37edce8191d43c156e7bc6b451b21e5258759966bbfe0e6ce44543cb',
      checksumAddress: '0x5cF1703A1c99A4b42Eb056535840e93118177232',
      uri: 'https://example.a.com:9151',
    },
    {
      encryptingKey:
        '02b0a0099ee180b531b4937bd7446972296447b2479ca6259cb6357ed98b90da3a',
      checksumAddress: '0x7fff551249D223f723557a96a0e1a469C79cC934',
      uri: 'https://example.b.com:9151',
    },
    {
      encryptingKey:
        '02761c765e2f101df39a5f680f3943d0d993ef9576de8a3e0e5fbc040d6f8c15a5',
      checksumAddress: '0x9C7C824239D3159327024459Ad69bB215859Bd25',
      uri: 'https://example.c.com:9151',
    },
    {
      encryptingKey:
        '0258b7c79fe73f3499de91dd5a5341387184035d0555b10e6ac762d211a39684c0',
      checksumAddress: '0x9919C9f5CbBAA42CB3bEA153E14E16F85fEA5b5D',
      uri: 'https://example.d.com:9151',
    },
    {
      encryptingKey:
        '02e43a623c24db4f62565f82b6081044c1968277edfdca494a81c8fd0826e0adf6',
      checksumAddress: '0xfBeb3368735B3F0A65d1F1E02bf1d188bb5F5BE6',
      uri: 'https://example.e.com:9151',
    },
  ].map(({ encryptingKey, checksumAddress, uri }) => {
    return {
      checksumAddress: checksumAddress.toLowerCase(),
      encryptingKey: encryptingKey.toLowerCase(),
      uri,
    };
  });
};

export const mockPorterUrsulas = (
  mockUrsulas: Ursula[],
): GetUrsulasResponse => {
  return {
    result: {
      ursulas: mockUrsulas.map((u) => ({
        encrypting_key: u.encryptingKey,
        uri: u.uri,
        checksum_address: u.checksumAddress,
      })),
    },
    version: '5.2.0',
  };
};

export const mockGetUrsulasOnce = (ursulas: Ursula[]) => {
  return jest.spyOn(axios, 'get').mockImplementationOnce(async () => {
    return Promise.resolve({ data: mockPorterUrsulas(ursulas) });
  });
};

export const mockPublishToBlockchain = () => {
  return jest
    .spyOn(BlockchainPolicy.prototype, 'publishToBlockchain')
    .mockImplementation(async () => {
      return '0x';
    });
};

export const mockRetrieveResults = (
  ursulas: ChecksumAddress[],
  verifiedKFrags: VerifiedKeyFrag[],
  capsule: Capsule,
): RetrievalResult[] => {
  if (ursulas.length !== verifiedKFrags.length) {
    throw new Error(
      'Number of verifiedKFrags must match the number of Ursulas',
    );
  }
  const reencrypted = verifiedKFrags.map((kFrag) => reencrypt(capsule, kFrag));
  const results = Object.fromEntries(zip(ursulas, reencrypted));
  return [ new RetrievalResult(results) ];
};

export const mockRetrieveCFragsRequest = (
  ursulas: ChecksumAddress[],
  verifiedKFrags: VerifiedKeyFrag[],
  capsule: Capsule,
) => {
  const results = mockRetrieveResults(ursulas, verifiedKFrags, capsule);
  return jest
    .spyOn(Porter.prototype, 'retrieveCFrags')
    .mockImplementation(() => {
      return Promise.resolve(results);
    });
};

export const mockGenerateKFrags = () => {
  return jest.spyOn(Alice.prototype as any, 'generateKFrags');
};

export const mockEncryptTreasureMap = () => {
  return jest.spyOn(BlockchainPolicy.prototype as any, 'encryptTreasureMap');
};

export const reencryptKFrags = (
  kFrags: VerifiedKeyFrag[],
  capsule: Capsule,
): { capsuleWithFrags: CapsuleWithFrags, verifiedCFrags: VerifiedCapsuleFrag[] } => {
  if (!kFrags) {
    throw new Error('Pass at least one kFrag.');
  }
  let capsuleWithFrags: CapsuleWithFrags;
  const verifiedCFrags = kFrags.map((kFrag) => {
    const cFrag = reencrypt(capsule, kFrag);
    capsuleWithFrags = capsuleWithFrags
      ? capsuleWithFrags.withCFrag(cFrag)
      : capsule.withCFrag(cFrag);
    return cFrag;
  });
  return { capsuleWithFrags: capsuleWithFrags!, verifiedCFrags };
};

export const mockStakingEscrow = (
  currentPeriod = 100,
  secondsPerPeriod = 60,
) => {
  jest
    .spyOn(StakingEscrowAgent, 'getCurrentPeriod')
    .mockImplementation(async () => Promise.resolve(currentPeriod));
  jest
    .spyOn(StakingEscrowAgent, 'getSecondsPerPeriod')
    .mockImplementation(async () => Promise.resolve(secondsPerPeriod));
};

export const mockTreasureMap = async () => {
  const alice = mockAlice();
  const bob = mockBob();
  const label = 'fake-label';
  const threshold = 2;
  const shares = 3;
  const { verifiedKFrags } = await (alice as any).generateKFrags(
    bob,
    label,
    threshold,
    shares,
  );
  const hrac = HRAC.derive(
    alice.verifyingKey.toBytes(),
    bob.verifyingKey.toBytes(),
    label,
  );
  const ursulas = mockUrsulas().slice(0, shares);
  return TreasureMap.constructByPublisher(
    hrac,
    alice,
    ursulas,
    verifiedKFrags,
    threshold,
  );
};

export const mockConstructTreasureMap = () => {
  return jest.spyOn(TreasureMap, 'constructByPublisher');
};