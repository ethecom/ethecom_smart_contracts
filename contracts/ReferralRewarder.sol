pragma solidity ^0.4.21;

import "./Ownable.sol";
import "./ECOMTokenInterface.sol";

contract ReferralRewarder is Ownable {
    ECOMTokenInterface tokenContract;

    constructor(address tokenContractAddress) public {
        tokenContract = ECOMTokenInterface(tokenContractAddress);
    }

    function reward(address[] accounts, uint256[] amounts, uint256 count, uint256 totalAmount) public onlyOwner {
        require(tokenContract.balanceOf(address(this)) >= totalAmount);
        for (uint256 i = 0; i < count; i++) {
            tokenContract.transfer(accounts[i], amounts[i]);
        }
    }
}