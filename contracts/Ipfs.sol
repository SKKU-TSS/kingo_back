// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

contract Ipfs{
    mapping(string=>string) ipfsAddress;

    function getIpfsAddress(string memory date) public view returns (string memory){
        return ipfsAddress[date];
    }

    function setIpfsAddress(string memory date, string memory ipfs) public {
        ipfsAddress[date] = ipfs;
    }
}