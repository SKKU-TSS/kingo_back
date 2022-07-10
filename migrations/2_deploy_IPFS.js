const IPFSCONTRACT = artifacts.require('Ipfs');
const fs = require('fs');

module.exports = function (deployer) {
  let name = 'IPFSADDRESS';
  let symbol = 'IPFSADDRESS';

  deployer.deploy(IPFSCONTRACT, name, symbol).then(() => {
    if (IPFSCONTRACT._json) {
      fs.writeFile('./src/contractinfo/deployedABI.json', JSON.stringify(IPFSCONTRACT._json.abi), (err) => {
        if (err) throw err;
        console.log('파일에 ABI 입력 성공');
      });
    }
    fs.writeFile('./src/contractinfo/deployedAddress.json', JSON.stringify(IPFSCONTRACT.address), (err) => {
      if (err) throw err;
      console.log('파일에 주소 입력 성공');
    });
  });
};
