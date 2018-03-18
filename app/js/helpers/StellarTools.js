import { Asset, FederationServer, StrKey, Keypair } from 'stellar-sdk';
import Decimal from 'decimal.js';

import { map } from 'lodash';

export const STROOP = 0.0000001;
export const REFRESH_INTERVAL = 2000;

export const validPk = pk => StrKey.isValidEd25519PublicKey(pk);
export const validSeed = seed => StrKey.isValidEd25519SecretSeed(seed);

export const resolveAddress = address =>
  FederationServer.resolve(address);
export const validDestination = address =>
  resolveAddress(address).then(() => true).catch(() => false);

export const AssetInstance = (asset) => {
  if (!asset) return null;
  if (asset instanceof Asset) {
    return asset;
  }
  if (asset.asset_type === 'native') {
    return Asset.native();
  }
  return new Asset(asset.asset_code, asset.asset_issuer);
};

export const AssetUid = (rawAsset) => {
  const asset = AssetInstance(rawAsset);

  if (asset.isNative()) {
    return 'native';
  }
  let str = 'custom:';
  str += asset.getCode();
  str += ':';
  str += asset.getIssuer();
  return str;
};

export const KeypairInstance = (keypair) => {
  if (keypair instanceof Keypair) {
    return keypair;
  }
  if (keypair.secretSeed) {
    return Keypair.fromSecret(keypair.secretSeed);
  }
  return Keypair.fromPublicKey(keypair.publicKey);
};

export const AmountInstance = (number) => {
  const decimal = new Decimal(number);
  return decimal.toString();
};

export const augmentAccount = account => ({
  ...account,
  balances: account.balances.map(b => ({
    ...b,
    asset: AssetInstance(b),
  })),
});

export const areSameAssets = (a1, a2) => {
  try {
    const as1 = AssetInstance(a1);
    const as2 = AssetInstance(a2);

    if (as1 === as2 === null) {
      return true;
    } else if (!as1 || !as2) {
      return false;
    }
    return as1.equals(as2);
  } catch (e) {
    return false;
  }
};

export const pageWidth = () => {
  return window.innerWidth > 767;
};

export const getHeaderCells = (cells) => {
  const cellsArr = map(cells, cell => ({
    value: cell,
    text: cell,
  }));
  cellsArr.shift();
  return cellsArr;
};
