const Caver = require('caver-js');
const DEPLOYED_ABI = require('../contractinfo/deployedABI.json');
const DEPLOYED_ADDRESS = require('../contractinfo/deployedAddress.json');

const config = {
  rpcURL: 'https://api.baobab.klaytn.net:8651',
};
const cav = new Caver(config.rpcURL);
const IPFSCONTRACT = new cav.klay.Contract(DEPLOYED_ABI, DEPLOYED_ADDRESS);

let ipfsClient = require('ipfs-http-client');
let ipfs = ipfsClient({
  host: 'ipfs.infura.io',
  port: '5001',
  protocol: 'https',
});

module.export = { cav, IPFSCONTRACT, ipfs };