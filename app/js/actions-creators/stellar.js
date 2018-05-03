import * as StellarOperations from '../helpers/StellarOperations';
import { newStream } from '../helpers/monoStreamer';
import { ASYNC_SEND_OPERATION, ASYNC_CREATE_TRUSTLINE, ASYNC_GET_ORDERBOOK } from '../constants/asyncActions';
import { AsyncActions } from '../helpers/asyncActions';
import { AssetInstance } from '../helpers/StellarTools';
import * as StellarServer from '../helpers/StellarServer';
import * as StellarActions from '../actions/stellar';
import * as UiActions from '../actions/ui';

import {
  getAccount as getAccountSelector,
  getAuthData,
} from '../selectors/account';
import {
  getTrustlines as getTrustlinesSelector,
} from '../selectors/stellarData';
import {
  getDestinationTrustlines as getDestinationTrustlinesSelector,
} from '../selectors/ui';

export const OPERATIONS = {
  PAYMENT: 'payment',
  PATH_PAYMENT: 'path_payment',
  ISSUE_ASSET: 'issue_asset',
  CREATE_ACCOUNT: 'create_account',
  ACCOUNT_MERGE: 'account_merge',
};

const sendOperationRedux = (transaction, dispatch) => {
  dispatch(AsyncActions.startFetch(ASYNC_SEND_OPERATION));

  return transaction
    .then((d) => {
      dispatch(AsyncActions.successFetch(ASYNC_SEND_OPERATION, d));
    })
    .catch((error) => {
      dispatch(AsyncActions.errorFetch(ASYNC_SEND_OPERATION, error));
      dispatch(UiActions.openErrorModal(error));
    });
};

export const sendPayment = paymentData => (dispatch, getState) => {
  const authData = getAuthData(getState());
  return sendOperationRedux(StellarOperations.sendPayment(paymentData, authData), dispatch);
};

export const sendPathPayment = paymentData => (dispatch, getState) => {
  const authData = getAuthData(getState());
  return sendOperationRedux(StellarOperations.sendPathPayment(paymentData, authData), dispatch);
};

export const sendIssuePayment = formData => (dispatch, getState) => {
  const authData = getAuthData(getState());
  const { accountId, asset_code, amount, destination } = formData;
  const asset = { asset_code, asset_issuer: accountId };
  const paymentData = {
    asset,
    amount,
    destination,
  };
  return sendOperationRedux(StellarOperations.sendPayment(paymentData, authData), dispatch);
};

export const sendCreateAccount = accountData => (dispatch, getState) => {
  const authData = getAuthData(getState());
  return sendOperationRedux(StellarOperations.createAccount(accountData, authData), dispatch);
};

export const sendAccountMerge = accountData => (dispatch, getState) => {
  const authData = getAuthData(getState());
  return sendOperationRedux(StellarOperations.accountMerge(accountData, authData), dispatch);
};

const changeTrust = ({ asset, limit }) => (dispatch, getState) => {
  const authData = getAuthData(getState());
  if (!authData) return Promise.reject();

  const transactionData = {
    asset,
    limit,
  };

  return StellarOperations
    .changeTrust(transactionData, authData)
    .catch((error) => {
      dispatch(UiActions.openErrorModal(error));
    });
};

export const createTrustline = asset => (dispatch) => {
  // console.log("createTrustline", asset);
    //TODO create trusline async dispatch
  dispatch(AsyncActions.startLoading(ASYNC_CREATE_TRUSTLINE));

  dispatch(changeTrust({ asset, limit: null }))
    .then(() => {
      dispatch(AsyncActions.stopLoading(ASYNC_CREATE_TRUSTLINE));
    })
    .catch((error) => {
      dispatch(UiActions.openErrorModal(error));
      dispatch(AsyncActions.stopLoading(ASYNC_CREATE_TRUSTLINE));
    });
};

export const deleteTrustline = (asset, balances) => (dispatch) => {
  dispatch(UiActions.deletingTrustline(asset, balances));

  dispatch(changeTrust({ asset, limit: 0 }))
    .catch((error) => {
      dispatch(UiActions.openErrorModal(error));
    });
};

export const createOffer = offer => (dispatch, getState) => {
  dispatch(UiActions.sendingOffer());
  const authData = getAuthData(getState());
  if (!authData) return Promise.reject();

  return StellarOperations
    .manageOffer(offer, authData)
    .then((d) => {
      dispatch(UiActions.sendOfferSuccess(d));
    })
    .catch((error) => {
      dispatch(UiActions.openErrorModal(error));
    });
};

export const deleteOffer = offer => (dispatch, getState) => {
  dispatch(UiActions.deletingOffer(offer));

  const authData = getAuthData(getState());
  if (!authData) return Promise.reject();

  const transactionData = {
    ...offer,
    amount: 0,
  };

  return StellarOperations
    .manageOffer(transactionData, authData)
    .then(() => true)
    .catch((error) => {
      dispatch(UiActions.openErrorModal(error));
    });
};

export const setOrderbook = ({ selling, buying }) => (dispatch) => {
  dispatch(AsyncActions.startFetch(ASYNC_GET_ORDERBOOK));

  // TODO move to middleware
  newStream('orderbook',
    StellarServer
      .OrderbookStream({ selling, buying }, (orderbook) => {
        dispatch(AsyncActions.successFetch(ASYNC_GET_ORDERBOOK, orderbook));
      }),
  );
  return true;
};

export const resetOrderbook = () => (dispatch) => {
    dispatch(AsyncActions.successFetch(ASYNC_GET_ORDERBOOK, null))
};

//TODO add assets to balance
export const getDestinationTrustlines = accountId => (dispatch) => {
  StellarServer.getAccount(accountId)
    .then(account => account.balances.map(balance => ({
      asset_type: balance.asset_type,
      asset_code: balance.asset_code,
      asset_issuer: balance.asset_issuer,
    })).map(AssetInstance))
    .then(trustlines => dispatch(StellarActions.setDestinationTrustlines(trustlines)))
    .catch(() => dispatch(StellarActions.setDestinationTrustlines([])));
};

export const sendOperation = (type, formData) => (dispatch, getState) => {
  const state = getState();
  const account = getAccountSelector(state);
  const trustlines = getTrustlinesSelector(state);
  const destinationTruslines = getDestinationTrustlinesSelector(state);

  const operationData = { ...formData };
  switch (type) {
    case OPERATIONS.PAYMENT: {
      operationData.asset = trustlines[operationData.asset];
      console.log(operationData);
      return dispatch(sendPayment(operationData));
    }
    case OPERATIONS.PATH_PAYMENT: {
      operationData.asset_source =
        trustlines[operationData.asset_source];
      operationData.asset_destination =
        destinationTruslines[operationData.asset_destination];
      return dispatch(sendPathPayment(operationData));
    }
    case OPERATIONS.ISSUE_ASSET: {
      operationData.accountId = account.account_id;
      return dispatch(sendIssuePayment(operationData));
    }
    case OPERATIONS.CREATE_ACCOUNT: {
      return dispatch(sendCreateAccount(operationData));
    }
    case OPERATIONS.ACCOUNT_MERGE: {
      return dispatch(sendAccountMerge(operationData));
    }
    default:
      return Promise.reject();
  }
};
