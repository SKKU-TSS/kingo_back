const HDWalletProvider = require('truffle-hdwallet-provider-klaytn');
const NETWORK_ID = '1001';
const GASLIMIT = '20000000';
const URL = `https://api.baobab.klaytn.net:8651`;
const PRIVATE_KEY = '0x8cafa33df8c1740720bc4815ce7c7cd61d18aaf396bb2a3da5e197f0c7b85aff';

module.exports = {
  networks: {
    ganache: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // Match any network id
    },

    klaytn: {
      provider: new HDWalletProvider(PRIVATE_KEY, URL),
      network_id: NETWORK_ID,
      gas: GASLIMIT,
      gasPrice: null,
    },
  },
};
