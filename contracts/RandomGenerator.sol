pragma solidity ^0.4.21;

import "./Ownable.sol";
import "./RandomGeneratorInterface.sol";

contract RandomGenerator is RandomGeneratorInterface, Ownable {
    uint256 randomSeed = 50;

    // Only allow 1 user to generate random number from this contract
    function rand(address sender) public onlyOwner returns (uint256) {
        uint256 result = uint256(keccak256(blockhash(block.number), blockhash(block.number-1), sender, randomSeed, blockhash(block.number-2), blockhash(block.number-3)));
        randomSeed += result;
        randomSeed = randomSeed * randomSeed;
        return result;
    }
}