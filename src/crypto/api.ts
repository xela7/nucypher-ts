import sha3 from 'js-sha3';
import { PublicKey, Signature } from 'umbral-pre';

import { fromHexString, toBytes } from '../utils';

export const verifySignature = (
  signature: Uint8Array | Signature,
  message: Uint8Array | string,
  verifyingKey: PublicKey
): boolean => {
  const sig =
    signature instanceof Uint8Array
      ? Signature.fromBytes(signature)
      : signature;
  const msg = message instanceof Uint8Array ? message : toBytes(message);
  return sig.verify(verifyingKey, msg);
};

export const keccakDigest = (m: Uint8Array): Uint8Array =>
  fromHexString(sha3.keccak_256(m)).slice(0, 32);